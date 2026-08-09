import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

import {
  PasswordResetEmailKind,
  PasswordResetMethod,
  Prisma,
} from "@prisma/client";

import { db } from "../db/client.js";
import {
  assertTransactionalEmailConfigured,
  EmailConfigurationError,
} from "../email/brevo.js";
import {
  sendGooglePasswordGuidanceEmail,
  sendPasswordChangedEmail,
  sendPasswordResetCodeEmail,
} from "../email/password-recovery.js";
import { supportsPasswordAuthentication } from "./auth-provider.js";
import { hashPassword, verifyPassword } from "./password.js";
import {
  createAccountRecoveryCode,
  hashCanonicalRecoveryCode,
} from "./recovery-code.js";

const EMAIL_CODE_TTL_MINUTES = 10;
const EMAIL_CODE_TTL_MS = EMAIL_CODE_TTL_MINUTES * 60 * 1_000;
const RESET_GRANT_TTL_MS = 10 * 60 * 1_000;
const RESEND_COOLDOWN_MS = 60 * 1_000;
const PENDING_RESET_RETENTION_MS = 24 * 60 * 60 * 1_000;
const MAX_EMAIL_CODE_ATTEMPTS = 5;
const dummyVerificationHash = "0".repeat(64);

class InvalidPasswordResetGrantError extends Error {}

export const genericPasswordResetResponse = {
  message:
    "If the account can be recovered, the next instructions have been sent.",
};

export type PasswordRecoveryEmailDelivery =
  | {
      kind: "reset-code";
      email: string;
      name: string;
      code: string;
    }
  | {
      kind: "google-guidance";
      email: string;
      name: string;
    };

function getVerificationSecret() {
  const secret = process.env.EMAIL_VERIFICATION_SECRET?.trim();

  if (!secret || !/^[a-f\d]{64}$/i.test(secret)) {
    throw new EmailConfigurationError(
      "EMAIL_VERIFICATION_SECRET must be a 64-character hexadecimal value",
    );
  }

  return Buffer.from(secret, "hex");
}

function createEmailCode() {
  return randomInt(100_000, 1_000_000).toString();
}

function hashEmailCode(email: string, code: string) {
  return createHmac("sha256", getVerificationSecret())
    .update(`password-reset:${email}:${code}`)
    .digest("hex");
}

function emailCodeMatches(email: string, code: string, expectedHash: string) {
  const candidate = Buffer.from(hashEmailCode(email, code), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

function createResetGrantToken() {
  return randomBytes(32).toString("base64url");
}

export function hashResetGrantToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

async function cleanExpiredPasswordRecoveryState(now: Date) {
  const stalePendingBefore = new Date(
    now.getTime() - PENDING_RESET_RETENTION_MS,
  );

  await Promise.all([
    db.pendingPasswordReset.deleteMany({
      where: { updatedAt: { lt: stalePendingBefore } },
    }),
    db.passwordResetGrant.deleteMany({
      where: { expiresAt: { lte: now } },
    }),
  ]);
}

export async function beginEmailPasswordReset(
  email: string,
): Promise<PasswordRecoveryEmailDelivery | null> {
  assertTransactionalEmailConfigured();
  getVerificationSecret();

  const now = new Date();
  await cleanExpiredPasswordRecoveryState(now);

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      authProvider: true,
      emailLoginEnabled: true,
      status: true,
    },
  });

  if (!user?.email || user.status !== "APPROVED") {
    return null;
  }

  const userEmail = user.email;
  const canResetPassword =
    user.emailLoginEnabled &&
    supportsPasswordAuthentication(user.authProvider);
  const kind = canResetPassword
    ? PasswordResetEmailKind.RESET_CODE
    : PasswordResetEmailKind.GOOGLE_GUIDANCE;
  const code = createEmailCode();
  const verificationCodeHash = canResetPassword
    ? hashEmailCode(userEmail, code)
    : null;
  const expiresAt = new Date(now.getTime() + EMAIL_CODE_TTL_MS);

  try {
    const claimed = await db.$transaction(async (transaction) => {
      const pending = await transaction.pendingPasswordReset.findUnique({
        where: { userId: user.id },
        select: { id: true, lastSentAt: true },
      });

      if (pending) {
        const update = await transaction.pendingPasswordReset.updateMany({
          where: {
            id: pending.id,
            lastSentAt: {
              lte: new Date(now.getTime() - RESEND_COOLDOWN_MS),
            },
          },
          data: {
            email: userEmail,
            kind,
            verificationCodeHash,
            verificationAttempts: 0,
            expiresAt,
            lastSentAt: now,
          },
        });

        if (update.count !== 1) {
          return false;
        }

        await transaction.passwordResetGrant.deleteMany({
          where: { userId: user.id },
        });

        return true;
      }

      await transaction.pendingPasswordReset.create({
        data: {
          userId: user.id,
          email: userEmail,
          kind,
          verificationCodeHash,
          expiresAt,
          lastSentAt: now,
        },
      });

      await transaction.passwordResetGrant.deleteMany({
        where: { userId: user.id },
      });

      return true;
    });

    if (!claimed) {
      return null;
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return null;
    }

    throw error;
  }

  return canResetPassword
    ? { kind: "reset-code", email: userEmail, name: user.name, code }
    : { kind: "google-guidance", email: userEmail, name: user.name };
}

