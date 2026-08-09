import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { Prisma } from "@prisma/client";

import { db } from "../db/client.js";
import {
  assertTransactionalEmailConfigured,
  EmailConfigurationError,
  EmailDeliveryError,
} from "../email/brevo.js";
import { sendRegistrationVerificationEmail } from "../email/registration-verification.js";
import { hashPassword } from "./password.js";

const VERIFICATION_CODE_TTL_MINUTES = 10;
const VERIFICATION_CODE_TTL_MS = VERIFICATION_CODE_TTL_MINUTES * 60 * 1_000;
const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1_000;
const PENDING_REGISTRATION_RETENTION_MS = 24 * 60 * 60 * 1_000;
export const MAX_VERIFICATION_ATTEMPTS = 5;

type PendingRegistrationSnapshot = {
  name: string;
  passwordHash: string;
  verificationCodeHash: string;
  verificationAttempts: number;
  expiresAt: Date;
  lastSentAt: Date;
};

type RegistrationClaim = {
  previous: PendingRegistrationSnapshot | null;
};

const genericRegistrationResponse = {
  message:
    "If registration can continue, a verification code has been sent.",
};

export { EmailConfigurationError, EmailDeliveryError };
export { genericRegistrationResponse };

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

function hashVerificationCode(email: string, code: string) {
  return createHmac("sha256", getVerificationSecret())
    .update(`${email}:${code}`)
    .digest("hex");
}

function verificationCodeMatches(
  email: string,
  code: string,
  expectedHash: string,
) {
  const candidate = Buffer.from(hashVerificationCode(email, code), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

async function cleanStaleRegistrations(now: Date) {
  const staleBefore = new Date(
    now.getTime() - PENDING_REGISTRATION_RETENTION_MS,
  );

  await db.pendingRegistration.deleteMany({
    where: { updatedAt: { lt: staleBefore } },
  });
}

async function rollBackUndeliveredRegistration(
  email: string,
  verificationCodeHash: string,
  previous: PendingRegistrationSnapshot | null,
) {
  if (!previous) {
    await db.pendingRegistration.deleteMany({
      where: { email, verificationCodeHash },
    });
    return;
  }

  await db.pendingRegistration.updateMany({
    where: { email, verificationCodeHash },
    data: previous,
  });
}

export async function beginPasswordRegistration(input: {
  email: string;
  name: string;
  password: string;
}) {
  assertTransactionalEmailConfigured();
  getVerificationSecret();

  const now = new Date();
  await cleanStaleRegistrations(now);

  const [existingUser, existingRegistration] = await Promise.all([
    db.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    }),
    db.pendingRegistration.findUnique({
      where: { email: input.email },
      select: { id: true, lastSentAt: true },
    }),
  ]);

  if (
    existingUser ||
    (existingRegistration &&
      existingRegistration.lastSentAt.getTime() >
        now.getTime() - VERIFICATION_RESEND_COOLDOWN_MS)
  ) {
    return;
  }

  const passwordHash = await hashPassword(input.password);
  const code = createVerificationCode();
  const verificationCodeHash = hashVerificationCode(input.email, code);
  const expiresAt = new Date(now.getTime() + VERIFICATION_CODE_TTL_MS);

  let registrationClaim: RegistrationClaim | null = null;

  try {
    registrationClaim = await db.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });

      if (user) {
        return null;
      }

      const pendingRegistration =
        await transaction.pendingRegistration.findUnique({
          where: { email: input.email },
          select: {
            id: true,
            name: true,
            passwordHash: true,
            verificationCodeHash: true,
            verificationAttempts: true,
            expiresAt: true,
            lastSentAt: true,
          },
        });

      if (pendingRegistration) {
        const update = await transaction.pendingRegistration.updateMany({
          where: {
            id: pendingRegistration.id,
            lastSentAt: {
              lte: new Date(
                now.getTime() - VERIFICATION_RESEND_COOLDOWN_MS,
              ),
            },
          },
          data: {
            name: input.name,
            passwordHash,
            verificationCodeHash,
            verificationAttempts: 0,
            expiresAt,
            lastSentAt: now,
          },
        });

        if (update.count !== 1) {
          return null;
        }

        const { id: _id, ...previous } = pendingRegistration;
        return { previous };
      }

      await transaction.pendingRegistration.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash,
          verificationCodeHash,
          expiresAt,
          lastSentAt: now,
        },
      });

      return { previous: null };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return;
    }

    throw error;
  }

  if (!registrationClaim) {
    return;
  }

  try {
    await sendRegistrationVerificationEmail({
      email: input.email,
      name: input.name,
      code,
      expiresInMinutes: VERIFICATION_CODE_TTL_MINUTES,
    });
  } catch (error) {
    await rollBackUndeliveredRegistration(
      input.email,
      verificationCodeHash,
      registrationClaim.previous,
    );
    throw error;
  }
}

