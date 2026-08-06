import { Prisma } from "@prisma/client";

import { db } from "../db/client.js";
import { supportsPasswordAuthentication } from "./auth-provider.js";
import { hashPassword, verifyPassword } from "./password.js";
import { createAccountRecoveryCode } from "./recovery-code.js";

type UsernameRegistrationInput = {
  username: string;
  name: string;
  password: string;
};

export type UsernameRegistrationResult =
  | {
      type: "created";
      recoveryCode: string;
      sessionVersion: number;
      user: {
        id: string;
        email: null;
        username: string;
        name: string;
        role: "USER" | "ADMIN";
        status: "APPROVED" | "SUSPENDED";
        createdAt: Date;
      };
    }
  | { type: "username-unavailable" };

export async function registerUsernameAccount(
  input: UsernameRegistrationInput,
): Promise<UsernameRegistrationResult> {
  const existingUser = await db.user.findUnique({
    where: { username: input.username },
    select: { id: true },
  });

  if (existingUser) {
    return { type: "username-unavailable" };
  }

  const passwordHash = await hashPassword(input.password);
  const recoveryCode = createAccountRecoveryCode();

  try {
    return await db.$transaction(async (transaction) => {
      const usernameTaken = await transaction.user.findUnique({
        where: { username: input.username },
        select: { id: true },
      });

      if (usernameTaken) {
        return { type: "username-unavailable" } as const;
      }

      const user = await transaction.user.create({
        data: {
          email: null,
          username: input.username,
          name: input.name,
          passwordHash,
          authProvider: "PASSWORD",
          role: "USER",
          status: "APPROVED",
          emailVerifiedAt: null,
          updatedAt: null,
          recoveryCode: {
            create: { codeHash: recoveryCode.codeHash },
          },
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

      return {
        type: "created",
        recoveryCode: recoveryCode.displayCode,
        sessionVersion: user.sessionVersion,
        user: {
          id: user.id,
          email: null,
          username: user.username!,
          name: user.name,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
        },
      } as const;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { type: "username-unavailable" };
    }

    throw error;
  }
}

export async function rotateAccountRecoveryCode(input: {
  userId: string;
  sessionVersion: number;
  currentPassword: string;
}) {
  const user = await db.user.findUnique({
    where: { id: input.userId, sessionVersion: input.sessionVersion },
    select: {
      id: true,
      username: true,
      passwordHash: true,
      authProvider: true,
      status: true,
    },
  });

  if (!user || user.status !== "APPROVED") {
    return { type: "unauthenticated" } as const;
  }

  if (
    !user.username ||
    !user.passwordHash ||
    !supportsPasswordAuthentication(user.authProvider)
  ) {
    return { type: "unavailable" } as const;
  }

  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    return { type: "incorrect-password" } as const;
  }

  const recoveryCode = createAccountRecoveryCode();

  await db.accountRecoveryCode.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      codeHash: recoveryCode.codeHash,
    },
    update: {
      codeHash: recoveryCode.codeHash,
      createdAt: new Date(),
    },
  });

  return { type: "rotated", recoveryCode: recoveryCode.displayCode } as const;
}
