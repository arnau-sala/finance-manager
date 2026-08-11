import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { getAuthenticatedUser } from "../auth/authenticated-user.js";
import { db } from "../db/client.js";
import { feedbackSubmitRateLimit } from "../security/rate-limit.js";

const feedbackBodySchema = z
  .object({
    type: z.enum(["general", "suggestion"]),
    message: z.string().trim().min(1).max(1000),
    email: z
      .preprocess(
        (value) =>
          typeof value === "string" && value.trim().length === 0
            ? undefined
            : value,
        z.string().trim().email().max(254).optional(),
      ),
    anonymous: z.boolean().default(false),
  })
  .strict();

export const feedbackRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/feedback",
    { config: { rateLimit: feedbackSubmitRateLimit } },
    async (request, reply) => {
      const user = await getAuthenticatedUser(request);

      if (!user) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const result = feedbackBodySchema.safeParse(request.body);

      if (!result.success) {
        return reply.code(400).send({ error: "Invalid feedback input" });
      }

      const type =
        result.data.type === "suggestion" ? "SUGGESTION" : "GENERAL";
      const email = result.data.anonymous
        ? null
        : (result.data.email ?? user.email ?? null);

      await db.feedbackEntry.create({
        data: {
          type,
          message: result.data.message,
          userId: result.data.anonymous ? null : user.id,
          email,
        },
      });

      return reply.code(201).send({ status: "created" });
    },
  );
};
