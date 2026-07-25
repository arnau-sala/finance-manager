import {
  transactionCategories,
  type TransactionType
} from "../transactions/category-catalog";
import {
  mockStatisticsMonthlyTotals,
  mockStatisticsTransactions
} from "./statistics-mock";

export type StatisticsCategoryPeriodMode = "MONTH" | "YEAR" | "ALL";

export type CategoryBreakdownItem = {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  transactionCount: number;
  averageAmount: number;
};

type CategoryWeight = {
  id: string;
  share: number;
};

type CategoryBreakdownRequest = {
  mode: StatisticsCategoryPeriodMode;
  selectedMonth: string;
  selectedYear: number;
  type: TransactionType;
};

const expenseCategoryProfiles: readonly (readonly CategoryWeight[])[] = [
  [
    { id: "expense-housing", share: 0.38 },
    { id: "expense-groceries", share: 0.23 },
    { id: "expense-dining", share: 0.14 },
    { id: "expense-transport", share: 0.1 },
    { id: "expense-subscriptions", share: 0.08 },
    { id: "expense-shopping", share: 0.07 }
  ],
  [
    { id: "expense-groceries", share: 0.27 },
    { id: "expense-housing", share: 0.24 },
    { id: "expense-shopping", share: 0.18 },
    { id: "expense-health", share: 0.12 },
    { id: "expense-dining", share: 0.1 },
    { id: "expense-other", share: 0.09 }
  ],
  [
    { id: "expense-housing", share: 0.34 },
    { id: "expense-education", share: 0.2 },
    { id: "expense-groceries", share: 0.17 },
    { id: "expense-sports", share: 0.11 },
    { id: "expense-parties", share: 0.1 },
    { id: "expense-transport", share: 0.08 }
  ]
];

const incomeCategoryProfiles: readonly (readonly CategoryWeight[])[] = [
  [
    { id: "income-salary", share: 0.72 },
    { id: "income-freelance", share: 0.1 },
    { id: "income-benefits", share: 0.06 },
    { id: "income-investments", share: 0.05 },
    { id: "income-gifts", share: 0.04 },
    { id: "income-sales", share: 0.03 }
  ],
  [
    { id: "income-salary", share: 0.6 },
    { id: "income-freelance", share: 0.18 },
    { id: "income-investments", share: 0.09 },
    { id: "income-sales", share: 0.06 },
    { id: "income-gifts", share: 0.04 },
    { id: "income-other", share: 0.03 }
  ],
  [
    { id: "income-salary", share: 0.68 },
    { id: "income-benefits", share: 0.12 },
    { id: "income-sales", share: 0.08 },
    { id: "income-allowance", share: 0.05 },
    { id: "income-investments", share: 0.04 },
    { id: "income-other", share: 0.03 }
  ]
];

const typicalTransactionAmounts: Readonly<Record<string, number>> = {
  "expense-dining": 35,
  "expense-education": 180,
  "expense-gifts": 100,
  "expense-groceries": 60,
  "expense-health": 100,
  "expense-housing": 900,
  "expense-parties": 80,
  "expense-shopping": 90,
  "expense-sports": 45,
  "expense-subscriptions": 15,
  "expense-transport": 30,
  "expense-other": 50,
  "income-allowance": 100,
  "income-benefits": 500,
  "income-freelance": 600,
  "income-gifts": 100,
  "income-investments": 250,
  "income-salary": 2500,
  "income-sales": 180,
  "income-other": 200
};

const availableYears = [
  ...new Set(
    mockStatisticsMonthlyTotals.map(({ month }) => Number(month.slice(0, 4)))
  )
];

function getProfiles(type: TransactionType) {
  return type === "INCOME"
    ? incomeCategoryProfiles
    : expenseCategoryProfiles;
}

function getMockCategoryAmounts(
  type: TransactionType,
  matchesDate: (date: string) => boolean
) {
  const amountsByCategory = new Map<string, number>();

  mockStatisticsTransactions.forEach((transaction) => {
    if (
      transaction.type !== type ||
      !transaction.categoryId ||
      transaction.amountCents === undefined ||
      !matchesDate(transaction.date)
    ) {
      return;
    }

    const amount = Math.round(transaction.amountCents / 100);
    amountsByCategory.set(
      transaction.categoryId,
      (amountsByCategory.get(transaction.categoryId) ?? 0) + amount
    );
  });

  return amountsByCategory;
}

