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
import { rotateAccountRecoveryCode } from "../auth/username-account.js";
import { db } from "../db/client.js";
import {
  accountDeletionRateLimit,
  accountRecoveryCodeRateLimit,
  accountWriteRateLimit,
  passwordChangeRateLimit,
} from "../security/rate-limit.js";

const updateProfileBodySchema = z
  .object({
    name: userNameSchema.optional(),
    startingNetWorth: startingNetWorthSchema.optional(),
  })
  .strict()
  .refine(
    (profile) =>
      profile.name !== undefined || profile.startingNetWorth !== undefined,
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
    currentPassword: z.string().min(1).max(128),
  })
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
        const user = await db.user.update({
          where: {
            id: userId,
            status: "APPROVED",
            sessionVersion,
          },
          data: {
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
        return reply.code(400).send({ error: "Current password is required." });
      }

      const result = await rotateAccountRecoveryCode({
        userId,
        sessionVersion,
        currentPassword: parsedBody.data.currentPassword,
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

      if (result.type === "incorrect-password") {
        return reply.code(401).send({ error: "Incorrect current password." });
      }

      return reply.send({
        message: "Recovery code replaced successfully.",
        recoveryCode: result.recoveryCode,
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
