import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { getAuthenticatedUserId } from "../auth/authenticated-user.js";
import {
  getTodayDateOnly,
  getMonthDateOnlyRange,
  getYearDateOnlyRange,
} from "../dates/date-only.js";
import {
  getUserBalance,
  getUserCategoryStatistics,
  getUserTransactionMonths,
} from "../services/statistics-service.js";
import {
  getStatisticsCharts,
  getStatisticsOverview,
} from "../services/statistics-report-service.js";
import type { StatisticsPeriodSelection } from "../services/statistics-period.js";
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

const statisticsReportQuerySchema = z
  .object({
    period: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.enum(["month", "year", "all"]))
      .default("month"),
    month: z
      .string()
      .trim()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional(),
    year: z.coerce.number().int().min(2000).optional(),
  })
  .strict();

function parseStatisticsPeriod(
  query: unknown,
  today: string,
): StatisticsPeriodSelection | null {
  const parsedQuery = statisticsReportQuerySchema.safeParse(query);

  if (!parsedQuery.success) {
    return null;
  }

  const currentMonth = today.slice(0, 7);
  const currentYear = Number(today.slice(0, 4));
  const { period, month, year } = parsedQuery.data;

  if (period === "month") {
    if (year !== undefined) {
      return null;
    }

    const selectedMonth = month ?? currentMonth;

    return selectedMonth <= currentMonth
      ? { mode: "MONTH", month: selectedMonth }
      : null;
  }

  if (period === "year") {
    if (month !== undefined) {
      return null;
    }

    const selectedYear = year ?? currentYear;

    return selectedYear <= currentYear
      ? { mode: "YEAR", year: selectedYear }
      : null;
  }

  if (month !== undefined || year !== undefined) {
    return null;
  }

  return { mode: "ALL" };
}

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

export const statisticsRoutes: FastifyPluginAsync = async (app) => {
  async function getMonthlyBalance(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return reply.code(401).send({ error: "Authentication required" });
    }

    const currentYear = new Date().getFullYear();
    const parsedParams = getMonthlyBalanceParamsSchema(currentYear).safeParse(
      request.params,
    );

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid balance period" });
    }

    const { month, year = currentYear } = parsedParams.data;
    const balance = await getUserBalance(
      userId,
      getMonthDateOnlyRange(month, year),
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
      return reply.code(401).send({ error: "Authentication required" });
    }

    const currentYear = new Date().getFullYear();
    const parsedParams = getYearlyBalanceParamsSchema(currentYear).safeParse(
      request.params,
    );

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid balance period" });
    }

    const { year = currentYear } = parsedParams.data;
    const balance = await getUserBalance(
      userId,
      getYearDateOnlyRange(year),
    );

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
      return reply.code(401).send({ error: "Authentication required" });
    }

    const currentYear = new Date().getFullYear();
    const parsedParams = categoryStatisticsMonthlyParamsSchema
      .extend({
        year: z.coerce.number().int().min(2000).max(currentYear).optional(),
      })
      .safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid category period" });
    }

    const { month, year = currentYear } = parsedParams.data;
    const categories = await getUserCategoryStatistics(
      userId,
      undefined,
      getMonthDateOnlyRange(month, year),
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
      return reply.code(401).send({ error: "Authentication required" });
    }

    const currentYear = new Date().getFullYear();
    const parsedParams = typedMonthlyCategoryStatisticsParamsSchema
      .extend({
        year: z.coerce.number().int().min(2000).max(currentYear).optional(),
      })
      .safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid category period" });
    }

    const { type, month, year = currentYear } = parsedParams.data;
    const categories = await getUserCategoryStatistics(
      userId,
      type,
      getMonthDateOnlyRange(month, year),
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
      return reply.code(401).send({ error: "Authentication required" });
    }

    const currentYear = new Date().getFullYear();
    const parsedParams = getYearlyBalanceParamsSchema(currentYear).safeParse(
      request.params,
    );

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid category period" });
    }

    const { year = currentYear } = parsedParams.data;
    const categories = await getUserCategoryStatistics(
      userId,
      undefined,
      getYearDateOnlyRange(year),
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
      return reply.code(401).send({ error: "Authentication required" });
    }

    const currentYear = new Date().getFullYear();
    const parsedParams = typedYearlyCategoryStatisticsParamsSchema
      .extend({
        year: z.coerce.number().int().min(2000).max(currentYear).optional(),
      })
      .safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid category period" });
    }

    const { type, year = currentYear } = parsedParams.data;
    const categories = await getUserCategoryStatistics(
      userId,
      type,
      getYearDateOnlyRange(year),
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
      return reply.code(401).send({ error: "Authentication required" });
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
      return reply.code(401).send({ error: "Authentication required" });
    }

    const parsedParams = categoryTypeParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid category type" });
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
    "/statistics/months",
    { config: { rateLimit: financialReadRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const today = getTodayDateOnly();
      const availableMonths = await getUserTransactionMonths(userId, today);

      return reply
        .header("Cache-Control", "private, no-store")
        .send({
          availableMonths,
          minimumMonth: availableMonths[0] ?? null,
          maximumMonth: today.slice(0, 7),
        });
    },
  );

  app.get(
    "/statistics/overview",
    { config: { rateLimit: financialReadRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const today = getTodayDateOnly();
      const period = parseStatisticsPeriod(request.query, today);

      if (!period) {
        return reply.code(400).send({ error: "Invalid statistics period" });
      }

      const overview = await getStatisticsOverview(userId, period, today);

      return reply
        .header("Cache-Control", "private, no-store")
        .send({ overview });
    },
  );

  app.get(
    "/statistics/charts",
    { config: { rateLimit: financialReadRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const today = getTodayDateOnly();
      const period = parseStatisticsPeriod(request.query, today);

      if (!period) {
        return reply.code(400).send({ error: "Invalid statistics period" });
      }

      const charts = await getStatisticsCharts(userId, period, today);

      return reply
        .header("Cache-Control", "private, no-store")
        .send({ charts });
    },
  );

  app.get(
    "/statistics/balance",
    { config: { rateLimit: financialReadRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
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
