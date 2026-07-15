import { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { deleteUserAccount } from "../account/delete-account.js";
import { authenticatedUserSelect } from "../auth/authenticated-user.js";
import { verifyPassword } from "../auth/password.js";
import { userNameSchema } from "../auth/user-validation.js";
import { db } from "../db/client.js";
import {
  accountDeletionRateLimit,
  accountWriteRateLimit,
} from "../security/rate-limit.js";

const updateProfileBodySchema = z
  .object({
    name: userNameSchema,
  })
  .strict();

const deleteAccountBodySchema = z
  .object({
    password: z.string().min(1).max(128),
  })
  .strict();

export const accountRoutes: FastifyPluginAsync = async (app) => {
  app.patch(
    "/account",
    { config: { rateLimit: accountWriteRateLimit } },
    async (request, reply) => {
      const userId = request.session.get("userId");

      if (!userId) {
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
          },
          data: {
            name: parsedBody.data.name,
          },
          select: authenticatedUserSelect,
        });

        return reply.send({
          message: "Profile updated successfully.",
          user,
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

  app.delete(
    "/account",
    { config: { rateLimit: accountDeletionRateLimit } },
    async (request, reply) => {
      const userId = request.session.get("userId");

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required." });
      }

      const parsedBody = deleteAccountBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({ error: "Password is required." });
      }

      const user = await db.user.findUnique({
        where: { id: userId },
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

      if (user.authProvider !== "PASSWORD" || !user.passwordHash) {
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
