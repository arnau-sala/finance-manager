import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { verifyPassword } from "../auth/password.js";
import { db } from "../db/client.js";
import { accountDeletionRateLimit } from "../security/rate-limit.js";

const deleteAccountBodySchema = z
  .object({
    password: z.string().min(1).max(128),
  })
  .strict();

export const accountRoutes: FastifyPluginAsync = async (app) => {
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

      const deletedUserCount = await db.$transaction(async (transaction) => {
        await transaction.accessRequest.deleteMany({
          where: { email: user.email },
        });

        await transaction.accessRequestEvent.deleteMany({
          where: { email: user.email },
        });

        await transaction.approvedEmail.deleteMany({
          where: { email: user.email },
        });

        await transaction.accessRequestEvent.updateMany({
          where: { adminId: user.id },
          data: { adminId: null },
        });

        await transaction.approvedEmail.updateMany({
          where: { approvedBy: user.id },
          data: { approvedBy: null },
        });

        const deletion = await transaction.user.deleteMany({
          where: { id: user.id },
        });

        return deletion.count;
      });

      if (deletedUserCount !== 1) {
        request.session.delete();
        return reply.code(401).send({ error: "Authentication required." });
      }

      request.session.delete();

      return reply.send({ message: "Account deleted successfully." });
    },
  );
};
