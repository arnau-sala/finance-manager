import { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { deleteUserAccount } from "../account/delete-account.js";
import { startingNetWorthSchema } from "../account/starting-net-worth.js";
import {
  authenticatedUserSelect,
  getAuthenticatedUser,
  toAuthenticatedUserResponse,
} from "../auth/authenticated-user.js";
import { supportsPasswordAuthentication } from "../auth/auth-provider.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { passwordSchema } from "../auth/password-validation.js";
import { userNameSchema } from "../auth/user-validation.js";
import {
  activateAccountRecoveryCodeRotation,
  linkUsernameToAccount,
  prepareAccountRecoveryCodeRotation,
  unlinkUsernameFromAccount,
} from "../auth/username-account.js";
import { usernameSchema } from "../auth/username-validation.js";
import { db } from "../db/client.js";
import {
  accountDeletionRateLimit,
  accountLinkRateLimit,
  accountRecoveryCodeRateLimit,
  accountWriteRateLimit,
  passwordChangeRateLimit,
} from "../security/rate-limit.js";

const updateProfileBodySchema = z
  .object({
    username: usernameSchema.optional(),
    name: userNameSchema.optional(),
    startingNetWorth: startingNetWorthSchema.optional(),
  })
  .strict()
  .refine(
    (profile) =>
      profile.username !== undefined ||
      profile.name !== undefined ||
      profile.startingNetWorth !== undefined,
    {
      message: "Provide at least one profile field to update.",
    },
  );

const deleteAccountBodySchema = z
  .object({
    password: z.string().min(1).max(128),
  })
  .strict();

const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
    newPasswordConfirmation: z.string().max(128),
  })
  .strict()
  .superRefine(({ newPassword, newPasswordConfirmation }, context) => {
    if (newPassword !== newPasswordConfirmation) {
      context.addIssue({
        code: "custom",
        path: ["newPasswordConfirmation"],
        message: "Passwords do not match.",
      });
    }
  });

const rotateRecoveryCodeBodySchema = z
  .object({
    signOutOtherDevices: z.boolean().default(false),
  })
  .strict();

const activateRecoveryCodeBodySchema = z
  .object({
    rotationToken: z.string().min(32).max(128),
  })
  .strict();

const linkUsernameBodySchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema.optional(),
    passwordConfirmation: z.string().max(128).optional(),
  })
  .strict()
  .superRefine(({ password, passwordConfirmation }, context) => {
    if ((password === undefined) !== (passwordConfirmation === undefined)) {
      context.addIssue({
        code: "custom",
        path: ["passwordConfirmation"],
        message: "Provide both password fields.",
      });
      return;
    }

    if (password !== undefined && password !== passwordConfirmation) {
      context.addIssue({
        code: "custom",
        path: ["passwordConfirmation"],
        message: "Passwords do not match.",
      });
    }
  });

const unlinkUsernameBodySchema = z
  .object({ password: passwordSchema })
  .strict();

const startingNetWorthBodySchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("SET"),
      amount: startingNetWorthSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("SKIP"),
    })
    .strict(),
]);

