import { createHash, randomBytes } from "node:crypto";

import {
  GoogleAuthActionType,
  GoogleAuthIntent,
  Prisma,
} from "@prisma/client";

import { db } from "../db/client.js";
import { supportsGoogleAuthentication } from "./auth-provider.js";
import { createLegalAcceptance } from "./legal-acceptance.js";

const GOOGLE_ACTION_TTL_MS = 10 * 60 * 1_000;

export type PublicGoogleAuthIntent = "login" | "register";

export type VerifiedGoogleIdentity = {
  email: string;
  name: string;
  googleSubject: string;
};

export type GoogleIdentityResolution =
  | { type: "authenticated"; userId: string; sessionVersion: number }
  | { type: "pending"; token: string }
  | { type: "failed" };

export type PublicGoogleAuthAction = {
  intent: PublicGoogleAuthIntent;
  action:
    | "create-account"
    | "sign-in-with-google"
    | "sign-in-with-password";
  email: string;
};

export type ConfirmGoogleAuthActionResult =
  | { type: "authenticated"; userId: string; sessionVersion: number }
  | { type: "password-required"; email: string }
  | { type: "invalid" };

class InvalidGoogleAuthActionError extends Error {}

function hashActionToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function createActionToken() {
  return randomBytes(32).toString("base64url");
}

function toDatabaseIntent(intent: PublicGoogleAuthIntent) {
  return intent === "register"
    ? GoogleAuthIntent.REGISTER
    : GoogleAuthIntent.LOGIN;
}

function toPublicIntent(intent: GoogleAuthIntent): PublicGoogleAuthIntent {
  return intent === GoogleAuthIntent.REGISTER ? "register" : "login";
}

function toPublicAction(action: GoogleAuthActionType) {
  switch (action) {
    case GoogleAuthActionType.CREATE_ACCOUNT:
      return "create-account" as const;
    case GoogleAuthActionType.SIGN_IN_WITH_GOOGLE:
      return "sign-in-with-google" as const;
    case GoogleAuthActionType.SIGN_IN_WITH_PASSWORD:
      return "sign-in-with-password" as const;
  }
}

async function createPendingAction(
  transaction: Prisma.TransactionClient,
  input: {
    intent: PublicGoogleAuthIntent;
    action: GoogleAuthActionType;
    identity: VerifiedGoogleIdentity;
    userId?: string;
  },
) {
  const token = createActionToken();

  await transaction.pendingGoogleAuthAction.create({
    data: {
      tokenHash: hashActionToken(token),
      intent: toDatabaseIntent(input.intent),
      action: input.action,
      email: input.identity.email,
      name: input.identity.name,
      googleSubject: input.identity.googleSubject,
      userId: input.userId,
      expiresAt: new Date(Date.now() + GOOGLE_ACTION_TTL_MS),
    },
  });

  return token;
}

async function claimAction(
  transaction: Prisma.TransactionClient,
  action: { id: string; tokenHash: string },
  now: Date,
) {
  const claim = await transaction.pendingGoogleAuthAction.deleteMany({
    where: {
      id: action.id,
      tokenHash: action.tokenHash,
      expiresAt: { gt: now },
    },
  });

  if (claim.count !== 1) {
    throw new InvalidGoogleAuthActionError();
  }
}

