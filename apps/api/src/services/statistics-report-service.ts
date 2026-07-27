import { Prisma, type TransactionType } from "@prisma/client";

import { db } from "../db/client.js";
import { centsToDecimal } from "../money/cents.js";
import {
  getInclusiveDayCount,
  getMonthKeys,
  resolveStatisticsPeriod,
  type ResolvedStatisticsPeriod,
  type StatisticsPeriodSelection
} from "./statistics-period.js";

type TransactionStartRow = {
  firstDate: string | null;
};

type MonthlyTotalRow = {
  month: string;
  incomeCents: bigint | number;
  expenseCents: bigint | number;
  transactionCount: bigint | number;
};

type CategoryTotalRow = {
  categoryId: string;
  category: string;
  type: TransactionType;
  amountCents: bigint | number;
  transactionCount: bigint | number;
};

type TopMovementRow = {
  type: TransactionType;
  amountCents: number;
  date: string;
};

type ExpenseAggregateRow = {
  transactionCount: bigint | number;
  typicalAmountCents: bigint | number;
  expenseDates: string[] | null;
};

type CategoryIntervalRow = CategoryTotalRow & {
  intervalKey: string;
};

type WeekdaySpendingRow = {
  weekday: number;
  amountCents: bigint | number;
  transactionCount: bigint | number;
};

type PeriodTotal = {
  key: string;
  incomeCents: number;
  expenseCents: number;
  transactionCount: number;
};

type CategoryTotal = {
  id: string;
  name: string;
  type: TransactionType;
  amountCents: number;
  transactionCount: number;
  percentage: number;
};

type NoSpendStreak = {
  days: number;
  startDate: string | null;
  endDate: string | null;
};

type TimelineInterval = {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
};

function getPeriodFilter(period: ResolvedStatisticsPeriod) {
  return Prisma.sql`
    AND t."occurredOn" >= ${period.from}::date
    AND t."occurredOn" < ${period.to}::date
  `;
}

async function getFirstTransactionDate(userId: string, today: string) {
  const [row] = await db.$queryRaw<TransactionStartRow[]>(
    Prisma.sql`
      SELECT TO_CHAR(MIN(t."occurredOn"), 'YYYY-MM-DD') AS "firstDate"
      FROM "Transaction" t
      WHERE t."userId" = ${userId}
        AND t."occurredOn" <= ${today}::date
    `
  );

  return row?.firstDate ?? null;
}

async function resolveUserStatisticsPeriod(
  userId: string,
  selection: StatisticsPeriodSelection,
  today: string
) {
  const firstTransactionDate =
    selection.mode === "ALL"
      ? await getFirstTransactionDate(userId, today)
      : null;

  return resolveStatisticsPeriod(selection, today, firstTransactionDate);
}

