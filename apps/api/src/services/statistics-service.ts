import { Prisma, type TransactionType } from "@prisma/client";

import type { DateOnlyRange } from "../dates/date-only.js";
import { db } from "../db/client.js";
import { centsToDecimal } from "../money/cents.js";

type CategoryTotal = {
  categoryId: string;
  category: string;
  type: TransactionType;
  amountCents: number;
  transactionCount: number;
};

type CategoryTotalRow = {
  categoryId: string;
  category: string;
  type: TransactionType;
  amountCents: bigint | number;
  transactionCount: bigint | number;
};

type TransactionMonthRow = {
  month: string;
};

type BalanceRow = {
  totalIncomeCents: bigint | number;
  totalSpentCents: bigint | number;
};

type ActivityCountRow = {
  transactionCount: bigint | number;
};

export async function getUserTransactionMonths(
  userId: string,
  maximumDate: string
) {
  const months = await db.$queryRaw<TransactionMonthRow[]>(
    Prisma.sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', operation."occurredOn"), 'YYYY-MM') AS "month"
      FROM "FinancialOperation" operation
      WHERE operation."userId" = ${userId}
        AND operation."occurredOn" <= ${maximumDate}::date
      GROUP BY DATE_TRUNC('month', operation."occurredOn")
      ORDER BY DATE_TRUNC('month', operation."occurredOn") ASC
    `
  );

  return months.map(({ month }) => month);
}

async function getUserCategoryTotals(
  userId: string,
  type?: TransactionType,
  dateRange?: DateOnlyRange
) {
  const categoryTotals = await db.$queryRaw<CategoryTotalRow[]>(
    Prisma.sql`
      SELECT
        c."id" AS "categoryId",
        c."name" AS "category",
        operation."type" AS "type",
        SUM(operation."amountCents") AS "amountCents",
        COUNT(*) AS "transactionCount"
      FROM "FinancialOperation" operation
      INNER JOIN "Category" c ON c."id" = operation."categoryId"
      WHERE operation."userId" = ${userId}
        AND operation."type" IS NOT NULL
      ${type ? Prisma.sql`AND operation."type" = ${type}::"TransactionType"` : Prisma.empty}
      ${
        dateRange
          ? Prisma.sql`
              AND operation."occurredOn" >= ${dateRange.from}::date
              AND operation."occurredOn" < ${dateRange.to}::date
            `
          : Prisma.empty
      }
      GROUP BY c."id", c."name", operation."type"
    `
  );

  return categoryTotals
    .map((categoryTotal) => ({
      categoryId: categoryTotal.categoryId,
      category: categoryTotal.category,
      type: categoryTotal.type,
      amountCents: Number(categoryTotal.amountCents),
      transactionCount: Number(categoryTotal.transactionCount)
    }))
    .filter((categoryTotal) => categoryTotal.amountCents > 0);
}

export async function getUserBalance(
  userId: string,
  dateRange?: DateOnlyRange
) {
  const [totals] = await db.$queryRaw<BalanceRow[]>(
    Prisma.sql`
      SELECT
        COALESCE(
          SUM(operation."amountCents") FILTER (
            WHERE operation."type" = 'INCOME'::"TransactionType"
          ),
          0
        ) AS "totalIncomeCents",
        COALESCE(
          SUM(operation."amountCents") FILTER (
            WHERE operation."type" = 'EXPENSE'::"TransactionType"
          ),
          0
        ) AS "totalSpentCents"
      FROM "FinancialOperation" operation
      WHERE operation."userId" = ${userId}
      ${
        dateRange
          ? Prisma.sql`
              AND operation."occurredOn" >= ${dateRange.from}::date
              AND operation."occurredOn" < ${dateRange.to}::date
            `
          : Prisma.empty
      }
    `
  );

  const totalIncomeCents = Number(totals?.totalIncomeCents ?? 0);
  const totalSpentCents = Number(totals?.totalSpentCents ?? 0);
  const totalBalanceCents = totalIncomeCents - totalSpentCents;

  return {
    totalIncome: centsToDecimal(totalIncomeCents),
    totalSpent: centsToDecimal(totalSpentCents),
    totalBalance: centsToDecimal(totalBalanceCents)
  };
}

function getExactIntegerPercentages(categoryTotals: CategoryTotal[]) {
  const totalCents = categoryTotals.reduce(
    (total, categoryTotal) => total + categoryTotal.amountCents,
    0
  );

  if (totalCents === 0) {
    return [];
  }

  const percentages = categoryTotals.map((categoryTotal) => {
    const scaledAmount = categoryTotal.amountCents * 100;
    const percentage = Math.floor(scaledAmount / totalCents);
    const remainder = scaledAmount % totalCents;

    return {
      ...categoryTotal,
      percentage,
      remainder
    };
  });

  const missingPercentage =
    100 -
    percentages.reduce(
      (total, categoryPercentage) => total + categoryPercentage.percentage,
      0
    );

  const roundedUpCategories = [...percentages]
    .sort((first, second) => {
      if (second.remainder !== first.remainder) {
        return second.remainder - first.remainder;
      }

      if (second.transactionCount !== first.transactionCount) {
        return second.transactionCount - first.transactionCount;
      }

      return first.category.localeCompare(second.category);
    })
    .slice(0, missingPercentage);

  const roundedUpCategoryKeys = new Set(
    roundedUpCategories.map(
      (categoryPercentage) =>
        `${categoryPercentage.type}:${categoryPercentage.category}`
    )
  );

  return percentages.map((categoryPercentage) => {
    const categoryKey = `${categoryPercentage.type}:${categoryPercentage.category}`;

    return {
      category: categoryPercentage.category,
      type: categoryPercentage.type,
      percentage:
        categoryPercentage.percentage +
        (roundedUpCategoryKeys.has(categoryKey) ? 1 : 0)
    };
  });
}

export async function getUserCategoryStatistics(
  userId: string,
  type?: TransactionType,
  dateRange?: DateOnlyRange
) {
  const totals = await getUserCategoryTotals(userId, type, dateRange);

  const categoryStatistics = ["EXPENSE", "INCOME"].flatMap(
    (transactionType) => {
      const totalsByType = totals.filter((categoryTotal) => {
        return categoryTotal.type === transactionType;
      });

      return getExactIntegerPercentages(totalsByType);
    }
  );

  return categoryStatistics.sort((first, second) => {
    if (first.type !== second.type) {
      return first.type === "EXPENSE" ? -1 : 1;
    }

    const percentageDifference = second.percentage - first.percentage;

    if (percentageDifference !== 0) {
      return percentageDifference;
    }

    return first.category.localeCompare(second.category);
  });
}

export async function getUserTransactionActivity(
  userId: string,
  dateRange: DateOnlyRange
) {
  const [totals, countRows] = await Promise.all([
    getUserCategoryTotals(userId, undefined, dateRange),
    db.$queryRaw<ActivityCountRow[]>(
      Prisma.sql`
        SELECT COUNT(*) AS "transactionCount"
        FROM "FinancialOperation" operation
        WHERE operation."userId" = ${userId}
          AND operation."occurredOn" >= ${dateRange.from}::date
          AND operation."occurredOn" < ${dateRange.to}::date
      `
    )
  ]);

  function getTopCategory(type: TransactionType) {
    const topCategory = totals
      .filter((categoryTotal) => categoryTotal.type === type)
      .sort((first, second) => {
        if (second.amountCents !== first.amountCents) {
          return second.amountCents - first.amountCents;
        }

        if (second.transactionCount !== first.transactionCount) {
          return second.transactionCount - first.transactionCount;
        }

        return first.category.localeCompare(second.category);
      })[0];

    return topCategory
      ? { id: topCategory.categoryId, name: topCategory.category }
      : null;
  }

  return {
    transactionCount: Number(countRows[0]?.transactionCount ?? 0),
    topExpenseCategory: getTopCategory("EXPENSE"),
    topIncomeCategory: getTopCategory("INCOME")
  };
}
