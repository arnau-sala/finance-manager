import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { Prisma } from "@prisma/client";

import { db } from "../db/client.js";
import {
  assertTransactionalEmailConfigured,
  EmailConfigurationError,
} from "../email/brevo.js";
import { sendAccountEmailVerificationEmail } from "../email/account-email-verification.js";
import { hashPassword } from "../auth/password.js";

const EMAIL_LINK_CODE_TTL_MINUTES = 10;
const EMAIL_LINK_CODE_TTL_MS = EMAIL_LINK_CODE_TTL_MINUTES * 60 * 1_000;
const EMAIL_LINK_RESEND_COOLDOWN_MS = 60 * 1_000;
const EMAIL_LINK_RETENTION_MS = 24 * 60 * 60 * 1_000;
export const MAX_EMAIL_LINK_ATTEMPTS = 5;

type PendingEmailLinkSnapshot = {
  email: string;
  verificationCodeHash: string;
  passwordHash: string | null;
  verificationAttempts: number;
  expiresAt: Date;
  lastSentAt: Date;
};

function getVerificationSecret() {
  const secret = process.env.EMAIL_VERIFICATION_SECRET?.trim();

  if (!secret || !/^[a-f\d]{64}$/i.test(secret)) {
    throw new EmailConfigurationError(
      "EMAIL_VERIFICATION_SECRET must be a 64-character hexadecimal value.",
    );
  }

  return Buffer.from(secret, "hex");
}

function createVerificationCode() {
  return randomInt(100_000, 1_000_000).toString();
}