async function getMonthlyTotals(
  userId: string,
  period: ResolvedStatisticsPeriod
) {
  const rows = await db.$queryRaw<MonthlyTotalRow[]>(
    Prisma.sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', t."occurredOn"), 'YYYY-MM') AS "month",
        COALESCE(
          SUM(t."amountCents") FILTER (
            WHERE t."type" = 'INCOME'::"TransactionType"
          ),
          0
        ) AS "incomeCents",
        COALESCE(
          SUM(t."amountCents") FILTER (
            WHERE t."type" = 'EXPENSE'::"TransactionType"
          ),
          0
        ) AS "expenseCents",
        COUNT(*) AS "transactionCount"
      FROM "Transaction" t
      WHERE t."userId" = ${userId}
        ${getPeriodFilter(period)}
      GROUP BY DATE_TRUNC('month', t."occurredOn")
      ORDER BY DATE_TRUNC('month', t."occurredOn") ASC
    `
  );
  const totalsByMonth = new Map(
    rows.map((row) => [
      row.month,
      {
        incomeCents: Number(row.incomeCents),
        expenseCents: Number(row.expenseCents),
        transactionCount: Number(row.transactionCount)
      }
    ])
  );

  return getMonthKeys(period.from, period.endDate).map<PeriodTotal>((month) => {
    const total = totalsByMonth.get(month);

    return {
      key: month,
      incomeCents: total?.incomeCents ?? 0,
      expenseCents: total?.expenseCents ?? 0,
      transactionCount: total?.transactionCount ?? 0
    };
  });
}

function getYearlyTotals(monthlyTotals: readonly PeriodTotal[]) {
  const totalsByYear = new Map<string, PeriodTotal>();

  monthlyTotals.forEach((month) => {
    const year = month.key.slice(0, 4);
    const total = totalsByYear.get(year) ?? {
      key: year,
      incomeCents: 0,
      expenseCents: 0,
      transactionCount: 0
    };

    total.incomeCents += month.incomeCents;
    total.expenseCents += month.expenseCents;
    total.transactionCount += month.transactionCount;
    totalsByYear.set(year, total);
  });

  return [...totalsByYear.values()];
}

function sumPeriodTotals(periods: readonly PeriodTotal[]) {
  return periods.reduce(
    (total, period) => ({
      incomeCents: total.incomeCents + period.incomeCents,
      expenseCents: total.expenseCents + period.expenseCents,
      transactionCount: total.transactionCount + period.transactionCount
    }),
    {
      incomeCents: 0,
      expenseCents: 0,
      transactionCount: 0
    }
  );
}

function applyExactPercentages(
  categoryTotals: readonly Omit<CategoryTotal, "percentage">[]
) {
  const totalCents = categoryTotals.reduce(
    (total, category) => total + category.amountCents,
    0
  );

  if (totalCents <= 0) {
    return [];
  }

  const percentages = categoryTotals.map((category) => {
    const scaledAmount = category.amountCents * 100;

    return {
      ...category,
      percentage: Math.floor(scaledAmount / totalCents),
      remainder: scaledAmount % totalCents
    };
  });
  const missingPercentage =
    100 -
    percentages.reduce(
      (total, category) => total + category.percentage,
      0
    );
  const roundedUpIds = new Set(
    [...percentages]
      .sort(
        (first, second) =>
          second.remainder - first.remainder ||
          second.transactionCount - first.transactionCount ||
          first.name.localeCompare(second.name)
      )
      .slice(0, missingPercentage)
      .map((category) => category.id)
  );

  return percentages.map<CategoryTotal>(({ remainder: _remainder, ...category }) => ({
    ...category,
    percentage:
      category.percentage + (roundedUpIds.has(category.id) ? 1 : 0)
  }));
}

function createCategoryTotals(rows: readonly CategoryTotalRow[]) {
  const totals = rows
    .map<Omit<CategoryTotal, "percentage">>((row) => ({
      id: row.categoryId,
      name: row.category,
      type: row.type,
      amountCents: Number(row.amountCents),
      transactionCount: Number(row.transactionCount)
    }))
    .filter((category) => category.amountCents > 0);

  return (["INCOME", "EXPENSE"] as const).flatMap((type) =>
    applyExactPercentages(
      totals.filter((category) => category.type === type)
    ).sort(
      (first, second) =>
        second.amountCents - first.amountCents ||
        first.name.localeCompare(second.name)
    )
  );
}

async function getCategoryTotals(
  userId: string,
  period: ResolvedStatisticsPeriod
) {
  const rows = await db.$queryRaw<CategoryTotalRow[]>(
    Prisma.sql`
      SELECT
        c."id" AS "categoryId",
        c."name" AS "category",
        t."type" AS "type",
        SUM(t."amountCents") AS "amountCents",
        COUNT(*) AS "transactionCount"
      FROM "Transaction" t
      INNER JOIN "Category" c ON c."id" = t."categoryId"
      WHERE t."userId" = ${userId}
        ${getPeriodFilter(period)}
      GROUP BY c."id", c."name", t."type"
    `
  );

  return createCategoryTotals(rows);
}

async function getTopMovements(
  userId: string,
  period: ResolvedStatisticsPeriod
) {
  return db.$queryRaw<TopMovementRow[]>(
    Prisma.sql`
      SELECT
        ranked."type",
        ranked."amountCents",
        ranked."date"
      FROM (
        SELECT
          t."type",
          t."amountCents",
          TO_CHAR(t."occurredOn", 'YYYY-MM-DD') AS "date",
          ROW_NUMBER() OVER (
            PARTITION BY t."type"
            ORDER BY
              t."amountCents" DESC,
              t."occurredOn" DESC,
              t."createdAt" DESC,
              t."id" DESC
          ) AS "position"
        FROM "Transaction" t
        WHERE t."userId" = ${userId}
          ${getPeriodFilter(period)}
      ) ranked
      WHERE ranked."position" = 1
    `
  );
}

async function getExpenseAggregate(
  userId: string,
  period: ResolvedStatisticsPeriod
) {
  const [aggregate] = await db.$queryRaw<ExpenseAggregateRow[]>(
    Prisma.sql`
      SELECT
        COUNT(*) AS "transactionCount",
        COALESCE(
          ROUND(
            PERCENTILE_CONT(0.5) WITHIN GROUP (
              ORDER BY t."amountCents"
            )
          ),
          0
        )::bigint AS "typicalAmountCents",
        ARRAY_AGG(
          DISTINCT TO_CHAR(t."occurredOn", 'YYYY-MM-DD')
          ORDER BY TO_CHAR(t."occurredOn", 'YYYY-MM-DD')
        ) AS "expenseDates"
      FROM "Transaction" t
      WHERE t."userId" = ${userId}
        AND t."type" = 'EXPENSE'::"TransactionType"
        ${getPeriodFilter(period)}
    `
  );

  return {
    transactionCount: Number(aggregate?.transactionCount ?? 0),
    typicalAmountCents: Number(aggregate?.typicalAmountCents ?? 0),
    expenseDates: aggregate?.expenseDates ?? []
  };
}

function dateToDayNumber(date: string) {
  return Math.floor(Date.parse(`${date}T00:00:00.000Z`) / 86_400_000);
}

function dayNumberToDate(dayNumber: number) {
  return new Date(dayNumber * 86_400_000).toISOString().slice(0, 10);
}

function getNoSpendStreaks(
  expenseDates: readonly string[],
  from: string,
  endDate: string
) {
  const expenseDays = new Set(expenseDates.map(dateToDayNumber));
  const startDay = dateToDayNumber(from);
  const finalDay = dateToDayNumber(endDate);
  let activeStart: number | null = null;
  let longest: NoSpendStreak = {
    days: 0,
    startDate: null,
    endDate: null
  };

  function finishStreak(streakEnd: number) {
    if (activeStart === null) {
      return;
    }

    const days = streakEnd - activeStart + 1;

    if (days > longest.days) {
      longest = {
        days,
        startDate: dayNumberToDate(activeStart),
        endDate: dayNumberToDate(streakEnd)
      };
    }

    activeStart = null;
  }

  for (let day = startDay; day <= finalDay; day += 1) {
    if (expenseDays.has(day)) {
      finishStreak(day - 1);
    } else if (activeStart === null) {
      activeStart = day;
    }
  }

  finishStreak(finalDay);

  let currentDays = 0;

  for (
    let day = finalDay;
    day >= startDay && !expenseDays.has(day);
    day -= 1
  ) {
    currentDays += 1;
  }

  const current = {
    days: currentDays,
    startDate:
      currentDays > 0 ? dayNumberToDate(finalDay - currentDays + 1) : null,
    endDate: currentDays > 0 ? endDate : null
  };

  return {
    current,
    longest,
    isLongestCurrent: current.days > 0 && current.days === longest.days
  };
}

function getPeriodMetrics(period: PeriodTotal) {
  const balanceCents = period.incomeCents - period.expenseCents;

  return {
    key: period.key,
    balanceCents,
    savingsPercentage:
      period.incomeCents > 0
        ? Math.round((balanceCents * 100) / period.incomeCents)
        : null
  };
}

function getPeriodExtreme(
  periods: readonly PeriodTotal[],
  direction: "BEST" | "WORST"
) {
  const candidates = periods
    .map(getPeriodMetrics)
    .filter(
      (
        candidate
      ): candidate is ReturnType<typeof getPeriodMetrics> & {
        savingsPercentage: number;
      } => candidate.savingsPercentage !== null
    );

  return candidates.reduce<(typeof candidates)[number] | null>(
    (selected, candidate) => {
      if (!selected) {
        return candidate;
      }

      const percentageDifference =
        candidate.savingsPercentage - selected.savingsPercentage;
      const replace =
        direction === "BEST"
          ? percentageDifference > 0 ||
            (percentageDifference === 0 &&
              candidate.balanceCents > selected.balanceCents)
          : percentageDifference < 0 ||
            (percentageDifference === 0 &&
              candidate.balanceCents < selected.balanceCents);

      return replace ? candidate : selected;
    },
    null
  );
}

function getPeriodCollectionSummary(periods: readonly PeriodTotal[]) {
  const total = sumPeriodTotals(periods);
  const positivePeriods = periods.filter(
    (period) => period.incomeCents - period.expenseCents > 0
  ).length;
  const totalBalanceCents = total.incomeCents - total.expenseCents;

  return {
    positivePeriods,
    totalPeriods: periods.length,
    positivePercentage:
      periods.length > 0
        ? Math.round((positivePeriods * 100) / periods.length)
        : 0,
    averageBalance: centsToDecimal(
      periods.length > 0
        ? Math.round(totalBalanceCents / periods.length)
        : 0
    ),
    averageSavingsPercentage:
      total.incomeCents > 0
        ? Math.round((totalBalanceCents * 100) / total.incomeCents)
        : null
  };
}

function serializeExtreme(
  extreme: ReturnType<typeof getPeriodExtreme>
) {
  return extreme
    ? {
        key: extreme.key,
        balance: centsToDecimal(extreme.balanceCents),
        savingsPercentage: extreme.savingsPercentage
      }
    : null;
}

function serializeCategory(category: CategoryTotal) {
  return {
    id: category.id,
    name: category.name,
    type: category.type,
    amount: centsToDecimal(category.amountCents),
    percentage: category.percentage,
    transactionCount: category.transactionCount,
    averageAmount: centsToDecimal(
      category.transactionCount > 0
        ? Math.round(category.amountCents / category.transactionCount)
        : 0
    )
  };
}

function getAveragePeriodCount(
  period: ResolvedStatisticsPeriod,
  monthlyTotals: readonly PeriodTotal[],
  yearlyTotals: readonly PeriodTotal[]
) {
  if (period.mode === "MONTH") {
    return {
      count: getInclusiveDayCount(period.from, period.endDate),
      unit: "DAY" as const
    };
  }

  if (period.mode === "YEAR") {
    return {
      count: monthlyTotals.length,
      unit: "MONTH" as const
    };
  }

  return {
    count: yearlyTotals.length,
    unit: "YEAR" as const
  };
}

export async function getStatisticsOverview(
  userId: string,
  selection: StatisticsPeriodSelection,
  today: string
) {
  const period = await resolveUserStatisticsPeriod(userId, selection, today);
  const [monthlyTotals, categories, topMovements, expenseAggregate] =
    await Promise.all([
      getMonthlyTotals(userId, period),
      getCategoryTotals(userId, period),
      getTopMovements(userId, period),
      getExpenseAggregate(userId, period)
    ]);
  const yearlyTotals = getYearlyTotals(monthlyTotals);
  const totals = sumPeriodTotals(monthlyTotals);
  const balanceCents = totals.incomeCents - totals.expenseCents;
  const averagePeriod = getAveragePeriodCount(
    period,
    monthlyTotals,
    yearlyTotals
  );
  const streaks = getNoSpendStreaks(
    expenseAggregate.expenseDates,
    period.from,
    period.endDate
  );

  function serializeMovement(type: TransactionType) {
    const movement = topMovements.find((candidate) => candidate.type === type);

    return movement
      ? {
          amount: centsToDecimal(movement.amountCents),
          date: movement.date
        }
      : null;
  }

  return {
    period: {
      mode: period.mode,
      key: period.key,
      startDate: period.from,
      endDate: period.endDate
    },
    money: {
      income: centsToDecimal(totals.incomeCents),
      expenses: centsToDecimal(totals.expenseCents),
      balance: centsToDecimal(balanceCents),
      savingsPercentage:
        totals.incomeCents > 0
          ? Math.round((balanceCents * 100) / totals.incomeCents)
          : null
    },
    categories: categories.map(serializeCategory),
    insights: {
      largestIncome: serializeMovement("INCOME"),
      largestExpense: serializeMovement("EXPENSE"),
      bestMonth:
        period.mode === "MONTH"
          ? null
          : serializeExtreme(getPeriodExtreme(monthlyTotals, "BEST")),
      worstMonth:
        period.mode === "MONTH"
          ? null
          : serializeExtreme(getPeriodExtreme(monthlyTotals, "WORST")),
      bestYear:
        period.mode === "ALL"
          ? serializeExtreme(getPeriodExtreme(yearlyTotals, "BEST"))
          : null,
      worstYear:
        period.mode === "ALL"
          ? serializeExtreme(getPeriodExtreme(yearlyTotals, "WORST"))
          : null,
      months:
        period.mode === "MONTH"
          ? null
          : getPeriodCollectionSummary(monthlyTotals),
      years:
        period.mode === "ALL"
          ? getPeriodCollectionSummary(yearlyTotals)
          : null
    },
    expenses: {
      transactionCount: expenseAggregate.transactionCount,
      typicalAmount: centsToDecimal(expenseAggregate.typicalAmountCents),
      averageAmount: centsToDecimal(
        averagePeriod.count > 0
          ? Math.round(totals.expenseCents / averagePeriod.count)
          : 0
      ),
      averagePeriodCount: averagePeriod.count,
      averagePeriodUnit: averagePeriod.unit,
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
      isLongestCurrent: streaks.isLongestCurrent
    }
  };
}

function getTimelineBucketExpression(mode: ResolvedStatisticsPeriod["mode"]) {
  if (mode === "MONTH") {
    return Prisma.sql`
      TO_CHAR(t."occurredOn", 'YYYY-MM') ||
      ':week-' ||
      (((EXTRACT(DAY FROM t."occurredOn")::int - 1) / 7) + 1)::text
    `;
  }

  if (mode === "YEAR") {
    return Prisma.sql`TO_CHAR(DATE_TRUNC('month', t."occurredOn"), 'YYYY-MM')`;
  }

  return Prisma.sql`TO_CHAR(DATE_TRUNC('year', t."occurredOn"), 'YYYY')`;
}

async function getCategoryIntervalTotals(
  userId: string,
  period: ResolvedStatisticsPeriod
) {
  const bucket = getTimelineBucketExpression(period.mode);

  return db.$queryRaw<CategoryIntervalRow[]>(
    Prisma.sql`
      SELECT
        c."id" AS "categoryId",
        c."name" AS "category",
        t."type" AS "type",
        ${bucket} AS "intervalKey",
        SUM(t."amountCents") AS "amountCents",
        COUNT(*) AS "transactionCount"
      FROM "Transaction" t
      INNER JOIN "Category" c ON c."id" = t."categoryId"
      WHERE t."userId" = ${userId}
        ${getPeriodFilter(period)}
      GROUP BY
        c."id",
        c."name",
        t."type",
        ${bucket}
      ORDER BY "intervalKey" ASC
    `
  );
}

function getMonthEndDate(month: string, maximumDate: string) {
  if (month === maximumDate.slice(0, 7)) {
    return maximumDate;
  }

  const [year = 0, monthNumber = 1] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}

function createTimelineIntervals(
  period: ResolvedStatisticsPeriod,
  monthlyTotals: readonly PeriodTotal[],
  yearlyTotals: readonly PeriodTotal[]
) {
  if (period.mode === "MONTH") {
    const finalDay = Number(period.endDate.slice(-2));
    const intervals: TimelineInterval[] = [];

    for (let startDay = 1; startDay <= finalDay; startDay += 7) {
      const weekNumber = intervals.length + 1;
      const endDay = Math.min(startDay + 6, finalDay);

      intervals.push({
        key: `${period.key}:week-${weekNumber}`,
        label: `Week ${weekNumber}`,
        startDate: `${period.key}-${String(startDay).padStart(2, "0")}`,
        endDate: `${period.key}-${String(endDay).padStart(2, "0")}`
      });
    }

    return intervals;
  }

  if (period.mode === "YEAR") {
    return monthlyTotals.map((month) => ({
      key: month.key,
      label: month.key,
      startDate: `${month.key}-01`,
      endDate: getMonthEndDate(month.key, period.endDate)
    }));
  }

  return yearlyTotals.map((year, index) => ({
    key: year.key,
    label: year.key,
    startDate: index === 0 ? period.from : `${year.key}-01-01`,
    endDate:
      index === yearlyTotals.length - 1
        ? period.endDate
        : `${year.key}-12-31`
  }));
}

function createChartCategories(rows: readonly CategoryIntervalRow[]) {
  const totalsByCategory = new Map<
    string,
    Omit<CategoryTotal, "percentage">
  >();

  rows.forEach((row) => {
    const existing = totalsByCategory.get(row.categoryId) ?? {
      id: row.categoryId,
      name: row.category,
      type: row.type,
      amountCents: 0,
      transactionCount: 0
    };
    existing.amountCents += Number(row.amountCents);
    existing.transactionCount += Number(row.transactionCount);
    totalsByCategory.set(row.categoryId, existing);
  });

  return (["INCOME", "EXPENSE"] as const).flatMap((type) =>
    applyExactPercentages(
      [...totalsByCategory.values()].filter(
        (category) => category.type === type
      )
    ).sort(
      (first, second) =>
        second.amountCents - first.amountCents ||
        first.name.localeCompare(second.name)
    )
  );
}

function createTimelineCells(rows: readonly CategoryIntervalRow[]) {
  const intervalTypeTotals = new Map<string, number>();

  rows.forEach((row) => {
    const key = `${row.intervalKey}:${row.type}`;
    intervalTypeTotals.set(
      key,
      (intervalTypeTotals.get(key) ?? 0) + Number(row.amountCents)
    );
  });

  return rows.map((row) => {
    const amountCents = Number(row.amountCents);
    const intervalTotal =
      intervalTypeTotals.get(`${row.intervalKey}:${row.type}`) ?? 0;

    return {
      categoryId: row.categoryId,
      type: row.type,
      intervalKey: row.intervalKey,
      amount: centsToDecimal(amountCents),
      percentage:
        intervalTotal > 0 ? (amountCents * 100) / intervalTotal : 0,
      transactionCount: Number(row.transactionCount)
    };
  });
}

function createFinancialIntervals(
  period: ResolvedStatisticsPeriod,
  monthlyTotals: readonly PeriodTotal[],
  yearlyTotals: readonly PeriodTotal[]
) {
  if (period.mode === "MONTH") {
    return [];
  }

  const totals = period.mode === "YEAR" ? monthlyTotals : yearlyTotals;

  return totals.map((total, index) => {
    const startDate =
      period.mode === "YEAR"
        ? `${total.key}-01`
        : index === 0
          ? period.from
          : `${total.key}-01-01`;
    const endDate =
      period.mode === "YEAR"
        ? getMonthEndDate(total.key, period.endDate)
        : index === totals.length - 1
          ? period.endDate
          : `${total.key}-12-31`;

    return {
      key: total.key,
      startDate,
      endDate,
      income: centsToDecimal(total.incomeCents),
      expenses: centsToDecimal(total.expenseCents),
      balance: centsToDecimal(total.incomeCents - total.expenseCents)
    };
  });
}

async function getWeekdaySpending(
  userId: string,
  period: ResolvedStatisticsPeriod
) {
  const rows = await db.$queryRaw<WeekdaySpendingRow[]>(
    Prisma.sql`
      SELECT
        EXTRACT(ISODOW FROM t."occurredOn")::int AS "weekday",
        SUM(t."amountCents") AS "amountCents",
        COUNT(*) AS "transactionCount"
      FROM "Transaction" t
      WHERE t."userId" = ${userId}
        AND t."type" = 'EXPENSE'::"TransactionType"
        ${getPeriodFilter(period)}
      GROUP BY EXTRACT(ISODOW FROM t."occurredOn")
    `
  );
  const totalsByWeekday = new Map(
    rows.map((row) => [
      Number(row.weekday),
      {
        amountCents: Number(row.amountCents),
        transactionCount: Number(row.transactionCount)
      }
    ])
  );
  const occurrences = new Map<number, number>();
  const start = Date.parse(`${period.from}T00:00:00.000Z`);
  const end = Date.parse(`${period.endDate}T00:00:00.000Z`);

  for (let timestamp = start; timestamp <= end; timestamp += 86_400_000) {
    const day = new Date(timestamp).getUTCDay();
    const isoWeekday = day === 0 ? 7 : day;
    occurrences.set(isoWeekday, (occurrences.get(isoWeekday) ?? 0) + 1);
  }

  const transactionCount = rows.reduce(
    (total, row) => total + Number(row.transactionCount),
    0
  );

  return {
    hasEnoughData: transactionCount > 5,
    values: Array.from({ length: 7 }, (_, index) => {
      const weekday = index + 1;
      const total = totalsByWeekday.get(weekday) ?? {
        amountCents: 0,
        transactionCount: 0
      };
      const occurrenceCount = occurrences.get(weekday) ?? 0;

      return {
        weekday,
        averageAmount: centsToDecimal(
          occurrenceCount > 0
            ? Math.round(total.amountCents / occurrenceCount)
            : 0
        ),
        totalAmount: centsToDecimal(total.amountCents),
        transactionCount: total.transactionCount
      };
    })
  };
}

export async function getStatisticsCharts(
  userId: string,
  selection: StatisticsPeriodSelection,
  today: string
) {
  const period = await resolveUserStatisticsPeriod(userId, selection, today);
  const [monthlyTotals, categoryRows, weekdaySpending] = await Promise.all([
    getMonthlyTotals(userId, period),
    getCategoryIntervalTotals(userId, period),
    getWeekdaySpending(userId, period)
  ]);
  const yearlyTotals = getYearlyTotals(monthlyTotals);
  const categories = createChartCategories(categoryRows);

  return {
    period: {
      mode: period.mode,
      key: period.key,
      startDate: period.from,
      endDate: period.endDate
    },
    netWorth: {
      status: "OPENING_BALANCE_REQUIRED" as const,
      points: []
    },
    financialIntervals: createFinancialIntervals(
      period,
      monthlyTotals,
      yearlyTotals
    ),
    categories: categories.map(serializeCategory),
    categoryTimeline: {
      intervals: createTimelineIntervals(
        period,
        monthlyTotals,
        yearlyTotals
      ),
      cells: createTimelineCells(categoryRows)
    },
    weekdaySpending
  };
}