export async function resendPasswordRegistrationCode(email: string) {
  assertTransactionalEmailConfigured();
  getVerificationSecret();

  const now = new Date();
  await cleanStaleRegistrations(now);

  const code = createVerificationCode();
  const verificationCodeHash = hashVerificationCode(email, code);
  const expiresAt = new Date(now.getTime() + VERIFICATION_CODE_TTL_MS);

  const [existingUser, registration] = await Promise.all([
    db.user.findUnique({
      where: { email },
      select: { id: true },
    }),
    db.pendingRegistration.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        passwordHash: true,
        verificationCodeHash: true,
        verificationAttempts: true,
        expiresAt: true,
        lastSentAt: true,
      },
    }),
  ]);

  if (existingUser || !registration) {
    return;
  }

  const update = await db.pendingRegistration.updateMany({
    where: {
      id: registration.id,
      lastSentAt: {
        lte: new Date(now.getTime() - VERIFICATION_RESEND_COOLDOWN_MS),
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
    return;
  }

  const { id: _id, ...previous } = registration;

  try {
    await sendRegistrationVerificationEmail({
      email,
      name: registration.name,
      code,
      expiresInMinutes: VERIFICATION_CODE_TTL_MINUTES,
    });
  } catch (error) {
    await rollBackUndeliveredRegistration(
      email,
      verificationCodeHash,
      previous,
    );
    throw error;
  }
}

export type RegistrationVerificationResult =
  | {
      type: "created";
      user: {
        id: string;
        email: string | null;
        username: string | null;
        name: string;
        role: "USER" | "ADMIN";
        status: "APPROVED" | "SUSPENDED";
        createdAt: Date;
      };
      sessionVersion: number;
    }
  | { type: "invalid" }
  | { type: "account-exists" };

export async function verifyPasswordRegistration(
  email: string,
  code: string,
): Promise<RegistrationVerificationResult> {
  getVerificationSecret();

  const result = await db.$transaction(async (transaction) => {
    const registration = await transaction.pendingRegistration.findUnique({
      where: { email },
    });

    if (
      !registration ||
      registration.expiresAt.getTime() <= Date.now() ||
      registration.verificationAttempts >= MAX_VERIFICATION_ATTEMPTS
    ) {
      return { type: "invalid" } as const;
    }

    if (
      !verificationCodeMatches(
        email,
        code,
        registration.verificationCodeHash,
      )
    ) {
      await transaction.pendingRegistration.updateMany({
        where: {
          id: registration.id,
          verificationCodeHash: registration.verificationCodeHash,
          verificationAttempts: { lt: MAX_VERIFICATION_ATTEMPTS },
        },
        data: { verificationAttempts: { increment: 1 } },
      });

      return { type: "invalid" } as const;
    }

    const claim = await transaction.pendingRegistration.deleteMany({
      where: {
        id: registration.id,
        verificationCodeHash: registration.verificationCodeHash,
        verificationAttempts: { lt: MAX_VERIFICATION_ATTEMPTS },
        expiresAt: { gt: new Date() },
      },
    });

    if (claim.count !== 1) {
      return { type: "invalid" } as const;
    }

    const existingUser = await transaction.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return { type: "account-exists" } as const;
    }

    const user = await transaction.user.create({
      data: {
        email: registration.email,
        name: registration.name,
        passwordHash: registration.passwordHash,
        authProvider: "PASSWORD",
        emailLoginEnabled: true,
        role: "USER",
        status: "APPROVED",
        emailVerifiedAt: new Date(),
        updatedAt: null,
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        sessionVersion: true,
      },
    });

    const { sessionVersion, ...publicUser } = user;
    return { type: "created", user: publicUser, sessionVersion } as const;
  });

  return result;
}
