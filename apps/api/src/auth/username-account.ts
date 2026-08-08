import { createHash, randomBytes } from "node:crypto";

import { Prisma } from "@prisma/client";

import { db } from "../db/client.js";
import { authenticatedUserSelect } from "./authenticated-user.js";
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

export async function linkUsernameToAccount(input: {
  userId: string;
  sessionVersion: number;
  username: string;
  password?: string;
}) {
  const currentUser = await db.user.findUnique({
    where: { id: input.userId, sessionVersion: input.sessionVersion },
    select: {
      username: true,
      passwordHash: true,
      status: true,
    },
  });

  if (!currentUser || currentUser.status !== "APPROVED") {
    return { type: "unauthenticated" } as const;
  }

  if (currentUser.username) {
    return { type: "unavailable" } as const;
  }

  if (!currentUser.passwordHash && !input.password) {
    return { type: "password-required" } as const;
  }

  const newPasswordHash = currentUser.passwordHash
    ? null
    : await hashPassword(input.password!);
  const recoveryCode = createAccountRecoveryCode();

  try {
    return await db.$transaction(async (transaction) => {
      const [activeUser, usernameOwner] = await Promise.all([
        transaction.user.findUnique({
          where: {
            id: input.userId,
            sessionVersion: input.sessionVersion,
          },
          select: {
            username: true,
            passwordHash: true,
            googleSubject: true,
            status: true,
            recoveryCode: { select: { id: true } },
          },
        }),
        transaction.user.findUnique({
          where: { username: input.username },
          select: { id: true },
        }),
      ]);

      if (!activeUser || activeUser.status !== "APPROVED") {
        return { type: "unauthenticated" } as const;
      }

      if (activeUser.username || activeUser.recoveryCode) {
        return { type: "unavailable" } as const;
      }

      if (usernameOwner) {
        return { type: "username-unavailable" } as const;
      }

      const passwordHash = activeUser.passwordHash ?? newPasswordHash;

      if (!passwordHash) {
        return { type: "password-required" } as const;
      }

      const user = await transaction.user.update({
        where: {
          id: input.userId,
          sessionVersion: input.sessionVersion,
          status: "APPROVED",
        },
        data: {
          username: input.username,
          passwordHash,
          authProvider: activeUser.googleSubject
            ? "PASSWORD_AND_GOOGLE"
            : "PASSWORD",
          recoveryCode: {
            create: { codeHash: recoveryCode.codeHash },
          },
        },
        select: authenticatedUserSelect,
      });

      return {
        type: "linked",
        recoveryCode: recoveryCode.displayCode,
        user,
      } as const;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { type: "username-unavailable" } as const;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { type: "unauthenticated" } as const;
    }

    throw error;
  }
}

export async function unlinkUsernameFromAccount(input: {
  userId: string;
  sessionVersion: number;
  password: string;
}) {
  const currentUser = await db.user.findUnique({
    where: { id: input.userId, sessionVersion: input.sessionVersion },
    select: {
      username: true,
      passwordHash: true,
      emailLoginEnabled: true,
      googleSubject: true,
      status: true,
    },
  });

  if (!currentUser || currentUser.status !== "APPROVED") {
    return { type: "unauthenticated" } as const;
  }

  if (
    !currentUser.username ||
    !currentUser.passwordHash ||
    (!currentUser.emailLoginEnabled && !currentUser.googleSubject)
  ) {
    return { type: "unavailable" } as const;
  }

  if (!(await verifyPassword(currentUser.passwordHash, input.password))) {
    return { type: "incorrect-password" } as const;
  }

  return db.$transaction(async (transaction) => {
    const activeUser = await transaction.user.findUnique({
      where: { id: input.userId, sessionVersion: input.sessionVersion },
      select: {
        username: true,
        passwordHash: true,
        emailLoginEnabled: true,
        googleSubject: true,
        status: true,
      },
    });

    if (!activeUser || activeUser.status !== "APPROVED") {
      return { type: "unauthenticated" } as const;
    }

    if (
      !activeUser.username ||
      activeUser.passwordHash !== currentUser.passwordHash ||
      (!activeUser.emailLoginEnabled && !activeUser.googleSubject)
    ) {
      return { type: "unavailable" } as const;
    }

    await transaction.accountRecoveryCode.deleteMany({
      where: { userId: input.userId },
    });

    const user = await transaction.user.update({
      where: {
        id: input.userId,
        sessionVersion: input.sessionVersion,
        status: "APPROVED",
      },
      data: {
        username: null,
        sessionVersion: { increment: 1 },
        ...(activeUser.emailLoginEnabled
          ? {
              authProvider: activeUser.googleSubject
                ? "PASSWORD_AND_GOOGLE"
                : "PASSWORD",
            }
          : {
              passwordHash: null,
              authProvider: "GOOGLE",
            }),
      },
      select: authenticatedUserSelect,
    });

    return { type: "unlinked", user } as const;
  });
}

const recoveryCodeRotationLifetimeMs = 10 * 60 * 1000;

function hashRotationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function prepareAccountRecoveryCodeRotation(input: {
  userId: string;
  sessionVersion: number;
  signOutOtherDevices: boolean;
}) {
  const recoveryCode = createAccountRecoveryCode();
  const rotationToken = randomBytes(32).toString("base64url");
  const rotationTokenHash = hashRotationToken(rotationToken);
  const rotationExpiresAt = new Date(
    Date.now() + recoveryCodeRotationLifetimeMs,
  );

  try {
    return await db.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { id: input.userId, sessionVersion: input.sessionVersion },
        select: {
          id: true,
          username: true,
          status: true,
          sessionVersion: true,
          recoveryCode: {
            select: {
              id: true,
              codeHash: true,
            },
          },
        },
      });

      if (!user || user.status !== "APPROVED") {
        return { type: "unauthenticated" } as const;
      }

      if (!user.username || !user.recoveryCode) {
        return { type: "unavailable" } as const;
      }

      const preparedCode = await transaction.accountRecoveryCode.updateMany({
        where: {
          id: user.recoveryCode.id,
          userId: user.id,
          codeHash: user.recoveryCode.codeHash,
        },
        data: {
          pendingCodeHash: recoveryCode.codeHash,
          pendingRotationTokenHash: rotationTokenHash,
          pendingRotationExpiresAt: rotationExpiresAt,
          pendingSignOutOtherDevices: input.signOutOtherDevices,
        },
      });

      if (preparedCode.count !== 1) {
        throw new RecoveryCodeRotationConflictError();
      }

      return {
        type: "prepared",
        recoveryCode: recoveryCode.displayCode,
        rotationToken,
        username: user.username,
      } as const;
    });
  } catch (error) {
    if (error instanceof RecoveryCodeRotationConflictError) {
      return { type: "conflict" } as const;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { type: "unauthenticated" } as const;
    }

    throw error;
  }
}