export const accountRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/account/username/unlink",
    { config: { rateLimit: accountLinkRateLimit } },
    async (request, reply) => {
      const userId = request.session.get("userId");
      const sessionVersion = request.session.get("sessionVersion");

      if (!userId || sessionVersion === undefined) {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      const parsedBody = unlinkUsernameBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({ error: "Incorrect password." });
      }

      const result = await unlinkUsernameFromAccount({
        userId,
        sessionVersion,
        password: parsedBody.data.password,
      });

      if (result.type === "unauthenticated") {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      if (result.type === "incorrect-password") {
        return reply.code(403).send({ error: "Incorrect password." });
      }

      if (result.type === "unavailable") {
        return reply.code(409).send({
          error: "Username unlinking is unavailable for this account.",
        });
      }

      request.session.regenerate();
      request.session.set("userId", result.user.id);
      request.session.set("sessionVersion", result.user.sessionVersion);
      reply.header("Cache-Control", "private, no-store");
      return reply.send({
        message: "Username unlinked successfully.",
        user: toAuthenticatedUserResponse(result.user),
      });
    },
  );

  app.post(
    "/account/username/link",
    { config: { rateLimit: accountLinkRateLimit } },
    async (request, reply) => {
      const userId = request.session.get("userId");
      const sessionVersion = request.session.get("sessionVersion");

      if (!userId || sessionVersion === undefined) {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      const parsedBody = linkUsernameBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "Invalid username linking details.",
          issues: parsedBody.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const result = await linkUsernameToAccount({
        userId,
        sessionVersion,
        username: parsedBody.data.username,
        ...(parsedBody.data.password
          ? { password: parsedBody.data.password }
          : {}),
      });

      if (result.type === "unauthenticated") {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      if (result.type === "username-unavailable") {
        return reply.code(409).send({ error: "Username is unavailable." });
      }

      if (result.type === "password-required") {
        return reply.code(400).send({
          error: "A valid password is required for this account.",
        });
      }

      if (result.type === "unavailable") {
        return reply.code(409).send({
          error: "This account already has a username.",
        });
      }

      reply.header("Cache-Control", "private, no-store");
      return reply.code(201).send({
        message: "Username linked successfully.",
        user: toAuthenticatedUserResponse(result.user),
        recoveryCode: result.recoveryCode,
      });
    },
  );

  app.patch(
    "/account",
    { config: { rateLimit: accountWriteRateLimit } },
    async (request, reply) => {
      const userId = request.session.get("userId");
      const sessionVersion = request.session.get("sessionVersion");

      if (!userId || sessionVersion === undefined) {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      const parsedBody = updateProfileBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "Invalid profile data.",
          issues: parsedBody.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      try {
        const currentUser = await db.user.findFirst({
          where: {
            id: userId,
            status: "APPROVED",
            sessionVersion,
          },
          select: {
            id: true,
            username: true,
          },
        });

        if (!currentUser) {
          request.session.delete();
          return reply.code(401).send({ error: "Authentication required." });
        }

        if (
          parsedBody.data.username !== undefined &&
          currentUser.username === null
        ) {
          return reply.code(409).send({
            error: "This account does not have a username.",
          });
        }

        if (
          parsedBody.data.username !== undefined &&
          parsedBody.data.username !== currentUser.username
        ) {
          const existingUser = await db.user.findUnique({
            where: { username: parsedBody.data.username },
            select: { id: true },
          });

          if (existingUser && existingUser.id !== userId) {
            return reply.code(409).send({ error: "Username is unavailable." });
          }
        }

        const user = await db.user.update({
          where: {
            id: userId,
            status: "APPROVED",
            sessionVersion,
          },
          data: {
            ...(parsedBody.data.username !== undefined
              ? { username: parsedBody.data.username }
              : {}),
            ...(parsedBody.data.name !== undefined
              ? { name: parsedBody.data.name }
              : {}),
            ...(parsedBody.data.startingNetWorth !== undefined
              ? {
                  startingNetWorthCents:
                    parsedBody.data.startingNetWorth,
                }
              : {}),
          },
          select: authenticatedUserSelect,
        });

        return reply.send({
          message: "Profile updated successfully.",
          user: toAuthenticatedUserResponse(user),
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        ) {
          request.session.delete();
          return reply.code(401).send({ error: "Authentication required." });
        }

        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          return reply.code(409).send({ error: "Username is unavailable." });
        }

        throw error;
      }
    },
  );

  app.post(
    "/account/onboarding/starting-net-worth",
    { config: { rateLimit: accountWriteRateLimit } },
    async (request, reply) => {
      const user = await getAuthenticatedUser(request);

      if (!user) {
        return reply.code(401).send({ error: "Authentication required." });
      }

      const parsedBody = startingNetWorthBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({
          error:
            "Starting net worth must be between -10,000,000 and 10,000,000.",
          issues: parsedBody.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const shouldSetNetWorth = parsedBody.data.action === "SET";
      const startingNetWorthCents =
        parsedBody.data.action === "SET" ? parsedBody.data.amount : 0;

      try {
        const updatedUser = await db.user.update({
          where: {
            id: user.id,
            status: "APPROVED",
            sessionVersion: user.sessionVersion,
          },
          data: {
            startingNetWorthCents,
          },
          select: authenticatedUserSelect,
        });

        return reply.send({
          message: shouldSetNetWorth
            ? "Starting net worth saved successfully."
            : "Starting net worth setup skipped.",
          user: toAuthenticatedUserResponse(updatedUser),
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        ) {
          request.session.delete();
          return reply.code(401).send({ error: "Authentication required." });
        }

        throw error;
      }
    },
  );

  app.patch(
    "/account/password",
    { config: { rateLimit: passwordChangeRateLimit } },
    async (request, reply) => {
      const userId = request.session.get("userId");
      const sessionVersion = request.session.get("sessionVersion");

      if (!userId || sessionVersion === undefined) {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      const parsedBody = changePasswordBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "Invalid password data.",
          issues: parsedBody.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const user = await db.user.findUnique({
        where: {
          id: userId,
          status: "APPROVED",
          sessionVersion,
        },
        select: {
          id: true,
          passwordHash: true,
          authProvider: true,
          sessionVersion: true,
        },
      });

      if (!user) {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      if (
        !supportsPasswordAuthentication(user.authProvider) ||
        !user.passwordHash
      ) {
        return reply.code(400).send({
          error: "Password changes are unavailable for Google accounts.",
        });
      }

      const { currentPassword, newPassword } = parsedBody.data;
      const currentPasswordMatches = await verifyPassword(
        user.passwordHash,
        currentPassword,
      );

      if (!currentPasswordMatches) {
        return reply.code(401).send({ error: "Incorrect current password." });
      }

      if (newPassword === currentPassword) {
        return reply.code(400).send({
          error: "New password must be different from current password.",
        });
      }

      const passwordHash = await hashPassword(newPassword);

      try {
        const updatedUser = await db.user.update({
          where: {
            id: user.id,
            status: "APPROVED",
            sessionVersion: user.sessionVersion,
          },
          data: {
            passwordHash,
            sessionVersion: { increment: 1 },
          },
          select: { sessionVersion: true },
        });

        request.session.regenerate();
        request.session.set("userId", user.id);
        request.session.set("sessionVersion", updatedUser.sessionVersion);

        return reply.send({ message: "Password changed successfully." });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        ) {
          request.session.delete();
          return reply.code(401).send({ error: "Authentication required." });
        }

        throw error;
      }
    },
  );

  app.post(
    "/account/recovery-code",
    { config: { rateLimit: accountRecoveryCodeRateLimit } },
    async (request, reply) => {
      const userId = request.session.get("userId");
      const sessionVersion = request.session.get("sessionVersion");

      if (!userId || sessionVersion === undefined) {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      const parsedBody = rotateRecoveryCodeBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({ error: "Invalid recovery code options." });
      }

      const result = await prepareAccountRecoveryCodeRotation({
        userId,
        sessionVersion,
        signOutOtherDevices: parsedBody.data.signOutOtherDevices,
      });

      if (result.type === "unauthenticated") {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      if (result.type === "unavailable") {
        return reply.code(400).send({
          error: "Recovery codes are unavailable for this account.",
        });
      }

      if (result.type === "conflict") {
        return reply.code(409).send({
          error: "Recovery code changed. Please try again.",
        });
      }

      reply.header("Cache-Control", "private, no-store");
      return reply.send({
        message: "Recovery code prepared successfully.",
        recoveryCode: result.recoveryCode,
        rotationToken: result.rotationToken,
        username: result.username,
      });
    },
  );

  app.post(
    "/account/recovery-code/activate",
    { config: { rateLimit: accountRecoveryCodeRateLimit } },
    async (request, reply) => {
      const userId = request.session.get("userId");
      const sessionVersion = request.session.get("sessionVersion");

      if (!userId || sessionVersion === undefined) {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      const parsedBody = activateRecoveryCodeBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply
          .code(400)
          .send({ error: "Invalid recovery code activation." });
      }

      const result = await activateAccountRecoveryCodeRotation({
        userId,
        sessionVersion,
        rotationToken: parsedBody.data.rotationToken,
      });

      if (result.type === "unauthenticated") {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      if (result.type === "unavailable") {
        return reply.code(409).send({
          error: "This recovery code can no longer be activated.",
        });
      }

      if (result.type === "expired") {
        return reply.code(409).send({
          error: "This recovery code has expired. Create a new one.",
        });
      }

      if (result.type === "conflict") {
        return reply.code(409).send({
          error: "Recovery code changed. Please try again.",
        });
      }

      if (result.signedOutOtherDevices) {
        request.session.regenerate();
        request.session.set("userId", userId);
        request.session.set("sessionVersion", result.sessionVersion);
      }

      reply.header("Cache-Control", "private, no-store");
      return reply.send({
        message: "Recovery code replaced successfully.",
        signedOutOtherDevices: result.signedOutOtherDevices,
      });
    },
  );

  app.delete(
    "/account",
    { config: { rateLimit: accountDeletionRateLimit } },
    async (request, reply) => {
      const userId = request.session.get("userId");
      const sessionVersion = request.session.get("sessionVersion");

      if (!userId || sessionVersion === undefined) {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      const parsedBody = deleteAccountBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({ error: "Password is required." });
      }

      const user = await db.user.findUnique({
        where: { id: userId, sessionVersion },
        select: {
          id: true,
          email: true,
          authProvider: true,
          passwordHash: true,
        },
      });

      if (!user) {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      if (
        !supportsPasswordAuthentication(user.authProvider) ||
        !user.passwordHash
      ) {
        return reply.code(400).send({
          error: "Password confirmation is unavailable for Google accounts.",
        });
      }

      const passwordMatches = await verifyPassword(
        user.passwordHash,
        parsedBody.data.password,
      );

      if (!passwordMatches) {
        return reply.code(401).send({ error: "Incorrect password." });
      }

      const accountDeleted = await db.$transaction((transaction) =>
        deleteUserAccount(transaction, user),
      );

      if (!accountDeleted) {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      request.session.delete();

      return reply.send({ message: "Account deleted successfully." });
    },
  );
};