export async function resolveGoogleIdentity(
  identity: VerifiedGoogleIdentity,
  intent: PublicGoogleAuthIntent,
  legalAccepted: boolean,
): Promise<GoogleIdentityResolution> {
  const now = new Date();

  await db.pendingGoogleAuthAction.deleteMany({
    where: { expiresAt: { lte: now } },
  });

  try {
    return await db.$transaction(async (transaction) => {
      const [userByGoogleSubject, userByEmail] = await Promise.all([
        transaction.user.findUnique({
          where: { googleSubject: identity.googleSubject },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            authProvider: true,
            googleSubject: true,
            status: true,
            sessionVersion: true,
          },
        }),
        transaction.user.findUnique({
          where: { email: identity.email },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            authProvider: true,
            googleSubject: true,
            status: true,
            sessionVersion: true,
          },
        }),
      ]);

      if (
        userByGoogleSubject &&
        userByEmail &&
        userByGoogleSubject.id !== userByEmail.id
      ) {
        return { type: "failed" } as const;
      }

      const googleUser = userByGoogleSubject ?? userByEmail;

      if (googleUser) {
        const googleIdentityMatches =
          googleUser.googleSubject === identity.googleSubject &&
          supportsGoogleAuthentication(googleUser.authProvider) &&
          googleUser.status === "APPROVED";

        if (googleIdentityMatches) {
          if (intent === "login") {
            return {
              type: "authenticated",
              userId: googleUser.id,
              sessionVersion: googleUser.sessionVersion,
            } as const;
          }

          const token = await createPendingAction(transaction, {
            intent,
            action: GoogleAuthActionType.SIGN_IN_WITH_GOOGLE,
            identity,
            userId: googleUser.id,
          });

          return { type: "pending", token } as const;
        }

        const passwordIdentityMatches =
          userByEmail?.id === googleUser.id &&
          googleUser.authProvider === "PASSWORD" &&
          googleUser.googleSubject === null &&
          googleUser.passwordHash !== null &&
          googleUser.status === "APPROVED";

        if (passwordIdentityMatches) {
          const token = await createPendingAction(transaction, {
            intent,
            action: GoogleAuthActionType.SIGN_IN_WITH_PASSWORD,
            identity,
            userId: googleUser.id,
          });

          return { type: "pending", token } as const;
        }

        return { type: "failed" } as const;
      }

      if (intent === "login") {
        const token = await createPendingAction(transaction, {
          intent,
          action: GoogleAuthActionType.CREATE_ACCOUNT,
          identity,
        });

        return { type: "pending", token } as const;
      }

      if (!legalAccepted) {
        return { type: "failed" } as const;
      }

      await transaction.pendingRegistration.deleteMany({
        where: { email: identity.email },
      });

      const user = await transaction.user.create({
        data: {
          email: identity.email,
          name: identity.name,
          passwordHash: null,
          authProvider: "GOOGLE",
          googleSubject: identity.googleSubject,
          ...createLegalAcceptance(),
          role: "USER",
          status: "APPROVED",
          emailVerifiedAt: now,
          updatedAt: null,
        },
        select: { id: true, sessionVersion: true },
      });

      return {
        type: "authenticated",
        userId: user.id,
        sessionVersion: user.sessionVersion,
      } as const;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { type: "failed" };
    }

    throw error;
  }
}

export async function getPendingGoogleAuthAction(
  token: string,
): Promise<PublicGoogleAuthAction | null> {
  const tokenHash = hashActionToken(token);
  const now = new Date();
  const action = await db.pendingGoogleAuthAction.findUnique({
    where: { tokenHash },
    select: {
      intent: true,
      action: true,
      email: true,
      expiresAt: true,
    },
  });

  if (!action || action.expiresAt.getTime() <= now.getTime()) {
    await db.pendingGoogleAuthAction.deleteMany({ where: { tokenHash } });
    return null;
  }

  return {
    intent: toPublicIntent(action.intent),
    action: toPublicAction(action.action),
    email: action.email,
  };
}

export async function cancelPendingGoogleAuthAction(token: string) {
  await db.pendingGoogleAuthAction.deleteMany({
    where: { tokenHash: hashActionToken(token) },
  });
}

