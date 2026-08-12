import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { getAuthenticatedUser } from "../auth/authenticated-user.js";
import { db } from "../db/client.js";
import { feedbackSubmitRateLimit } from "../security/rate-limit.js";

const feedbackBodySchema = z
  .object({
    type: z.enum(["general", "suggestion", "landing"]),
    message: z.string().trim().min(1).max(1000),
    name: z
      .preprocess(
        (value) =>
          typeof value === "string" && value.trim().length === 0
            ? undefined
            : value,
        z.string().trim().max(100).optional(),
      ),
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

      const result = feedbackBodySchema.safeParse(request.body);

      if (!result.success) {
        return reply.code(400).send({ error: "Invalid feedback input" });
      }

      const isLandingFeedback = result.data.type === "landing";

      if (!isLandingFeedback && !user) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const type =
        result.data.type === "landing"
          ? "LANDING"
          : result.data.type === "suggestion"
            ? "SUGGESTION"
            : "GENERAL";
      const email =
        result.data.anonymous || isLandingFeedback
          ? (result.data.email ?? null)
          : (result.data.email ?? user?.email ?? null);
      const userId =
        result.data.anonymous || isLandingFeedback ? null : (user?.id ?? null);

      await db.feedbackEntry.create({
        data: {
          type,
          message: result.data.message,
          userId,
          name: isLandingFeedback ? (result.data.name ?? null) : null,
          email,
        },
      });

      return reply.code(201).send({ status: "created" });
    },
  );
};
