import { Prisma, type TransactionType } from "@prisma/client";

import { db } from "../db/client.js";
import { centsToDecimal } from "../money/cents.js";

type BalanceDateRange = {
  from: Date;
  to: Date;
};

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

async function getUserCategoryTotals(
  userId: string,
  type?: TransactionType,
  dateRange?: BalanceDateRange
) {
  const categoryTotals = await db.$queryRaw<CategoryTotalRow[]>(
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
      ${type ? Prisma.sql`AND t."type" = ${type}::"TransactionType"` : Prisma.empty}
      ${
        dateRange
          ? Prisma.sql`
              AND t."occurredAt" >= ${dateRange.from}
              AND t."occurredAt" < ${dateRange.to}
            `
          : Prisma.empty
      }
      GROUP BY c."id", c."name", t."type"
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
  dateRange?: BalanceDateRange
) {
  const where: Prisma.TransactionWhereInput = {
    userId
  };

  if (dateRange) {
    where.occurredAt = {
      gte: dateRange.from,
      lt: dateRange.to
    };
  }

  const totals = await db.transaction.groupBy({
    by: ["type"],
    where,
    _sum: {
      amountCents: true
    }
  });

  const totalIncomeCents =
    totals.find((total) => total.type === "INCOME")?._sum.amountCents ?? 0;
  const totalSpentCents =
    totals.find((total) => total.type === "EXPENSE")?._sum.amountCents ?? 0;
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
  dateRange?: BalanceDateRange
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
  dateRange: BalanceDateRange
) {
  const totals = await getUserCategoryTotals(userId, undefined, dateRange);

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
    transactionCount: totals.reduce(
      (count, categoryTotal) => count + categoryTotal.transactionCount,
      0
    ),
    topExpenseCategory: getTopCategory("EXPENSE"),
    topIncomeCategory: getTopCategory("INCOME")
  };
}