export async function deliverPasswordRecoveryEmail(
  delivery: PasswordRecoveryEmailDelivery,
) {
  if (delivery.kind === "reset-code") {
    await sendPasswordResetCodeEmail({
      ...delivery,
      expiresInMinutes: EMAIL_CODE_TTL_MINUTES,
    });
    return;
  }

  await sendGooglePasswordGuidanceEmail(delivery);
}

type PasswordResetGrantResult =
  | { type: "granted"; token: string; username: string | null }
  | { type: "invalid" };

export async function verifyEmailPasswordResetCode(
  email: string,
  code: string,
): Promise<PasswordResetGrantResult> {
  getVerificationSecret();

  const now = new Date();
  const token = createResetGrantToken();
  const tokenHash = hashResetGrantToken(token);
  const expiresAt = new Date(now.getTime() + RESET_GRANT_TTL_MS);

  return db.$transaction(async (transaction) => {
    const pending = await transaction.pendingPasswordReset.findUnique({
      where: { email },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            authProvider: true,
            emailLoginEnabled: true,
            status: true,
          },
        },
      },
    });
    const matches = emailCodeMatches(
      email,
      code,
      pending?.verificationCodeHash ?? dummyVerificationHash,
    );
    const isValid =
      pending !== null &&
      pending.kind === PasswordResetEmailKind.RESET_CODE &&
      pending.verificationCodeHash !== null &&
      pending.expiresAt.getTime() > now.getTime() &&
      pending.verificationAttempts < MAX_EMAIL_CODE_ATTEMPTS &&
      pending.user.email === email &&
      pending.user.status === "APPROVED" &&
      pending.user.emailLoginEnabled &&
      supportsPasswordAuthentication(pending.user.authProvider) &&
      matches;

    if (!isValid) {
      if (
        pending &&
        pending.kind === PasswordResetEmailKind.RESET_CODE &&
        pending.verificationAttempts < MAX_EMAIL_CODE_ATTEMPTS &&
        pending.expiresAt.getTime() > now.getTime()
      ) {
        await transaction.pendingPasswordReset.updateMany({
          where: {
            id: pending.id,
            verificationAttempts: { lt: MAX_EMAIL_CODE_ATTEMPTS },
          },
          data: { verificationAttempts: { increment: 1 } },
        });
      }

      return { type: "invalid" } as const;
    }

    const claim = await transaction.pendingPasswordReset.deleteMany({
      where: {
        id: pending.id,
        verificationCodeHash: pending.verificationCodeHash,
        verificationAttempts: { lt: MAX_EMAIL_CODE_ATTEMPTS },
        expiresAt: { gt: now },
      },
    });

    if (claim.count !== 1) {
      return { type: "invalid" } as const;
    }

    await transaction.passwordResetGrant.upsert({
      where: { userId: pending.userId },
      create: {
        userId: pending.userId,
        method: PasswordResetMethod.EMAIL_CODE,
        tokenHash,
        expiresAt,
      },
      update: {
        method: PasswordResetMethod.EMAIL_CODE,
        tokenHash,
        recoveryCodeHash: null,
        expiresAt,
        createdAt: now,
      },
    });

    return {
      type: "granted",
      token,
      username: pending.user.username,
    } as const;
  });
}

