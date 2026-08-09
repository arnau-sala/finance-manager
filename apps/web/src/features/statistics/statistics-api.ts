import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import {
  financialQueryKeys,
  type StatisticsPeriodCacheKey
} from "../../cache/financial-query-keys";
import {
  FINANCIAL_DATA_GC_TIME_MS,
  FINANCIAL_DATA_STALE_TIME_MS,
  STATISTICS_AVAILABILITY_STALE_TIME_MS
} from "../../cache/query-client";

const moneySchema = z
  .string()
  .regex(/^-?\d+\.\d{2}$/)
  .transform(Number);
const dateSchema = z.iso.date();
const periodModeSchema = z.enum(["MONTH", "YEAR", "ALL"]);
const transactionTypeSchema = z.enum(["INCOME", "EXPENSE"]);

const periodSchema = z.object({
  mode: periodModeSchema,
  key: z.string(),
  startDate: dateSchema,
  endDate: dateSchema
});

const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: transactionTypeSchema,
  amount: moneySchema,
  percentage: z.number(),
  transactionCount: z.number().int().nonnegative(),
  averageAmount: moneySchema
});

const movementSchema = z
  .object({
    id: z.string(),
    type: transactionTypeSchema,
    categoryId: z.string(),
    category: z.object({
      id: z.string(),
      name: z.string(),
      type: transactionTypeSchema
    }),
    amount: moneySchema,
    description: z.string(),
    date: dateSchema
  })
  .nullable();

const extremeSchema = z
  .object({
    key: z.string(),
    balance: moneySchema,
    savingsPercentage: z.number().int()
  })
  .nullable();

const collectionSummarySchema = z
  .object({
    positivePeriods: z.number().int().nonnegative(),
    totalPeriods: z.number().int().nonnegative(),
    positivePercentage: z.number().int(),
    averageBalance: moneySchema,
    averageSavingsPercentage: z.number().int().nullable()
  })
  .nullable();

const streakSchema = z.object({
  days: z.number().int().nonnegative(),
  startDate: dateSchema.nullable(),
  endDate: dateSchema.nullable()
});

const currentStreakSchema = streakSchema.extend({
  lastExpenseDate: dateSchema.nullable()
});

const netWorthSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("OPENING_BALANCE_REQUIRED"),
    points: z.array(z.never())
  }),
  z.object({
    status: z.literal("READY"),
    openingAmount: moneySchema,
    points: z.array(
      z.object({
        date: dateSchema,
        value: moneySchema
      })
    )
  })
]);

const overviewResponseSchema = z.object({
  overview: z.object({
    period: periodSchema,
    money: z.object({
      income: moneySchema,
      expenses: moneySchema,
      balance: moneySchema,
      savingsPercentage: z.number().int().nullable()
    }),
    categories: z.array(categorySchema),
    insights: z.object({
      largestIncome: movementSchema,
      largestExpense: movementSchema,
      bestMonth: extremeSchema,
      worstMonth: extremeSchema,
      bestYear: extremeSchema,
      worstYear: extremeSchema,
      months: collectionSummarySchema,
      years: collectionSummarySchema
    }),
    expenses: z.object({
      hasExpenseHistory: z.boolean(),
      transactionCount: z.number().int().nonnegative(),
      typicalAmount: moneySchema,
      averageAmount: moneySchema,
      averagePeriodCount: z.number().int().nonnegative(),
      averagePeriodUnit: z.enum(["DAY", "MONTH", "YEAR"]),
      currentStreak: currentStreakSchema.nullable(),
      longestStreak: streakSchema,
      isLongestCurrent: z.boolean()
    })
  })
});

const chartsResponseSchema = z.object({
  charts: z.object({
    period: periodSchema,
    netWorth: netWorthSchema,
    financialIntervals: z.array(
      z.object({
        key: z.string(),
        startDate: dateSchema,
        endDate: dateSchema,
        income: moneySchema,
        expenses: moneySchema,
        balance: moneySchema
      })
    ),
    categories: z.array(categorySchema),
    categoryTimeline: z.object({
      intervals: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          startDate: dateSchema,
          endDate: dateSchema
        })
      ),
      cells: z.array(
        z.object({
          categoryId: z.string(),
          type: transactionTypeSchema,
          intervalKey: z.string(),
          amount: moneySchema,
          percentage: z.number().nonnegative(),
          transactionCount: z.number().int().nonnegative()
        })
      )
    }),
    weekdaySpending: z.object({
      hasEnoughData: z.boolean(),
      values: z.array(
        z.object({
          weekday: z.number().int().min(1).max(7),
          averageAmount: moneySchema,
          totalAmount: moneySchema,
          transactionCount: z.number().int().nonnegative()
        })
      )
    })
  })
});

