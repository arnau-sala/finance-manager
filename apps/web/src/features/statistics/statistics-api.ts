import { z } from "zod";

import { ExpiringMemoryCache } from "../../cache/expiring-memory-cache";

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
    amount: moneySchema,
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
      transactionCount: z.number().int().nonnegative(),
      typicalAmount: moneySchema,
      averageAmount: moneySchema,
      averagePeriodCount: z.number().int().nonnegative(),
      averagePeriodUnit: z.enum(["DAY", "MONTH", "YEAR"]),
      currentStreak: streakSchema.nullable(),
      longestStreak: streakSchema,
      isLongestCurrent: z.boolean()
    })
  })
});

const chartsResponseSchema = z.object({
  charts: z.object({
    period: periodSchema,
    netWorth: z.object({
      status: z.literal("OPENING_BALANCE_REQUIRED"),
      points: z.array(z.never())
    }),
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

const REPORT_CACHE_TTL_MS = 30_000;
const AVAILABILITY_CACHE_TTL_MS = 60_000;
const overviewCache = new ExpiringMemoryCache<StatisticsOverview>(
  REPORT_CACHE_TTL_MS
);
const chartsCache = new ExpiringMemoryCache<StatisticsCharts>(
  REPORT_CACHE_TTL_MS
);
const availabilityCache = new ExpiringMemoryCache<StatisticsAvailability>(
  AVAILABILITY_CACHE_TTL_MS
);

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
  ownerId: string,
  signal?: AbortSignal
) {
  const cached = availabilityCache.get(ownerId);

  if (cached !== null) {
    return cached;
  }

  const rawResponse = await getJson(
    "/api/statistics/months",
    signal,
    "Unable to load available statistics periods."
  );
  const availability = availabilityResponseSchema.parse(rawResponse);
  availabilityCache.set(ownerId, availability);
  return availability;
}

export async function getStatisticsOverview(
  ownerId: string,
  period: StatisticsPeriodRequest,
  signal?: AbortSignal
) {
  const periodQuery = getPeriodQuery(period);
  const cacheKey = `${ownerId}:${periodQuery}`;
  const cached = overviewCache.get(cacheKey);

  if (cached !== null) {
    return cached;
  }

  const rawResponse = await getJson(
    `/api/statistics/overview?${periodQuery}`,
    signal,
    "Unable to load your statistics."
  );
  const overview = overviewResponseSchema.parse(rawResponse).overview;
  overviewCache.set(cacheKey, overview);
  return overview;
}

export async function getStatisticsCharts(
  ownerId: string,
  period: StatisticsPeriodRequest,
  signal?: AbortSignal
) {
  const periodQuery = getPeriodQuery(period);
  const cacheKey = `${ownerId}:${periodQuery}`;
  const cached = chartsCache.get(cacheKey);

  if (cached !== null) {
    return cached;
  }

  const rawResponse = await getJson(
    `/api/statistics/charts?${periodQuery}`,
    signal,
    "Unable to load your charts."
  );
  const charts = chartsResponseSchema.parse(rawResponse).charts;
  chartsCache.set(cacheKey, charts);
  return charts;
}

export function clearStatisticsCache() {
  availabilityCache.clear();
  overviewCache.clear();
  chartsCache.clear();
}