export async function verifyAccountRecoveryCode(input: {
  recoveryCode: string;
  username?: string;
}): Promise<PasswordResetGrantResult> {
  const codeHash = hashCanonicalRecoveryCode(input.recoveryCode);
  const recoveryCode = await db.accountRecoveryCode.findUnique({
    where: { codeHash },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          passwordHash: true,
          authProvider: true,
          status: true,
        },
      },
    },
  });
  const user = recoveryCode?.user;

  if (
    !recoveryCode ||
    !user?.username ||
    !user.passwordHash ||
    user.status !== "APPROVED" ||
    !supportsPasswordAuthentication(user.authProvider) ||
    (input.username !== undefined && user.username !== input.username)
  ) {
    return { type: "invalid" };
  }

  const now = new Date();
  const token = createResetGrantToken();

  await db.$transaction([
    db.passwordResetGrant.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        method: PasswordResetMethod.RECOVERY_CODE,
        tokenHash: hashResetGrantToken(token),
        recoveryCodeHash: recoveryCode.codeHash,
        expiresAt: new Date(now.getTime() + RESET_GRANT_TTL_MS),
      },
      update: {
        method: PasswordResetMethod.RECOVERY_CODE,
        tokenHash: hashResetGrantToken(token),
        recoveryCodeHash: recoveryCode.codeHash,
        expiresAt: new Date(now.getTime() + RESET_GRANT_TTL_MS),
        createdAt: now,
      },
    }),
    db.pendingPasswordReset.deleteMany({ where: { userId: user.id } }),
  ]);

  return { type: "granted", token, username: user.username };
}

export type CompletePasswordResetResult =
  | {
      type: "completed";
      username: string | null;
      recoveryCode: string | null;
      notification: { email: string; name: string } | null;
    }
  | { type: "invalid" }
  | { type: "password-unchanged" };

export async function completePasswordReset(input: {
  token: string;
  newPassword: string;
}): Promise<CompletePasswordResetResult> {
  const tokenHash = hashResetGrantToken(input.token);
  const grant = await db.passwordResetGrant.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          passwordHash: true,
          authProvider: true,
          emailLoginEnabled: true,
          status: true,
        },
      },
    },
  });
  const now = new Date();

  if (
    !grant ||
    grant.expiresAt.getTime() <= now.getTime() ||
    grant.user.status !== "APPROVED" ||
    !grant.user.passwordHash ||
    (grant.method === PasswordResetMethod.EMAIL_CODE &&
      !grant.user.emailLoginEnabled) ||
    !supportsPasswordAuthentication(grant.user.authProvider)
  ) {
    return { type: "invalid" };
  }

  if (await verifyPassword(grant.user.passwordHash, input.newPassword)) {
    return { type: "password-unchanged" };
  }

  const passwordHash = await hashPassword(input.newPassword);
  const replacementRecoveryCode =
    grant.method === PasswordResetMethod.RECOVERY_CODE
      ? createAccountRecoveryCode()
      : null;

  try {
    return await db.$transaction(async (transaction) => {
      const claim = await transaction.passwordResetGrant.deleteMany({
        where: {
          id: grant.id,
          tokenHash,
          expiresAt: { gt: now },
        },
      });

      if (claim.count !== 1) {
        throw new InvalidPasswordResetGrantError();
      }

      if (replacementRecoveryCode) {
        if (!grant.recoveryCodeHash) {
          throw new InvalidPasswordResetGrantError();
        }

        const rotation = await transaction.accountRecoveryCode.updateMany({
          where: {
            userId: grant.userId,
            codeHash: grant.recoveryCodeHash,
          },
          data: {
            codeHash: replacementRecoveryCode.codeHash,
            createdAt: now,
          },
        });

        if (rotation.count !== 1) {
          throw new InvalidPasswordResetGrantError();
        }
      }

      const updated = await transaction.user.updateMany({
        where: {
          id: grant.userId,
          status: "APPROVED",
          authProvider: { in: ["PASSWORD", "PASSWORD_AND_GOOGLE"] },
          ...(grant.method === PasswordResetMethod.EMAIL_CODE
            ? { emailLoginEnabled: true }
            : {}),
        },
        data: {
          passwordHash,
          sessionVersion: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        throw new InvalidPasswordResetGrantError();
      }

      await transaction.pendingPasswordReset.deleteMany({
        where: { userId: grant.userId },
      });

      return {
        type: "completed",
        username: grant.user.username,
        recoveryCode: replacementRecoveryCode?.displayCode ?? null,
        notification: grant.user.email
          ? { email: grant.user.email, name: grant.user.name }
          : null,
      } as const;
    });
  } catch (error) {
    if (error instanceof InvalidPasswordResetGrantError) {
      return { type: "invalid" };
    }

    throw error;
  }
}

export async function notifyPasswordChanged(input: {
  email: string;
  name: string;
}) {
  await sendPasswordChangedEmail(input);
}

export async function revokePasswordResetGrant(token: string) {
  await db.passwordResetGrant.deleteMany({
    where: { tokenHash: hashResetGrantToken(token) },
  });
}