export async function confirmPendingGoogleAuthAction(
  token: string,
  legalAccepted: boolean,
): Promise<ConfirmGoogleAuthActionResult> {
  const tokenHash = hashActionToken(token);
  const now = new Date();

  try {
    return await db.$transaction(async (transaction) => {
      const action = await transaction.pendingGoogleAuthAction.findUnique({
        where: { tokenHash },
      });

      if (!action || action.expiresAt.getTime() <= now.getTime()) {
        throw new InvalidGoogleAuthActionError();
      }

      if (action.action === GoogleAuthActionType.SIGN_IN_WITH_GOOGLE) {
        if (!action.userId) {
          throw new InvalidGoogleAuthActionError();
        }

        const user = await transaction.user.findUnique({
          where: { id: action.userId },
          select: {
            id: true,
            authProvider: true,
            googleSubject: true,
            status: true,
            sessionVersion: true,
          },
        });

        if (
          !user ||
          user.status !== "APPROVED" ||
          user.googleSubject !== action.googleSubject ||
          !supportsGoogleAuthentication(user.authProvider)
        ) {
          throw new InvalidGoogleAuthActionError();
        }

        await claimAction(transaction, action, now);
        return {
          type: "authenticated",
          userId: user.id,
          sessionVersion: user.sessionVersion,
        } as const;
      }

      if (action.action === GoogleAuthActionType.SIGN_IN_WITH_PASSWORD) {
        if (!action.userId) {
          throw new InvalidGoogleAuthActionError();
        }

        const user = await transaction.user.findUnique({
          where: { id: action.userId },
          select: {
            email: true,
            passwordHash: true,
            authProvider: true,
            googleSubject: true,
            status: true,
          },
        });

        if (
          !user?.email ||
          user.email !== action.email ||
          user.status !== "APPROVED" ||
          user.authProvider !== "PASSWORD" ||
          user.googleSubject !== null ||
          !user.passwordHash
        ) {
          throw new InvalidGoogleAuthActionError();
        }

        await claimAction(transaction, action, now);
        return { type: "password-required", email: user.email } as const;
      }

      const [userByGoogleSubject, userByEmail] = await Promise.all([
        transaction.user.findUnique({
          where: { googleSubject: action.googleSubject },
          select: {
            id: true,
            authProvider: true,
            googleSubject: true,
            status: true,
            sessionVersion: true,
          },
        }),
        transaction.user.findUnique({
          where: { email: action.email },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            authProvider: true,
            googleSubject: true,
            status: true,
            sessionVersion: true,
          },
        }),
      ]);

      if (
        userByGoogleSubject &&
        userByEmail &&
        userByGoogleSubject.id !== userByEmail.id
      ) {
        throw new InvalidGoogleAuthActionError();
      }

      const googleUser = userByGoogleSubject ?? userByEmail;

      if (
        googleUser &&
        googleUser.status === "APPROVED" &&
        googleUser.googleSubject === action.googleSubject &&
        supportsGoogleAuthentication(googleUser.authProvider)
      ) {
        await claimAction(transaction, action, now);
        return {
          type: "authenticated",
          userId: googleUser.id,
          sessionVersion: googleUser.sessionVersion,
        } as const;
      }

      if (
        userByEmail?.status === "APPROVED" &&
        userByEmail.email === action.email &&
        userByEmail.authProvider === "PASSWORD" &&
        userByEmail.googleSubject === null &&
        userByEmail.passwordHash
      ) {
        await claimAction(transaction, action, now);
        return {
          type: "password-required",
          email: userByEmail.email,
        } as const;
      }

      if (googleUser) {
        throw new InvalidGoogleAuthActionError();
      }

      if (!legalAccepted) {
        throw new InvalidGoogleAuthActionError();
      }

      await claimAction(transaction, action, now);
      await transaction.pendingRegistration.deleteMany({
        where: { email: action.email },
      });

      const user = await transaction.user.create({
        data: {
          email: action.email,
          name: action.name,
          passwordHash: null,
          authProvider: "GOOGLE",
          googleSubject: action.googleSubject,
          ...createLegalAcceptance(),
          role: "USER",
          status: "APPROVED",
          emailVerifiedAt: now,
          updatedAt: null,
        },
        select: { id: true, sessionVersion: true },
      });

      return {
        type: "authenticated",
        userId: user.id,
        sessionVersion: user.sessionVersion,
      } as const;
    });
  } catch (error) {
    if (
      error instanceof InvalidGoogleAuthActionError ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002")
    ) {
      return { type: "invalid" };
    }

    throw error;
  }
}