export async function activateAccountRecoveryCodeRotation(input: {
  userId: string;
  sessionVersion: number;
  rotationToken: string;
}) {
  const rotationTokenHash = hashRotationToken(input.rotationToken);
  const activatedAt = new Date();

  try {
    return await db.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { id: input.userId, sessionVersion: input.sessionVersion },
        select: {
          id: true,
          username: true,
          status: true,
          sessionVersion: true,
          recoveryCode: {
            select: {
              id: true,
              pendingCodeHash: true,
              pendingRotationTokenHash: true,
              pendingRotationExpiresAt: true,
              pendingSignOutOtherDevices: true,
            },
          },
        },
      });

      if (!user || user.status !== "APPROVED") {
        return { type: "unauthenticated" } as const;
      }

      const pendingRotation = user.recoveryCode;

      if (
        !user.username ||
        !pendingRotation?.pendingCodeHash ||
        !pendingRotation.pendingRotationTokenHash ||
        !pendingRotation.pendingRotationExpiresAt ||
        pendingRotation.pendingRotationTokenHash !== rotationTokenHash
      ) {
        return { type: "unavailable" } as const;
      }

      if (pendingRotation.pendingRotationExpiresAt <= activatedAt) {
        await transaction.accountRecoveryCode.update({
          where: { id: pendingRotation.id },
          data: {
            pendingCodeHash: null,
            pendingRotationTokenHash: null,
            pendingRotationExpiresAt: null,
            pendingSignOutOtherDevices: false,
          },
        });
        return { type: "expired" } as const;
      }

      const activatedCode = await transaction.accountRecoveryCode.updateMany({
        where: {
          id: pendingRotation.id,
          userId: user.id,
          pendingCodeHash: pendingRotation.pendingCodeHash,
          pendingRotationTokenHash: rotationTokenHash,
        },
        data: {
          codeHash: pendingRotation.pendingCodeHash,
          createdAt: activatedAt,
          pendingCodeHash: null,
          pendingRotationTokenHash: null,
          pendingRotationExpiresAt: null,
          pendingSignOutOtherDevices: false,
        },
      });

      if (activatedCode.count !== 1) {
        throw new RecoveryCodeRotationConflictError();
      }

      let sessionVersion = user.sessionVersion;

      if (pendingRotation.pendingSignOutOtherDevices) {
        const updatedUser = await transaction.user.update({
          where: {
            id: user.id,
            status: "APPROVED",
            sessionVersion: user.sessionVersion,
          },
          data: {
            sessionVersion: { increment: 1 },
          },
          select: { sessionVersion: true },
        });
        sessionVersion = updatedUser.sessionVersion;
      }

      return {
        type: "activated",
        sessionVersion,
        signedOutOtherDevices: pendingRotation.pendingSignOutOtherDevices,
      } as const;
    });
  } catch (error) {
    if (error instanceof RecoveryCodeRotationConflictError) {
      return { type: "conflict" } as const;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { type: "unauthenticated" } as const;
    }

    throw error;
  }
}

class RecoveryCodeRotationConflictError extends Error {}
