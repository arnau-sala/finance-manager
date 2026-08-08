import { db } from "../db/client.js";
import { supportsGoogleAuthentication } from "../auth/auth-provider.js";
import type { VerifiedGoogleIdentity } from "../auth/google-auth-flow.js";

export type GoogleAccountUnlinkResult =
  | { type: "success"; sessionVersion: number }
  | { type: "mismatch" }
  | { type: "unavailable" }
  | { type: "unauthenticated" };

export async function unlinkGoogleIdentityFromUser(input: {
  identity: VerifiedGoogleIdentity;
  userId: string;
  sessionVersion: number;
}): Promise<GoogleAccountUnlinkResult> {
  return db.$transaction(async (transaction) => {
    const user = await transaction.user.findUnique({
      where: {
        id: input.userId,
        sessionVersion: input.sessionVersion,
      },
      select: {
        id: true,
        email: true,
        username: true,
        passwordHash: true,
        emailLoginEnabled: true,
        authProvider: true,
        googleSubject: true,
        status: true,
      },
    });

    if (!user || user.status !== "APPROVED") {
      return { type: "unauthenticated" };
    }

    if (
      !supportsGoogleAuthentication(user.authProvider) ||
      !user.googleSubject ||
      !user.passwordHash ||
      (!user.emailLoginEnabled && !user.username)
    ) {
      return { type: "unavailable" };
    }

    if (
      user.googleSubject !== input.identity.googleSubject ||
      user.email !== input.identity.email
    ) {
      return { type: "mismatch" };
    }

    await transaction.pendingGoogleAuthAction.deleteMany({
      where: { userId: user.id },
    });

    const nextSessionVersion = input.sessionVersion + 1;
    const update = await transaction.user.updateMany({
      where: {
        id: user.id,
        sessionVersion: input.sessionVersion,
        status: "APPROVED",
        googleSubject: user.googleSubject,
      },
      data: {
        googleSubject: null,
        authProvider: "PASSWORD",
        sessionVersion: nextSessionVersion,
        ...(user.emailLoginEnabled
          ? {}
          : {
              email: null,
              emailVerifiedAt: null,
            }),
      },
    });

    return update.count === 1
      ? { type: "success", sessionVersion: nextSessionVersion }
      : { type: "unavailable" };
  });
}
