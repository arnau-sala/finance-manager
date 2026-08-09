import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { Prisma } from "@prisma/client";

import { authenticatedUserSelect } from "../auth/authenticated-user.js";
import { db } from "../db/client.js";
import {
  assertTransactionalEmailConfigured,
  EmailConfigurationError,
} from "../email/brevo.js";
import { sendAccountEmailUnlinkVerificationEmail } from "../email/account-email-verification.js";

const EMAIL_UNLINK_CODE_TTL_MINUTES = 10;
const EMAIL_UNLINK_CODE_TTL_MS = EMAIL_UNLINK_CODE_TTL_MINUTES * 60 * 1_000;
const EMAIL_UNLINK_RESEND_COOLDOWN_MS = 60 * 1_000;
const EMAIL_UNLINK_RETENTION_MS = 24 * 60 * 60 * 1_000;
export const MAX_EMAIL_UNLINK_ATTEMPTS = 5;

type AuthenticatedUser = Prisma.UserGetPayload<{
  select: typeof authenticatedUserSelect;
}>;

type PendingEmailUnlinkSnapshot = {
  email: string;
  verificationCodeHash: string;
  verificationAttempts: number;
  expiresAt: Date;
  lastSentAt: Date;
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

function createVerificationCode() {
  return randomInt(100_000, 1_000_000).toString();
}

function hashVerificationCode(userId: string, email: string, code: string) {
  return createHmac("sha256", getVerificationSecret())
    .update(`account-email-unlink:${userId}:${email}:${code}`)
    .digest("hex");
}

function verificationCodeMatches(
  userId: string,
  email: string,
  code: string,
  expectedHash: string,
) {
  const candidate = Buffer.from(
    hashVerificationCode(userId, email, code),
    "hex",
  );
  const expected = Buffer.from(expectedHash, "hex");

  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

async function cleanStaleEmailUnlinks(now: Date) {
  await db.pendingEmailUnlink.deleteMany({
    where: {
      updatedAt: {
        lt: new Date(now.getTime() - EMAIL_UNLINK_RETENTION_MS),
      },
    },
  });
}

async function rollBackUndeliveredEmailUnlink(
  userId: string,
  verificationCodeHash: string,
  previous: PendingEmailUnlinkSnapshot | null,
) {
  if (!previous) {
    await db.pendingEmailUnlink.deleteMany({
      where: { userId, verificationCodeHash },
    });
    return;
  }

  await db.pendingEmailUnlink.updateMany({
    where: { userId, verificationCodeHash },
    data: previous,
  });
}

function hasAnotherSignInMethod(user: {
  username: string | null;
  googleSubject: string | null;
}) {
  return Boolean(user.username || user.googleSubject);
}

export async function beginAccountEmailUnlink(input: {
  userId: string;
  sessionVersion: number;
}) {
  assertTransactionalEmailConfigured();
  getVerificationSecret();

  const now = new Date();
  await cleanStaleEmailUnlinks(now);

  const user = await db.user.findUnique({
    where: { id: input.userId, sessionVersion: input.sessionVersion },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      passwordHash: true,
      googleSubject: true,
      emailLoginEnabled: true,
      status: true,
    },
  });

  if (!user || user.status !== "APPROVED") {
    return { type: "unauthenticated" } as const;
  }

  if (
    !user.email ||
    !user.emailLoginEnabled ||
    !hasAnotherSignInMethod(user) ||
    (user.username && !user.passwordHash)
  ) {
    return { type: "unavailable" } as const;
  }

  const email = user.email;
  const existing = await db.pendingEmailUnlink.findUnique({
    where: { userId: user.id },
    select: {
      email: true,
      verificationCodeHash: true,
      verificationAttempts: true,
      expiresAt: true,
      lastSentAt: true,
    },
  });

  if (
    existing?.email === email &&
    existing.lastSentAt.getTime() >
      now.getTime() - EMAIL_UNLINK_RESEND_COOLDOWN_MS
  ) {
    return { type: "accepted" } as const;
  }

  const code = createVerificationCode();
  const verificationCodeHash = hashVerificationCode(user.id, email, code);
  const expiresAt = new Date(now.getTime() + EMAIL_UNLINK_CODE_TTL_MS);
  let previous: PendingEmailUnlinkSnapshot | null = null;

  const claimed = await db.$transaction(async (transaction) => {
    await transaction.$queryRaw(
      Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`,
    );

    const activeUser = await transaction.user.findUnique({
      where: {
        id: user.id,
        sessionVersion: input.sessionVersion,
        status: "APPROVED",
      },
      select: {
        email: true,
        username: true,
        passwordHash: true,
        googleSubject: true,
        emailLoginEnabled: true,
      },
    });

    if (
      !activeUser ||
      activeUser.email !== email ||
      !activeUser.emailLoginEnabled ||
      !hasAnotherSignInMethod(activeUser) ||
      (activeUser.username && !activeUser.passwordHash)
    ) {
      return false;
    }

    const current = await transaction.pendingEmailUnlink.findUnique({
      where: { userId: user.id },
      select: {
        email: true,
        verificationCodeHash: true,
        verificationAttempts: true,
        expiresAt: true,
        lastSentAt: true,
      },
    });

    if (
      current?.email === email &&
      current.lastSentAt.getTime() >
        now.getTime() - EMAIL_UNLINK_RESEND_COOLDOWN_MS
    ) {
      return false;
    }

    previous = current;
    await transaction.pendingEmailUnlink.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        email,
        verificationCodeHash,
        expiresAt,
        lastSentAt: now,
      },
      update: {
        email,
        verificationCodeHash,
        verificationAttempts: 0,
        expiresAt,
        lastSentAt: now,
      },
    });

    return true;
  });

  if (!claimed) {
    return { type: "accepted" } as const;
  }

  try {
    await sendAccountEmailUnlinkVerificationEmail({
      email,
      name: user.name,
      code,
      expiresInMinutes: EMAIL_UNLINK_CODE_TTL_MINUTES,
    });
  } catch (error) {
    await rollBackUndeliveredEmailUnlink(
      user.id,
      verificationCodeHash,
      previous,
    );
    throw error;
  }

  return { type: "accepted" } as const;
}

export async function resendAccountEmailUnlinkCode(input: {
  userId: string;
  sessionVersion: number;
}) {
  assertTransactionalEmailConfigured();
  getVerificationSecret();

  const now = new Date();
  await cleanStaleEmailUnlinks(now);

  const [user, pending] = await Promise.all([
    db.user.findUnique({
      where: { id: input.userId, sessionVersion: input.sessionVersion },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        passwordHash: true,
        googleSubject: true,
        emailLoginEnabled: true,
        status: true,
      },
    }),
    db.pendingEmailUnlink.findUnique({
      where: { userId: input.userId },
      select: {
        email: true,
        verificationCodeHash: true,
        verificationAttempts: true,
        expiresAt: true,
        lastSentAt: true,
      },
    }),
  ]);

  if (!user || user.status !== "APPROVED") {
    return { type: "unauthenticated" } as const;
  }

  if (
    !user.email ||
    !user.emailLoginEnabled ||
    !hasAnotherSignInMethod(user) ||
    (user.username && !user.passwordHash) ||
    !pending ||
    pending.email !== user.email
  ) {
    return { type: "unavailable" } as const;
  }

  if (
    pending.lastSentAt.getTime() >
    now.getTime() - EMAIL_UNLINK_RESEND_COOLDOWN_MS
  ) {
    return { type: "accepted" } as const;
  }

  const code = createVerificationCode();
  const verificationCodeHash = hashVerificationCode(user.id, user.email, code);
  const expiresAt = new Date(now.getTime() + EMAIL_UNLINK_CODE_TTL_MS);
  const update = await db.pendingEmailUnlink.updateMany({
    where: {
      userId: user.id,
      email: user.email,
      lastSentAt: {
        lte: new Date(now.getTime() - EMAIL_UNLINK_RESEND_COOLDOWN_MS),
      },
    },
    data: {
      verificationCodeHash,
      verificationAttempts: 0,
      expiresAt,
      lastSentAt: now,
    },
  });

  if (update.count !== 1) {
    return { type: "accepted" } as const;
  }

  try {
    await sendAccountEmailUnlinkVerificationEmail({
      email: user.email,
      name: user.name,
      code,
      expiresInMinutes: EMAIL_UNLINK_CODE_TTL_MINUTES,
    });
  } catch (error) {
    await rollBackUndeliveredEmailUnlink(
      user.id,
      verificationCodeHash,
      pending,
    );
    throw error;
  }

  return { type: "accepted" } as const;
}

export type VerifyAccountEmailUnlinkResult =
  | { type: "unlinked"; user: AuthenticatedUser }
  | { type: "invalid" }
  | { type: "unauthenticated" }
  | { type: "unavailable" };

export async function verifyAccountEmailUnlink(input: {
  userId: string;
  sessionVersion: number;
  code: string;
}): Promise<VerifyAccountEmailUnlinkResult> {
  getVerificationSecret();

  try {
    return await db.$transaction(async (transaction) => {
      const [pending, user] = await Promise.all([
        transaction.pendingEmailUnlink.findUnique({
          where: { userId: input.userId },
        }),
        transaction.user.findUnique({
          where: {
            id: input.userId,
            sessionVersion: input.sessionVersion,
            status: "APPROVED",
          },
          select: {
            email: true,
            username: true,
            passwordHash: true,
            googleSubject: true,
            emailLoginEnabled: true,
          },
        }),
      ]);

      if (!user) {
        return { type: "unauthenticated" } as const;
      }

      if (
        !user.email ||
        !user.emailLoginEnabled ||
        !hasAnotherSignInMethod(user) ||
        (user.username && !user.passwordHash) ||
        pending?.email !== user.email
      ) {
        return { type: "unavailable" } as const;
      }

      if (
        !pending ||
        pending.expiresAt.getTime() <= Date.now() ||
        pending.verificationAttempts >= MAX_EMAIL_UNLINK_ATTEMPTS
      ) {
        return { type: "invalid" } as const;
      }

      if (
        !verificationCodeMatches(
          input.userId,
          pending.email,
          input.code,
          pending.verificationCodeHash,
        )
      ) {
        await transaction.pendingEmailUnlink.updateMany({
          where: {
            id: pending.id,
            verificationCodeHash: pending.verificationCodeHash,
            verificationAttempts: { lt: MAX_EMAIL_UNLINK_ATTEMPTS },
          },
          data: { verificationAttempts: { increment: 1 } },
        });

        return { type: "invalid" } as const;
      }

      const claim = await transaction.pendingEmailUnlink.deleteMany({
        where: {
          id: pending.id,
          userId: input.userId,
          verificationCodeHash: pending.verificationCodeHash,
          verificationAttempts: { lt: MAX_EMAIL_UNLINK_ATTEMPTS },
          expiresAt: { gt: new Date() },
        },
      });

      if (claim.count !== 1) {
        return { type: "invalid" } as const;
      }

      await Promise.all([
        transaction.pendingPasswordReset.deleteMany({
          where: { userId: input.userId },
        }),
        transaction.passwordResetGrant.deleteMany({
          where: { userId: input.userId },
        }),
        transaction.pendingGoogleAuthAction.deleteMany({
          where: { userId: input.userId },
        }),
      ]);

      const keepsGoogleEmail = Boolean(user.googleSubject);
      const updatedUser = await transaction.user.update({
        where: {
          id: input.userId,
          sessionVersion: input.sessionVersion,
          status: "APPROVED",
        },
        data: {
          emailLoginEnabled: false,
          sessionVersion: { increment: 1 },
          authProvider: user.googleSubject
            ? user.username
              ? "PASSWORD_AND_GOOGLE"
              : "GOOGLE"
            : "PASSWORD",
          ...(keepsGoogleEmail
            ? {}
            : {
                email: null,
                emailVerifiedAt: null,
              }),
          ...(!user.username && user.googleSubject
            ? { passwordHash: null }
            : {}),
        },
        select: authenticatedUserSelect,
      });

      return { type: "unlinked", user: updatedUser } as const;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { type: "unauthenticated" };
    }

    throw error;
  }
}
