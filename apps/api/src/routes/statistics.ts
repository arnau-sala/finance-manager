import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { getAuthenticatedUserId } from "../auth/authenticated-user.js";
import {
  getUserBalance,
  getUserCategoryStatistics,
} from "../services/statistics-service.js";
import { financialReadRateLimit } from "../security/rate-limit.js";

const monthSchema = z.coerce.number().int().min(1).max(12);
const categoryTypeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.enum(["INCOME", "EXPENSE"]));

const categoryTypeParamsSchema = z
  .object({
    type: categoryTypeSchema,
  })
  .strict();

const categoryStatisticsMonthlyParamsSchema = z
  .object({
    month: monthSchema,
    year: z.coerce.number().int().min(2000).optional(),
  })
  .strict();

const typedMonthlyCategoryStatisticsParamsSchema = z
  .object({
    type: categoryTypeSchema,
    month: monthSchema,
    year: z.coerce.number().int().min(2000).optional(),
  })
  .strict();

const typedYearlyCategoryStatisticsParamsSchema = z
  .object({
    type: categoryTypeSchema,
    year: z.coerce.number().int().min(2000).optional(),
  })
  .strict();

function getMonthlyBalanceParamsSchema(currentYear: number) {
  return z
    .object({
      month: monthSchema,
      year: z.coerce.number().int().min(2000).max(currentYear).optional(),
    })
    .strict();
}

function getYearlyBalanceParamsSchema(currentYear: number) {
  return z
    .object({
      year: z.coerce.number().int().min(2000).max(currentYear).optional(),
    })
    .strict();
}

function getMonthDateRange(month: number, year: number) {
  return {
    from: new Date(year, month - 1, 1),
    to: new Date(year, month, 1),
  };
}

function getYearDateRange(year: number) {
  return {
    from: new Date(year, 0, 1),
    to: new Date(year + 1, 0, 1),
  };
}

export const statisticsRoutes: FastifyPluginAsync = async (app) => {
  async function getMonthlyBalance(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    const currentYear = new Date().getFullYear();
    const parsedParams = getMonthlyBalanceParamsSchema(currentYear).safeParse(
      request.params,
    );

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid balance period." });
    }

    const { month, year = currentYear } = parsedParams.data;
    const balance = await getUserBalance(
      userId,
      getMonthDateRange(month, year),
    );

    return reply.send({
      balance,
    });
  }

  async function getYearlyBalance(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    const currentYear = new Date().getFullYear();
    const parsedParams = getYearlyBalanceParamsSchema(currentYear).safeParse(
      request.params,
    );

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid balance period." });
    }

    const { year = currentYear } = parsedParams.data;
    const balance = await getUserBalance(userId, getYearDateRange(year));

    return reply.send({
      balance,
    });
  }

  async function getMonthlyCategoryStatistics(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    const currentYear = new Date().getFullYear();
    const parsedParams = categoryStatisticsMonthlyParamsSchema
      .extend({
        year: z.coerce.number().int().min(2000).max(currentYear).optional(),
      })
      .safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid category period." });
    }

    const { month, year = currentYear } = parsedParams.data;
    const categories = await getUserCategoryStatistics(
      userId,
      undefined,
      getMonthDateRange(month, year),
    );

    return reply.send({
      categories,
    });
  }

  async function getTypedMonthlyCategoryStatistics(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    const currentYear = new Date().getFullYear();
    const parsedParams = typedMonthlyCategoryStatisticsParamsSchema
      .extend({
        year: z.coerce.number().int().min(2000).max(currentYear).optional(),
      })
      .safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid category period." });
    }

    const { type, month, year = currentYear } = parsedParams.data;
    const categories = await getUserCategoryStatistics(
      userId,
      type,
      getMonthDateRange(month, year),
    );

    return reply.send({
      categories,
    });
  }

  async function getYearlyCategoryStatistics(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    const currentYear = new Date().getFullYear();
    const parsedParams = getYearlyBalanceParamsSchema(currentYear).safeParse(
      request.params,
    );

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid category period." });
    }

    const { year = currentYear } = parsedParams.data;
    const categories = await getUserCategoryStatistics(
      userId,
      undefined,
      getYearDateRange(year),
    );

    return reply.send({
      categories,
    });
  }

  async function getTypedYearlyCategoryStatistics(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    const currentYear = new Date().getFullYear();
    const parsedParams = typedYearlyCategoryStatisticsParamsSchema
      .extend({
        year: z.coerce.number().int().min(2000).max(currentYear).optional(),
      })
      .safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid category period." });
    }

    const { type, year = currentYear } = parsedParams.data;
    const categories = await getUserCategoryStatistics(
      userId,
      type,
      getYearDateRange(year),
    );

    return reply.send({
      categories,
    });
  }

  async function getCategoryStatistics(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    const categories = await getUserCategoryStatistics(userId);

    return reply.send({
      categories,
    });
  }

  async function getTypedCategoryStatistics(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    const parsedParams = categoryTypeParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid category type." });
    }

    const categories = await getUserCategoryStatistics(
      userId,
      parsedParams.data.type,
    );

    return reply.send({
      categories,
    });
  }

  app.get(
    "/statistics/balance",
    { config: { rateLimit: financialReadRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required." });
      }

      const balance = await getUserBalance(userId);

      return reply.send({
        balance,
      });
    },
  );

  app.get(
    "/statistics/balance/year",
    { config: { rateLimit: financialReadRateLimit } },
    getYearlyBalance,
  );
  app.get(
    "/statistics/balance/year/:year",
    { config: { rateLimit: financialReadRateLimit } },
    getYearlyBalance,
  );
  app.get(
    "/statistics/balance/:month",
    { config: { rateLimit: financialReadRateLimit } },
    getMonthlyBalance,
  );
  app.get(
    "/statistics/balance/:month/:year",
    { config: { rateLimit: financialReadRateLimit } },
    getMonthlyBalance,
  );
  app.get(
    "/statistics/categories",
    { config: { rateLimit: financialReadRateLimit } },
    getCategoryStatistics,
  );
  app.get(
    "/statistics/categories/type/:type",
    { config: { rateLimit: financialReadRateLimit } },
    getTypedCategoryStatistics,
  );
  app.get(
    "/statistics/categories/year",
    { config: { rateLimit: financialReadRateLimit } },
    getYearlyCategoryStatistics,
  );
  app.get(
    "/statistics/categories/year/:year",
    { config: { rateLimit: financialReadRateLimit } },
    getYearlyCategoryStatistics,
  );
  app.get(
    "/statistics/categories/type/:type/year/:year",
    { config: { rateLimit: financialReadRateLimit } },
    getTypedYearlyCategoryStatistics,
  );
  app.get(
    "/statistics/categories/type/:type/year",
    { config: { rateLimit: financialReadRateLimit } },
    getTypedYearlyCategoryStatistics,
  );
  app.get(
    "/statistics/categories/type/:type/:month/:year",
    { config: { rateLimit: financialReadRateLimit } },
    getTypedMonthlyCategoryStatistics,
  );
  app.get(
    "/statistics/categories/type/:type/:month",
    { config: { rateLimit: financialReadRateLimit } },
    getTypedMonthlyCategoryStatistics,
  );
  app.get(
    "/statistics/categories/:month/:year",
    { config: { rateLimit: financialReadRateLimit } },
    getMonthlyCategoryStatistics,
  );
  app.get(
    "/statistics/categories/:month",
    { config: { rateLimit: financialReadRateLimit } },
    getMonthlyCategoryStatistics,
  );
};
