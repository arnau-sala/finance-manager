import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest
} from "fastify";
import { z } from "zod";

import { getAuthenticatedUserId } from "../auth/authenticated-user.js";
import { getUserBalance } from "../services/statistics-service.js";

const monthSchema = z.coerce.number().int().min(1).max(12);

function getBalanceParamsSchema(currentYear: number) {
  return z
    .object({
      month: monthSchema,
      year: z.coerce.number().int().min(2000).max(currentYear).optional()
    })
    .strict();
}

function getMonthDateRange(month: number, year: number) {
  return {
    from: new Date(year, month - 1, 1),
    to: new Date(year, month, 1)
  };
}

export const statisticsRoutes: FastifyPluginAsync = async (app) => {
  async function getMonthlyBalance(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    const currentYear = new Date().getFullYear();
    const parsedParams = getBalanceParamsSchema(currentYear).safeParse(
      request.params
    );

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid balance period." });
    }

    const { month, year = currentYear } = parsedParams.data;
    const balance = await getUserBalance(
      userId,
      getMonthDateRange(month, year)
    );

    return reply.send({
      balance
    });
  }

  app.get("/statistics/balance", async (request, reply) => {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    const balance = await getUserBalance(userId);

    return reply.send({
      balance
    });
  });

  app.get("/statistics/balance/:month", getMonthlyBalance);
  app.get("/statistics/balance/:month/:year", getMonthlyBalance);
};