const availabilityResponseSchema = z.object({
  availableMonths: z.array(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)),
  minimumMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .nullable(),
  maximumMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
});

export type StatisticsPeriodMode = "MONTH" | "YEAR" | "ALL";
export type StatisticsPeriodRequest =
  | { mode: "MONTH"; month: string }
  | { mode: "YEAR"; year: number }
  | { mode: "ALL" };
export type StatisticsOverview = z.infer<
  typeof overviewResponseSchema
>["overview"];
export type StatisticsCharts = z.infer<typeof chartsResponseSchema>["charts"];
export type StatisticsAvailability = z.infer<
  typeof availabilityResponseSchema
>;

export class StatisticsApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "StatisticsApiError";
    this.status = status;
  }
}

function getPeriodQuery(period: StatisticsPeriodRequest) {
  const query = new URLSearchParams({
    period: period.mode.toLowerCase()
  });

  if (period.mode === "MONTH") {
    query.set("month", period.month);
  } else if (period.mode === "YEAR") {
    query.set("year", String(period.year));
  }

  return query.toString();
}

function getPeriodCacheKey(
  period: StatisticsPeriodRequest
): StatisticsPeriodCacheKey {
  if (period.mode === "MONTH") {
    return { mode: "MONTH", month: period.month };
  }

  if (period.mode === "YEAR") {
    return { mode: "YEAR", year: period.year };
  }

  return { mode: "ALL" };
}

async function getJson(
  path: string,
  signal: AbortSignal | undefined,
  errorMessage: string
) {
  let response: Response;

  try {
    response = await fetch(path, {
      method: "GET",
      credentials: "include",
      signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new StatisticsApiError(errorMessage, 0);
  }

  if (!response.ok) {
    throw new StatisticsApiError(errorMessage, response.status);
  }

  return response.json();
}

export async function getStatisticsAvailability(
  _ownerId: string,
  signal?: AbortSignal
) {
  const rawResponse = await getJson(
    "/api/statistics/months",
    signal,
        "Unable to load available statistics periods"
  );
  return availabilityResponseSchema.parse(rawResponse);
}

export async function getStatisticsOverview(
  _ownerId: string,
  period: StatisticsPeriodRequest,
  signal?: AbortSignal
) {
  const periodQuery = getPeriodQuery(period);
  const rawResponse = await getJson(
    `/api/statistics/overview?${periodQuery}`,
    signal,
        "Unable to load your statistics"
  );
  return overviewResponseSchema.parse(rawResponse).overview;
}

export async function getStatisticsCharts(
  _ownerId: string,
  period: StatisticsPeriodRequest,
  signal?: AbortSignal
) {
  const periodQuery = getPeriodQuery(period);
  const rawResponse = await getJson(
    `/api/statistics/charts?${periodQuery}`,
    signal,
        "Unable to load your charts"
  );
  return chartsResponseSchema.parse(rawResponse).charts;
}

export function statisticsAvailabilityQueryOptions(ownerId: string) {
  return queryOptions({
    queryKey: financialQueryKeys.statisticsAvailability(ownerId),
    queryFn: ({ signal }) =>
      getStatisticsAvailability(ownerId, signal),
    staleTime: STATISTICS_AVAILABILITY_STALE_TIME_MS,
    gcTime: FINANCIAL_DATA_GC_TIME_MS
  });
}

export function statisticsOverviewQueryOptions(
  ownerId: string,
  period: StatisticsPeriodRequest
) {
  return queryOptions({
    queryKey: financialQueryKeys.statisticsOverview(
      ownerId,
      getPeriodCacheKey(period)
    ),
    queryFn: ({ signal }) =>
      getStatisticsOverview(ownerId, period, signal),
    staleTime: FINANCIAL_DATA_STALE_TIME_MS,
    gcTime: FINANCIAL_DATA_GC_TIME_MS
  });
}

export function statisticsChartsQueryOptions(
  ownerId: string,
  period: StatisticsPeriodRequest
) {
  return queryOptions({
    queryKey: financialQueryKeys.statisticsChart(
      ownerId,
      getPeriodCacheKey(period)
    ),
    queryFn: ({ signal }) =>
      getStatisticsCharts(ownerId, period, signal),
    staleTime: FINANCIAL_DATA_STALE_TIME_MS,
    gcTime: FINANCIAL_DATA_GC_TIME_MS
  });
}