function hashVerificationCode(
  userId: string,
  email: string,
  code: string,
) {
  return createHmac("sha256", getVerificationSecret())
    .update(`account-email:${userId}:${email}:${code}`)
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

async function cleanStaleEmailLinks(now: Date) {
  await db.pendingEmailLink.deleteMany({
    where: {
      updatedAt: {
        lt: new Date(now.getTime() - EMAIL_LINK_RETENTION_MS),
      },
    },
  });
}

async function rollBackUndeliveredEmailLink(
  userId: string,
  verificationCodeHash: string,
  previous: PendingEmailLinkSnapshot | null,
) {
  if (!previous) {
    await db.pendingEmailLink.deleteMany({
      where: { userId, verificationCodeHash },
    });
    return;
  }

  await db.pendingEmailLink.updateMany({
    where: { userId, verificationCodeHash },
    data: previous,
  });
}

export const genericEmailLinkResponse = {
  message: "If this email can be linked, a verification code has been sent.",
};

export async function beginAccountEmailLink(input: {
  userId: string;
  sessionVersion: number;
  email?: string;
  password?: string;
}) {
  assertTransactionalEmailConfigured();
  getVerificationSecret();

  const now = new Date();
  await cleanStaleEmailLinks(now);

  const user = await db.user.findUnique({
    where: { id: input.userId, sessionVersion: input.sessionVersion },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      passwordHash: true,
      emailLoginEnabled: true,
      status: true,
    },
  });

  if (!user || user.status !== "APPROVED") {
    return { type: "unauthenticated" } as const;
  }

  if (user.emailLoginEnabled) {
    return { type: "unavailable" } as const;
  }

  const targetEmail = user.email ?? input.email;

  if (
    !targetEmail ||
    (!user.email && (!user.username || !user.passwordHash)) ||
    (user.email && input.email && input.email !== user.email) ||
    (!user.passwordHash && !input.password)
  ) {
    return { type: "invalid-request" } as const;
  }

  const pendingPasswordHash = user.passwordHash
    ? null
    : await hashPassword(input.password!);

  const [emailOwner, pendingRegistration, existingEmailLink] =
    await Promise.all([
      db.user.findUnique({
        where: { email: targetEmail },
        select: { id: true },
      }),
      db.pendingRegistration.findUnique({
        where: { email: targetEmail },
        select: { id: true },
      }),
      db.pendingEmailLink.findUnique({
        where: { userId: input.userId },
        select: { email: true, lastSentAt: true },
      }),
    ]);

  if (
    (emailOwner && emailOwner.id !== user.id) ||
    (!user.email && pendingRegistration)
  ) {
    return { type: "accepted" } as const;
  }

  if (
    existingEmailLink?.email === targetEmail &&
    existingEmailLink.lastSentAt.getTime() >
      now.getTime() - EMAIL_LINK_RESEND_COOLDOWN_MS
  ) {
    if (pendingPasswordHash) {
      await db.pendingEmailLink.updateMany({
        where: { userId: user.id, email: targetEmail },
        data: { passwordHash: pendingPasswordHash },
      });
    }

    return { type: "accepted" } as const;
  }

  const code = createVerificationCode();
  const verificationCodeHash = hashVerificationCode(
    user.id,
    targetEmail,
    code,
  );
  const expiresAt = new Date(now.getTime() + EMAIL_LINK_CODE_TTL_MS);
  let previous: PendingEmailLinkSnapshot | null = null;

  try {
    const claimed = await db.$transaction(async (transaction) => {
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
          emailLoginEnabled: true,
        },
      });

      if (
        !activeUser ||
        activeUser.emailLoginEnabled ||
        activeUser.email !== user.email ||
        activeUser.username !== user.username ||
        activeUser.passwordHash !== user.passwordHash
      ) {
        return false;
      }

      const [currentEmailOwner, currentRegistration, emailLinkOwner] =
        await Promise.all([
          transaction.user.findUnique({
            where: { email: targetEmail },
            select: { id: true },
          }),
          transaction.pendingRegistration.findUnique({
            where: { email: targetEmail },
            select: { id: true },
          }),
          transaction.pendingEmailLink.findUnique({
            where: { email: targetEmail },
            select: { userId: true },
          }),
        ]);

      if (
        (currentEmailOwner && currentEmailOwner.id !== user.id) ||
        (!activeUser.email && currentRegistration) ||
        (emailLinkOwner && emailLinkOwner.userId !== user.id)
      ) {
        return false;
      }

      const currentLink = await transaction.pendingEmailLink.findUnique({
        where: { userId: user.id },
        select: {
          email: true,
          verificationCodeHash: true,
          passwordHash: true,
          verificationAttempts: true,
          expiresAt: true,
          lastSentAt: true,
        },
      });

      if (
        currentLink?.email === targetEmail &&
        currentLink.lastSentAt.getTime() >
          now.getTime() - EMAIL_LINK_RESEND_COOLDOWN_MS
      ) {
        return false;
      }

      previous = currentLink;

      await transaction.pendingEmailLink.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          email: targetEmail,
          verificationCodeHash,
          passwordHash: pendingPasswordHash,
          expiresAt,
          lastSentAt: now,
        },
        update: {
          email: targetEmail,
          verificationCodeHash,
          passwordHash: pendingPasswordHash,
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
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { type: "accepted" } as const;
    }

    throw error;
  }

  try {
    await sendAccountEmailVerificationEmail({
      email: targetEmail,
      name: user.name,
      username: user.username,
      code,
      expiresInMinutes: EMAIL_LINK_CODE_TTL_MINUTES,
    });
  } catch (error) {
    await rollBackUndeliveredEmailLink(
      user.id,
      verificationCodeHash,
      previous,
    );
    throw error;
  }

  return { type: "accepted" } as const;
}

