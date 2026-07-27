import type { TransactionType } from "../transactions/category-catalog";

export type CategoryBreakdownItem = {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  transactionCount: number;
  averageAmount: number;
};

export function getVisibleCategoryBreakdown(
  categories: readonly CategoryBreakdownItem[],
  type: TransactionType
) {
  const total = categories.reduce(
    (sum, category) => sum + category.amount,
    0
  );

  if (total <= 0) {
    return [];
  }

  const otherId = `${type.toLowerCase()}-other`;
  const hasSmallCategory = categories.some(
    (category) => (category.amount * 100) / total < 1
  );

  if (!hasSmallCategory) {
    return [...categories].sort(
      (first, second) => second.amount - first.amount
    );
  }

  const groupedCategories = categories.filter(
    (category) =>
      category.id !== otherId &&
      (category.amount * 100) / total >= 1
  );
  const categoriesInOther = categories.filter(
    (category) =>
      category.id === otherId ||
      (category.amount * 100) / total < 1
  );
  const otherAmount = categoriesInOther.reduce(
    (sum, category) => sum + category.amount,
    0
  );
  const otherTransactionCount = categoriesInOther.reduce(
    (sum, category) => sum + category.transactionCount,
    0
  );

  if (otherAmount > 0) {
    groupedCategories.push({
      id: otherId,
      name: "Other",
      amount: otherAmount,
      percentage: 0,
      transactionCount: otherTransactionCount,
      averageAmount:
        otherTransactionCount > 0
          ? otherAmount / otherTransactionCount
          : otherAmount
    });
  }

  return groupedCategories.sort(
    (first, second) => second.amount - first.amount
  );
}

