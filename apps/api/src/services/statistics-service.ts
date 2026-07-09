import type { Prisma, TransactionType } from "@prisma/client";

import { db } from "../db/client.js";
import { centsToDecimal } from "../money/cents.js";

type BalanceDateRange = {
  from: Date;
  to: Date;
};

type CategoryTotal = {
  category: string;
  type: TransactionType;
  amountCents: number;
  transactionCount: number;
};

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
  type?: TransactionType
) {
  const categoryTotals = await db.transaction.groupBy({
    by: ["categoryId", "type"],
    where: {
      userId,
      type
    },
    _sum: {
      amountCents: true
    },
    _count: {
      _all: true
    }
  });

  const categoryIds = categoryTotals.map((categoryTotal) => {
    return categoryTotal.categoryId;
  });

  const categories = await db.category.findMany({
    where: {
      id: {
        in: categoryIds
      }
    },
    select: {
      id: true,
      name: true,
      type: true
    }
  });

  const categoriesById = new Map(
    categories.map((category) => [category.id, category])
  );

  const totals = categoryTotals
    .map((categoryTotal) => {
      const category = categoriesById.get(categoryTotal.categoryId);

      if (!category) {
        return null;
      }

      return {
        category: category.name,
        type: categoryTotal.type,
        amountCents: categoryTotal._sum.amountCents ?? 0,
        transactionCount: categoryTotal._count._all
      };
    })
    .filter((categoryTotal): categoryTotal is CategoryTotal => {
      return categoryTotal !== null && categoryTotal.amountCents > 0;
    });

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