export async function resendAccountEmailLinkCode(input: {
  userId: string;
  sessionVersion: number;
}) {
  assertTransactionalEmailConfigured();
  getVerificationSecret();

  const now = new Date();
  await cleanStaleEmailLinks(now);

  const [user, link] = await Promise.all([
    db.user.findUnique({
      where: { id: input.userId, sessionVersion: input.sessionVersion },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        emailLoginEnabled: true,
        status: true,
      },
    }),
    db.pendingEmailLink.findUnique({
      where: { userId: input.userId },
      select: {
        email: true,
        verificationCodeHash: true,
        passwordHash: true,
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
    user.emailLoginEnabled ||
    !link ||
    (user.email !== null && user.email !== link.email)
  ) {
    return { type: "accepted" } as const;
  }

  if (
    link.lastSentAt.getTime() >
    now.getTime() - EMAIL_LINK_RESEND_COOLDOWN_MS
  ) {
    return { type: "accepted" } as const;
  }

  const [emailOwner, pendingRegistration] = await Promise.all([
    db.user.findUnique({ where: { email: link.email }, select: { id: true } }),
    db.pendingRegistration.findUnique({
      where: { email: link.email },
      select: { id: true },
    }),
  ]);

  if (
    (emailOwner && emailOwner.id !== user.id) ||
    (!user.email && pendingRegistration)
  ) {
    return { type: "accepted" } as const;
  }

  const code = createVerificationCode();
  const verificationCodeHash = hashVerificationCode(
    input.userId,
    link.email,
    code,
  );
  const expiresAt = new Date(now.getTime() + EMAIL_LINK_CODE_TTL_MS);
  const update = await db.pendingEmailLink.updateMany({
    where: {
      userId: input.userId,
      email: link.email,
      lastSentAt: {
        lte: new Date(now.getTime() - EMAIL_LINK_RESEND_COOLDOWN_MS),
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
    await sendAccountEmailVerificationEmail({
      email: link.email,
      name: user.name,
      username: user.username,
      code,
      expiresInMinutes: EMAIL_LINK_CODE_TTL_MINUTES,
    });
  } catch (error) {
    await rollBackUndeliveredEmailLink(
      input.userId,
      verificationCodeHash,
      link,
    );
    throw error;
  }

  return { type: "accepted" } as const;
}

export type VerifyAccountEmailLinkResult =
  | { type: "linked" }
  | { type: "invalid" }
  | { type: "unauthenticated" }
  | { type: "unavailable" };

export async function verifyAccountEmailLink(input: {
  userId: string;
  sessionVersion: number;
  code: string;
}): Promise<VerifyAccountEmailLinkResult> {
  getVerificationSecret();

  try {
    return await db.$transaction(async (transaction) => {
      const [link, activeUser] = await Promise.all([
        transaction.pendingEmailLink.findUnique({
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
            passwordHash: true,
            googleSubject: true,
            emailLoginEnabled: true,
          },
        }),
      ]);

      if (!activeUser) {
        return { type: "unauthenticated" } as const;
      }

      if (
        activeUser.emailLoginEnabled ||
        (activeUser.email !== null && activeUser.email !== link?.email)
      ) {
        return { type: "unavailable" } as const;
      }

      if (
        !link ||
        link.expiresAt.getTime() <= Date.now() ||
        link.verificationAttempts >= MAX_EMAIL_LINK_ATTEMPTS
      ) {
        return { type: "invalid" } as const;
      }

      if (
        !verificationCodeMatches(
          input.userId,
          link.email,
          input.code,
          link.verificationCodeHash,
        )
      ) {
        await transaction.pendingEmailLink.updateMany({
          where: {
            id: link.id,
            verificationCodeHash: link.verificationCodeHash,
            verificationAttempts: { lt: MAX_EMAIL_LINK_ATTEMPTS },
          },
          data: { verificationAttempts: { increment: 1 } },
        });

        return { type: "invalid" } as const;
      }

      const emailOwner = await transaction.user.findUnique({
        where: { email: link.email },
        select: { id: true },
      });

      if (emailOwner && emailOwner.id !== input.userId) {
        return { type: "unavailable" } as const;
      }

      const passwordHash = activeUser.passwordHash ?? link.passwordHash;

      if (!passwordHash) {
        return { type: "unavailable" } as const;
      }

      const claim = await transaction.pendingEmailLink.deleteMany({
        where: {
          id: link.id,
          userId: input.userId,
          verificationCodeHash: link.verificationCodeHash,
          verificationAttempts: { lt: MAX_EMAIL_LINK_ATTEMPTS },
          expiresAt: { gt: new Date() },
        },
      });

      if (claim.count !== 1) {
        return { type: "invalid" } as const;
      }

      await transaction.pendingRegistration.deleteMany({
        where: { email: link.email },
      });
      await transaction.user.update({
        where: {
          id: input.userId,
          sessionVersion: input.sessionVersion,
          status: "APPROVED",
        },
        data: {
          email: link.email,
          passwordHash,
          authProvider: activeUser.googleSubject
            ? "PASSWORD_AND_GOOGLE"
            : "PASSWORD",
          emailLoginEnabled: true,
          emailVerifiedAt: new Date(),
        },
      });

      return { type: "linked" } as const;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { type: "unavailable" };
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { type: "unauthenticated" };
    }

    throw error;
  }
}