function createCategoryBreakdownItems(
  type: TransactionType,
  amountsByCategory: ReadonlyMap<string, number>
) {
  const totalAmount = [...amountsByCategory.values()].reduce(
    (total, amount) => total + amount,
    0
  );

  if (totalAmount <= 0) {
    return [];
  }

  const categories = [...amountsByCategory.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([id, amount]) => {
      const category = transactionCategories.find(
        (candidate) => candidate.id === id && candidate.type === type
      );
      const exactPercentage = (amount * 100) / totalAmount;

      return {
        id,
        name: category?.name ?? id,
        amount,
        percentage: Math.floor(exactPercentage),
        remainder: exactPercentage % 1
      };
    });
  const percentagePointsToAssign =
    100 - categories.reduce(
      (total, category) => total + category.percentage,
      0
    );
  const roundedUpIds = new Set(
    [...categories]
      .sort(
        (first, second) =>
          second.remainder - first.remainder ||
          second.amount - first.amount
      )
      .slice(0, percentagePointsToAssign)
      .map((category) => category.id)
  );

  return categories
    .map<CategoryBreakdownItem>((category) => {
      const typicalAmount =
        typicalTransactionAmounts[category.id] ??
        (type === "INCOME" ? 250 : 50);
      const transactionCount = Math.max(
        1,
        Math.round(category.amount / typicalAmount)
      );

      return {
        id: category.id,
        name: category.name,
        amount: category.amount,
        percentage:
          category.percentage + (roundedUpIds.has(category.id) ? 1 : 0),
        transactionCount,
        averageAmount: category.amount / transactionCount
      };
    })
    .sort((first, second) => second.amount - first.amount);
}

function createCategoryBreakdown(
  total: number,
  type: TransactionType,
  profile: readonly CategoryWeight[],
  fixedAmounts = new Map<string, number>()
) {
  if (total <= 0) {
    return [];
  }

  const amountsByCategory = new Map(
    [...fixedAmounts].filter(([, amount]) => amount > 0)
  );
  const fixedTotal = [...amountsByCategory.values()].reduce(
    (sum, amount) => sum + amount,
    0
  );
  const amountToDistribute = Math.max(0, total - fixedTotal);
  let allocatedAmount = 0;

  profile.forEach((entry, index) => {
    const category = transactionCategories.find(
      (candidate) => candidate.id === entry.id && candidate.type === type
    );

    if (!category) {
      return;
    }

    const amount =
      index === profile.length - 1
        ? amountToDistribute - allocatedAmount
        : Math.round(amountToDistribute * entry.share);
    allocatedAmount += amount;
    amountsByCategory.set(
      category.id,
      (amountsByCategory.get(category.id) ?? 0) + amount
    );
  });

  return createCategoryBreakdownItems(type, amountsByCategory);
}

function getPeriodTotal(
  type: TransactionType,
  matchesMonth: (month: string) => boolean
) {
  return Math.round(
    mockStatisticsMonthlyTotals
      .filter(({ month }) => matchesMonth(month))
      .reduce(
        (total, period) =>
          total + (type === "INCOME" ? period.income : period.expenses),
        0
      )
  );
}

function getAllTimeCategoryBreakdown(type: TransactionType) {
  const amountsByCategory = new Map<string, number>();
  const profiles = getProfiles(type);

  availableYears.forEach((year, index) => {
    const breakdown = createCategoryBreakdown(
      getPeriodTotal(type, (month) => month.startsWith(`${year}-`)),
      type,
      profiles[index % profiles.length] ?? profiles[0] ?? [],
      getMockCategoryAmounts(type, (date) => date.startsWith(`${year}-`))
    );

    breakdown.forEach((category) => {
      amountsByCategory.set(
        category.id,
        (amountsByCategory.get(category.id) ?? 0) + category.amount
      );
    });
  });

  return createCategoryBreakdownItems(type, amountsByCategory);
}

export function getMockCategoryBreakdown({
  mode,
  selectedMonth,
  selectedYear,
  type
}: CategoryBreakdownRequest) {
  if (mode === "ALL") {
    return getAllTimeCategoryBreakdown(type);
  }

  const profiles = getProfiles(type);
  const profileIndex =
    mode === "MONTH"
      ? Number(selectedMonth.slice(0, 4)) * 12 +
        Number(selectedMonth.slice(5, 7)) -
        1
      : Math.max(availableYears.indexOf(selectedYear), 0);
  const datePrefix =
    mode === "MONTH" ? selectedMonth : `${selectedYear}-`;
  const total = getPeriodTotal(type, (month) =>
    month.startsWith(datePrefix)
  );

  return createCategoryBreakdown(
    total,
    type,
    profiles[profileIndex % profiles.length] ?? profiles[0] ?? [],
    getMockCategoryAmounts(type, (date) => date.startsWith(datePrefix))
  );
}
