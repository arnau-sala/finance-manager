import { useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Calendar,
  CalendarDays,
  Calendars,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  PiggyBank,
  Scale,
  Trophy,
  type LucideIcon
} from "lucide-react";

import {
  SlidingSegmentedControl,
  type SlidingSegmentOption
} from "../../components/ui/SlidingSegmentedControl";
import { MonthPicker } from "../../components/ui/MonthPicker";
import { YearPicker } from "../../components/ui/YearPicker";
import { formatEuroAmount } from "../../money/format-euro";
import {
  getCategoryIcon,
  transactionCategories,
  type TransactionType
} from "../transactions/category-catalog";
import {
  mockStatisticsMonthAvailability,
  mockStatisticsTransactions,
  mockStatisticsYearAvailability
} from "./statistics-mock";

type StatsPeriodMode = "MONTH" | "YEAR" | "ALL";
type CategoryValueMode = "AMOUNT" | "PERCENTAGE";

type StatsPeriod = {
  label: string;
  income: number;
  expenses: number;
};

type MonthlyStatsPeriod = StatsPeriod & {
  month: MonthName;
  year: number;
};

type YearlyStatsPeriod = StatsPeriod & {
  year: number;
};

type MonthlyStatsSeed = readonly [
  month: MonthName,
  income: number,
  expenses: number
];

type CategoryWeight = {
  id: string;
  share: number;
};

type CategoryBreakdownItem = {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  transactionCount: number;
  averageAmount: number;
};

type ExpenseTransaction = {
  date: string;
  amount: number;
};

type NoSpendStreak = {
  days: number;
  startDate: string | null;
  endDate: string | null;
};

type ExpenseSectionItem = {
  id: string;
  label: string;
  detail?: string;
  value: string;
  icon: LucideIcon;
  earnedTrophy?: boolean;
};

type InsightTone = "positive" | "negative" | "neutral";

type StatsInsight = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
  tone?: InsightTone;
  sideValue?: string;
};

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
] as const;

type MonthName = (typeof monthNames)[number];

const periodOptions: readonly SlidingSegmentOption<StatsPeriodMode>[] = [
  { value: "MONTH", label: "Month", icon: CalendarDays },
  { value: "YEAR", label: "Year", icon: Calendar },
  { value: "ALL", label: "All", icon: Calendars }
];

const categoryTypeOptions: readonly SlidingSegmentOption<TransactionType>[] = [
  { value: "INCOME", label: "Income", icon: ArrowUpRight },
  { value: "EXPENSE", label: "Expenses", icon: ArrowDownRight }
];

function createMonthlyStats(
  year: number,
  entries: readonly MonthlyStatsSeed[]
): readonly MonthlyStatsPeriod[] {
  return entries.map(([month, income, expenses]) => ({
    label: `${month} ${year}`,
    month,
    year,
    income,
    expenses
  }));
}

const monthlyStats2024 = createMonthlyStats(2024, [
  ["March", 2450, 2610],
  ["April", 2250, 2425],
  ["May", 2600, 1850],
  ["June", 2300, 2500],
  ["July", 2800, 2000],
  ["August", 2100, 2240],
  ["September", 2400, 2550],
  ["October", 2500, 2675],
  ["November", 2250, 1500],
  ["December", 2400.5, 1480.25]
]);

const monthlyStats2025 = createMonthlyStats(2025, [
  ["January", 3500, 2200],
  ["February", 3500, 2100],
  ["March", 3650, 2400],
  ["April", 3500, 2250],
  ["May", 3900, 2550],
  ["June", 3650, 4000],
  ["July", 4100, 2600],
  ["August", 3400, 2000],
  ["September", 3700, 2300],
  ["October", 3900, 2500],
  ["November", 3600, 1800],
  ["December", 4100.2, 2425.85]
]);

const monthlyStats2026 = createMonthlyStats(2026, [
  ["January", 3250, 2450.8],
  ["February", 0, 482.65],
  ["March", 4250, 1987.45],
  ["April", 2350, 2784.2],
  ["May", 5175.4, 2240.75],
  ["June", 2890, 2455.85],
  ["July", 3325.75, 1918.3]
]);

function toMonthKey(period: MonthlyStatsPeriod) {
  const monthNumber = monthNames.indexOf(period.month) + 1;
  return `${period.year}-${String(monthNumber).padStart(2, "0")}`;
}

function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

const currentMonthKey = getLocalDateKey().slice(0, 7);
const allMonthlyStats: readonly MonthlyStatsPeriod[] = [
  ...monthlyStats2024,
  ...monthlyStats2025,
  ...monthlyStats2026
].filter((period) => toMonthKey(period) <= currentMonthKey);

function getInitialMonthKey(availableMonths: readonly string[]) {
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}`;

  for (let index = availableMonths.length - 1; index >= 0; index -= 1) {
    const month = availableMonths[index];

    if (month && month <= currentMonth) {
      return month;
    }
  }

  return currentMonth;
}

function formatMonthKey(month: string) {
  const [year, monthNumber] = month.split("-");
  const monthName = monthNames[Number(monthNumber) - 1];

  return `${monthName?.slice(0, 3) ?? month} ${year}`;
}

function createEmptyMonthlyPeriod(month: string): MonthlyStatsPeriod {
  const [yearPart, monthPart] = month.split("-");
  const year = Number(yearPart);
  const monthIndex = Number(monthPart) - 1;
  const monthName = monthNames[monthIndex] ?? monthNames[0];

  return {
    label: `${monthName} ${year}`,
    month: monthName,
    year,
    income: 0,
    expenses: 0
  };
}

function getMonthlyPeriod(month: string) {
  return (
    allMonthlyStats.find((period) => toMonthKey(period) === month) ??
    createEmptyMonthlyPeriod(month)
  );
}

function summarizeYear(year: number): YearlyStatsPeriod {
  return allMonthlyStats
    .filter((period) => period.year === year)
    .reduce<YearlyStatsPeriod>(
      (total, period) => ({
        ...total,
        income: total.income + period.income,
        expenses: total.expenses + period.expenses
      }),
      { label: String(year), year, income: 0, expenses: 0 }
    );
}

const yearlyStats: readonly YearlyStatsPeriod[] = [
  ...new Set(allMonthlyStats.map((period) => period.year))
].map(summarizeYear);

const allTimeStats = yearlyStats.reduce<StatsPeriod>(
  (total, period) => ({
    label: "All time",
    income: total.income + period.income,
    expenses: total.expenses + period.expenses
  }),
  { label: "All time", income: 0, expenses: 0 }
);

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

const mockTypicalTransactionAmounts: Readonly<Record<string, number>> = {
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

const millisecondsPerDay = 24 * 60 * 60 * 1000;
const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC"
});
const fullDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC"
});
const weekdayFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  timeZone: "UTC"
});

function parseDateParts(date: string) {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return { year, month, day };
}

function toDayNumber(date: string) {
  const { year, month, day } = parseDateParts(date);
  return Math.floor(Date.UTC(year, month - 1, day) / millisecondsPerDay);
}

function fromDayNumber(dayNumber: number) {
  return new Date(dayNumber * millisecondsPerDay)
    .toISOString()
    .slice(0, 10);
}

function toUtcDate(date: string) {
  const { year, month, day } = parseDateParts(date);
  return new Date(Date.UTC(year, month - 1, day));
}

function getPeriodDateRange(
  mode: StatsPeriodMode,
  periods: readonly MonthlyStatsPeriod[],
  transactions: readonly ExpenseTransaction[]
) {
  const firstPeriod = periods[0];
  const lastPeriod = periods[periods.length - 1];

  if (!firstPeriod || !lastPeriod) {
    return null;
  }

  if (mode === "ALL" && transactions.length > 0) {
    const dates = transactions.map((transaction) => transaction.date).sort();
    return {
      startDate: dates[0],
      endDate: dates[dates.length - 1]
    };
  }

  const firstMonth = monthNames.indexOf(firstPeriod.month) + 1;
  const lastMonth = monthNames.indexOf(lastPeriod.month) + 1;
  const lastDay = new Date(
    Date.UTC(lastPeriod.year, lastMonth, 0)
  ).getUTCDate();
  const startDate = `${firstPeriod.year}-${String(firstMonth).padStart(
    2,
    "0"
  )}-01`;
  const naturalEndDate = `${lastPeriod.year}-${String(lastMonth).padStart(
    2,
    "0"
  )}-${String(lastDay).padStart(2, "0")}`;
  const endDate = naturalEndDate > getLocalDateKey()
    ? getLocalDateKey()
    : naturalEndDate;

  if (startDate > endDate) {
    return null;
  }

  return {
    startDate,
    endDate
  };
}

function createMockExpenseTransactions(
  periods: readonly MonthlyStatsPeriod[]
) {
  return periods.flatMap<ExpenseTransaction>((period) => {
    const monthKey = toMonthKey(period);
    const sourceTransactions = mockStatisticsTransactions.filter(
      (transaction) =>
        transaction.date.startsWith(monthKey) && transaction.type !== "INCOME"
    );
    const totalCents = Math.max(0, Math.round(period.expenses * 100));

    if (sourceTransactions.length === 0 || totalCents === 0) {
      return [];
    }

    const flexibleTransactions = sourceTransactions.filter(
      (transaction) => transaction.amountCents === undefined
    );
    const fixedTotal = sourceTransactions.reduce(
      (total, transaction) => total + (transaction.amountCents ?? 0),
      0
    );
    const amountToDistribute = Math.max(0, totalCents - fixedTotal);
    const weights = flexibleTransactions.map((transaction, index) => {
      const day = Number(transaction.date.slice(-2));
      return 1 + ((day * 3 + index * 5) % 9);
    });
    const totalWeight = weights.reduce((total, weight) => total + weight, 0);
    let distributedAmount = 0;
    let flexibleIndex = 0;

    return sourceTransactions.map((transaction) => {
      if (transaction.amountCents !== undefined) {
        return {
          date: transaction.date,
          amount: transaction.amountCents / 100
        };
      }

      const isLastFlexible =
        flexibleIndex === flexibleTransactions.length - 1;
      const amountCents = isLastFlexible
        ? amountToDistribute - distributedAmount
        : Math.round(
            amountToDistribute *
              ((weights[flexibleIndex] ?? 0) / Math.max(totalWeight, 1))
          );
      distributedAmount += amountCents;
      flexibleIndex += 1;

      return {
        date: transaction.date,
        amount: Math.max(0, amountCents) / 100
      };
    });
  });
}

function getMedian(values: readonly number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sortedValues = [...values].sort((first, second) => first - second);
  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[middleIndex] ?? 0;
  }

  return (
    ((sortedValues[middleIndex - 1] ?? 0) +
      (sortedValues[middleIndex] ?? 0)) /
    2
  );
}

function getNoSpendStreaks(
  transactions: readonly ExpenseTransaction[],
  startDate: string,
  endDate: string
) {
  const startDay = toDayNumber(startDate);
  const endDay = toDayNumber(endDate);
  const expenseDays = new Set(
    transactions.map((transaction) => toDayNumber(transaction.date))
  );
  let currentStart: number | null = null;
  let longest: NoSpendStreak = {
    days: 0,
    startDate: null,
    endDate: null
  };

  function finishStreak(streakEnd: number) {
    if (currentStart === null) {
      return;
    }

    const days = streakEnd - currentStart + 1;

    if (days > longest.days) {
      longest = {
        days,
        startDate: fromDayNumber(currentStart),
        endDate: fromDayNumber(streakEnd)
      };
    }

    currentStart = null;
  }

  for (let day = startDay; day <= endDay; day += 1) {
    if (expenseDays.has(day)) {
      finishStreak(day - 1);
    } else if (currentStart === null) {
      currentStart = day;
    }
  }

  finishStreak(endDay);

  let currentDays = 0;

  for (
    let day = endDay;
    day >= startDay && !expenseDays.has(day);
    day -= 1
  ) {
    currentDays += 1;
  }

  const current: NoSpendStreak = {
    days: currentDays,
    startDate:
      currentDays > 0 ? fromDayNumber(endDay - currentDays + 1) : null,
    endDate: currentDays > 0 ? endDate : null
  };

  return {
    current,
    longest,
    isLongestCurrent: current.days > 0 && current.days === longest.days
  };
}

function formatNoSpendStart(streak: NoSpendStreak) {
  if (!streak.startDate || !streak.endDate || streak.days === 0) {
    return "No active streak";
  }

  if (streak.days === 1) {
    return "Since today";
  }

  if (streak.days === 2) {
    return "Since yesterday";
  }

  const start = toUtcDate(streak.startDate);

  if (streak.days <= 6) {
    return `Since ${weekdayFormatter.format(start)}`;
  }

  const end = toUtcDate(streak.endDate);
  const formatter =
    start.getUTCFullYear() === end.getUTCFullYear()
      ? shortDateFormatter
      : fullDateFormatter;

  return `Since ${formatter.format(start)}`;
}

function formatStreakPeriod(
  streak: NoSpendStreak,
  includeYear: boolean
) {
  if (!streak.startDate || !streak.endDate || streak.days === 0) {
    return "No streak in this period";
  }

  const start = toUtcDate(streak.startDate);
  const end = toUtcDate(streak.endDate);
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startMonth = start.toLocaleString("en-GB", {
    month: "short",
    timeZone: "UTC"
  });
  const endMonth = end.toLocaleString("en-GB", {
    month: "short",
    timeZone: "UTC"
  });
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();

  if (startYear === endYear && start.getUTCMonth() === end.getUTCMonth()) {
    const dateRange =
      startDay === endDay
        ? `${startDay} ${startMonth}`
        : `${startDay}-${endDay} ${startMonth}`;
    return includeYear ? `${dateRange} ${startYear}` : dateRange;
  }

  if (startYear === endYear) {
    const dateRange = `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
    return includeYear ? `${dateRange} ${startYear}` : dateRange;
  }

  return `${startDay} ${startMonth} ${startYear} - ${endDay} ${endMonth} ${endYear}`;
}

function formatDayCount(days: number) {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function getValueTone(value: number) {
  if (value > 0) return "stats-value--positive";
  if (value < 0) return "stats-value--negative";
  return undefined;
}

function getInsightTone(value: number): InsightTone {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function getPeriodMetrics<Period extends StatsPeriod>(period: Period) {
  const income = Math.round(period.income);
  const expenses = Math.round(period.expenses);
  const balance = income - expenses;

  return {
    period,
    balance,
    savingsPercentage:
      income > 0 ? Math.round((balance / income) * 100) : null
  };
}

function getPeriodExtreme<Period extends StatsPeriod>(
  periods: readonly Period[],
  direction: "BEST" | "WORST"
) {
  const candidates = periods
    .map(getPeriodMetrics)
    .filter(
      (
        candidate
      ): candidate is ReturnType<typeof getPeriodMetrics<Period>> & {
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
      const shouldReplace =
        direction === "BEST"
          ? percentageDifference > 0 ||
            (percentageDifference === 0 && candidate.balance > selected.balance)
          : percentageDifference < 0 ||
            (percentageDifference === 0 && candidate.balance < selected.balance);

      return shouldReplace ? candidate : selected;
    },
    null
  );
}

function getPeriodCollectionSummary(periods: readonly StatsPeriod[]) {
  const metrics = periods.map(getPeriodMetrics);
  const positivePeriods = metrics.filter((period) => period.balance > 0).length;
  const totalBalance = metrics.reduce(
    (total, period) => total + period.balance,
    0
  );
  const totalIncome = periods.reduce(
    (total, period) => total + Math.round(period.income),
    0
  );

  return {
    positivePeriods,
    totalPeriods: periods.length,
    positivePercentage:
      periods.length > 0
        ? Math.round((positivePeriods / periods.length) * 100)
        : 0,
    averageBalance:
      periods.length > 0 ? Math.round(totalBalance / periods.length) : 0,
    averageSavingsPercentage:
      totalIncome > 0 ? Math.round((totalBalance / totalIncome) * 100) : null
  };
}

function getTopMovement(
  periods: readonly MonthlyStatsPeriod[],
  type: TransactionType
) {
  const estimatedTransactionShare = type === "INCOME" ? 0.58 : 0.34;
  const transactionDay = type === "INCOME" ? 25 : 12;

  return periods.reduce<{
    amount: number;
    date: string;
  } | null>((topMovement, period) => {
    const periodTotal = type === "INCOME" ? period.income : period.expenses;
    const amount = Math.round(periodTotal * estimatedTransactionShare);

    if (amount <= 0 || (topMovement && amount <= topMovement.amount)) {
      return topMovement;
    }

    return {
      amount,
      date: `${transactionDay} ${period.month.slice(0, 3)} ${period.year}`
    };
  }, null);
}

function formatInsightAmount(value: number, showSign = false) {
  return formatEuroAmount(value, { fractionDigits: 0, showSign });
}

function createExtremeInsight(
  id: string,
  label: string,
  extreme:
    | ReturnType<typeof getPeriodExtreme<MonthlyStatsPeriod>>
    | ReturnType<typeof getPeriodExtreme<YearlyStatsPeriod>>,
  icon: LucideIcon,
  tone: Exclude<InsightTone, "neutral">
): StatsInsight {
  if (!extreme) {
    return {
      id,
      label,
      value: "--",
      sideValue: "--",
      icon,
      tone: "neutral"
    };
  }

  const sideValue =
    "month" in extreme.period
      ? `${extreme.period.month.slice(0, 3)} ${String(
          extreme.period.year
        ).slice(-2)}`
      : extreme.period.label;

  return {
    id,
    label,
    value: `${formatInsightAmount(extreme.balance, true)} (${
      extreme.savingsPercentage
    }%)`,
    sideValue,
    icon,
    tone
  };
}

function createCollectionInsights(
  idPrefix: string,
  periodLabel: "months" | "years",
  averageLabel: string,
  summary: ReturnType<typeof getPeriodCollectionSummary>,
  icon: LucideIcon
): readonly StatsInsight[] {
  return [
    {
      id: `${idPrefix}-positive`,
      label: `Positive ${periodLabel}`,
      value: `${summary.positivePercentage}% positive`,
      sideValue: `${summary.positivePeriods}/${summary.totalPeriods}`,
      icon,
      tone:
        summary.totalPeriods === 0
          ? "neutral"
          : summary.positivePeriods * 2 < summary.totalPeriods
            ? "negative"
            : "positive"
    },
    {
      id: `${idPrefix}-average`,
      label: averageLabel,
      value:
        summary.averageSavingsPercentage === null
          ? "Saved --"
          : `Saved ${summary.averageSavingsPercentage}%`,
      sideValue: formatInsightAmount(summary.averageBalance, true),
      icon: Scale,
      tone: getInsightTone(summary.averageBalance)
    }
  ];
}

function getCategoryBreakdown(
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
    100 - categories.reduce((total, category) => total + category.percentage, 0);
  const roundedUpIds = new Set(
    [...categories]
      .sort(
        (first, second) =>
          second.remainder - first.remainder || second.amount - first.amount
      )
      .slice(0, percentagePointsToAssign)
      .map((category) => category.id)
  );

  return categories
    .map<CategoryBreakdownItem>((category) => {
      const typicalAmount =
        mockTypicalTransactionAmounts[category.id] ??
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

function getAllTimeCategoryBreakdown(
  type: TransactionType,
  profiles: readonly (readonly CategoryWeight[])[]
) {
  const amountsByCategory = new Map<string, number>();

  yearlyStats.forEach((period, index) => {
    const total = Math.round(
      type === "EXPENSE" ? period.expenses : period.income
    );
    const breakdown = getCategoryBreakdown(
      total,
      type,
      profiles[index % profiles.length],
      getMockCategoryAmounts(type, (date) =>
        date.startsWith(`${period.year}-`)
      )
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

type StatsCategoryListProps = {
  type: TransactionType;
  categories: readonly CategoryBreakdownItem[];
  valueMode: CategoryValueMode;
  onToggleValueMode: () => void;
};

function StatsCategoryList({
  type,
  categories,
  valueMode,
  onToggleValueMode
}: StatsCategoryListProps) {
  const showAverageColumn = categories.some(
    (category) => category.transactionCount > 1
  );

  return (
    <section
      className={`stats-category-panel stats-category-panel--${type.toLowerCase()}`}
      aria-label={`${type === "INCOME" ? "Income" : "Expense"} categories`}
    >
      {categories.length > 0 ? (
        <ul
          className={`stats-category-list${
            showAverageColumn ? " stats-category-list--with-average" : ""
          }`}
        >
          {categories.map((category) => {
            const Icon = getCategoryIcon(category.id, type);

            return (
              <li key={category.id} className="stats-category-row">
                <span className="stats-category-row__icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="stats-category-row__details">
                  <strong>{category.name}</strong>
                </span>
                <span
                  className="stats-category-row__metric"
                  aria-label={`${category.transactionCount} ${
                    category.transactionCount === 1
                      ? "transaction"
                      : "transactions"
                  }`}
                >
                  <span>{category.transactionCount} tx</span>
                </span>
                {showAverageColumn ? (
                  <span
                    className="stats-category-row__metric"
                    aria-label={`Average transaction ${formatEuroAmount(
                      category.averageAmount,
                      { fractionDigits: 0 }
                    )}`}
                  >
                    {`Avg. ${formatEuroAmount(category.averageAmount, {
                      fractionDigits: 0
                    })}`}
                  </span>
                ) : null}
                <button
                  className="stats-category-row__values"
                  type="button"
                  onClick={onToggleValueMode}
                  aria-label={`Show all category values as ${
                    valueMode === "AMOUNT" ? "percentages" : "amounts"
                  }`}
                >
                  <strong>
                    {valueMode === "AMOUNT"
                      ? formatEuroAmount(category.amount, { fractionDigits: 0 })
                      : `${category.percentage}%`}
                  </strong>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="stats-category-empty">
          No {type === "EXPENSE" ? "expenses" : "income"} in this period.
        </p>
      )}
    </section>
  );
}

function StatsInsightItem({ insight }: { insight: StatsInsight }) {
  const Icon = insight.icon;
  const value = insight.sideValue ?? insight.value;
  const detail = insight.sideValue ? insight.value : (insight.detail ?? "");

  return (
    <li
      className={`stats-insight-row stats-insight-row--${
        insight.tone ?? "neutral"
      }`}
    >
      <span className="stats-insight-row__icon" aria-hidden="true">
        <Icon />
      </span>
      <span className="stats-insight-row__details">
        <strong>{insight.label}</strong>
      </span>
      <span className="stats-insight-row__detail">{detail}</span>
      <strong className="stats-insight-row__value">{value}</strong>
    </li>
  );
}

function StatsExpenseItem({ item }: { item: ExpenseSectionItem }) {
  const Icon = item.icon;

  return (
    <li className="stats-expense-row">
      <span className="stats-expense-row__icon" aria-hidden="true">
        <Icon />
      </span>
      <span className="stats-expense-row__details">
        <strong>
          {item.label}
          {item.earnedTrophy ? (
            <Trophy
              className="stats-expense-row__trophy"
              aria-label="Current streak is the longest"
            />
          ) : null}
        </strong>
      </span>
      <span className="stats-expense-row__detail">{item.detail ?? ""}</span>
      <strong className="stats-expense-row__value">{item.value}</strong>
    </li>
  );
}

export function StatsPage() {
  const monthPickerAnchorRef = useRef<HTMLButtonElement>(null);
  const yearPickerAnchorRef = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<StatsPeriodMode>("MONTH");
  const [selectedMonthKey, setSelectedMonthKey] = useState(() =>
    getInitialMonthKey(mockStatisticsMonthAvailability.availableMonths)
  );
  const [yearIndex, setYearIndex] = useState(yearlyStats.length - 1);
  const [categoryValueMode, setCategoryValueMode] =
    useState<CategoryValueMode>("AMOUNT");
  const [categoryType, setCategoryType] =
    useState<TransactionType>("INCOME");
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const selectableMonthKeys =
    mockStatisticsMonthAvailability.availableMonths;
  const firstAvailableMonth =
    mockStatisticsMonthAvailability.minimumMonth ?? currentMonthKey;
  const allPeriodLabel = `${formatMonthKey(
    firstAvailableMonth
  )} - ${formatMonthKey(currentMonthKey)}`;
  const monthIndex = Math.max(
    selectableMonthKeys.indexOf(selectedMonthKey),
    0
  );
  const selectedMonth = getMonthlyPeriod(selectedMonthKey);
  const periodIndex = mode === "MONTH" ? monthIndex : yearIndex;
  const periodCount =
    mode === "MONTH" ? selectableMonthKeys.length : yearlyStats.length;
  const period =
    mode === "ALL"
      ? allTimeStats
      : mode === "MONTH"
        ? selectedMonth
        : yearlyStats[yearIndex];
  const categoryProfileIndex =
    mode === "MONTH"
      ? selectedMonth.year * 12 + monthNames.indexOf(selectedMonth.month)
      : periodIndex;
  const roundedIncome = Math.round(period.income);
  const roundedExpenses = Math.round(period.expenses);
  const balance = roundedIncome - roundedExpenses;
  const savingsPercentage =
    roundedIncome > 0 ? Math.round((balance / roundedIncome) * 100) : null;
  const categoryPeriodPrefix =
    mode === "MONTH"
      ? selectedMonthKey
      : mode === "YEAR"
        ? `${yearlyStats[yearIndex].year}-`
        : null;
  const expenseCategoryBreakdown =
    mode === "ALL"
      ? getAllTimeCategoryBreakdown("EXPENSE", expenseCategoryProfiles)
      : getCategoryBreakdown(
          roundedExpenses,
          "EXPENSE",
          expenseCategoryProfiles[
            categoryProfileIndex % expenseCategoryProfiles.length
          ],
          getMockCategoryAmounts(
            "EXPENSE",
            (date) =>
              categoryPeriodPrefix !== null &&
              date.startsWith(categoryPeriodPrefix)
          )
        );
  const incomeCategoryBreakdown =
    mode === "ALL"
      ? getAllTimeCategoryBreakdown("INCOME", incomeCategoryProfiles)
      : getCategoryBreakdown(
          roundedIncome,
          "INCOME",
          incomeCategoryProfiles[
            categoryProfileIndex % incomeCategoryProfiles.length
          ],
          getMockCategoryAmounts(
            "INCOME",
            (date) =>
              categoryPeriodPrefix !== null &&
              date.startsWith(categoryPeriodPrefix)
          )
        );
  const selectedMonths =
    mode === "MONTH"
      ? [selectedMonth]
      : mode === "YEAR"
        ? allMonthlyStats.filter(
            (monthlyPeriod) =>
              monthlyPeriod.year === yearlyStats[yearIndex].year
          )
        : allMonthlyStats;
  const mockExpenseTransactions =
    createMockExpenseTransactions(selectedMonths);
  const expenseRange = getPeriodDateRange(
    mode,
    selectedMonths,
    mockExpenseTransactions
  );
  const noSpendStreaks = expenseRange
    ? getNoSpendStreaks(
        mockExpenseTransactions,
        expenseRange.startDate,
        expenseRange.endDate
      )
    : {
        current: { days: 0, startDate: null, endDate: null },
        longest: { days: 0, startDate: null, endDate: null },
        isLongestCurrent: false
      };
  const averagePeriodCount =
    mode === "MONTH"
      ? expenseRange
        ? toDayNumber(expenseRange.endDate) -
          toDayNumber(expenseRange.startDate) +
          1
        : 1
      : mode === "YEAR"
        ? Math.max(selectedMonths.length, 1)
        : Math.max(
            new Set(selectedMonths.map((monthlyPeriod) => monthlyPeriod.year))
              .size,
            1
          );
  const averageExpense = roundedExpenses / averagePeriodCount;
  const typicalExpense = getMedian(
    mockExpenseTransactions.map((transaction) => transaction.amount)
  );
  const averageExpenseLabel =
    mode === "MONTH"
      ? "Daily Avg. expense"
      : mode === "YEAR"
        ? "Monthly Avg. expense"
        : "Yearly Avg. expense";
  const averageExpenseUnit =
    mode === "MONTH" ? "day" : mode === "YEAR" ? "month" : "year";
  const averageExpenseIcon =
    mode === "MONTH" ? CalendarDays : mode === "YEAR" ? Calendar : Calendars;
  const expenseItems: readonly ExpenseSectionItem[] = [
    {
      id: "typical-expense",
      label: "Typical expense",
      detail: `${mockExpenseTransactions.length} ${
        mockExpenseTransactions.length === 1 ? "expense" : "expenses"
      }`,
      value: formatEuroAmount(typicalExpense, { fractionDigits: 0 }),
      icon: ChartColumn
    },
    {
      id: "average-expense",
      label: averageExpenseLabel,
      detail: `${averagePeriodCount} ${averageExpenseUnit}${
        averagePeriodCount === 1 ? "" : "s"
      }`,
      value: formatEuroAmount(averageExpense, { fractionDigits: 0 }),
      icon: averageExpenseIcon
    },
    {
      id: "no-spend-days",
      label: "No-spend streak",
      detail: formatNoSpendStart(noSpendStreaks.current),
      value: formatDayCount(noSpendStreaks.current.days),
      icon: PiggyBank,
      earnedTrophy: noSpendStreaks.isLongestCurrent
    },
    {
      id: "longest-no-spend-streak",
      label: "Longest streak",
      detail: formatStreakPeriod(noSpendStreaks.longest, mode === "ALL"),
      value: formatDayCount(noSpendStreaks.longest.days),
      icon: Award
    }
  ];
  const topExpense = getTopMovement(selectedMonths, "EXPENSE");
  const topIncome = getTopMovement(selectedMonths, "INCOME");
  const insightRows: StatsInsight[][] = [
    [
      {
        id: "top-income",
        label: "Largest income",
        value: topIncome?.date ?? "No data",
        sideValue: topIncome ? formatInsightAmount(topIncome.amount) : "--",
        icon: ArrowUpRight,
        tone: topIncome ? "positive" : "neutral"
      },
      {
        id: "top-expense",
        label: "Largest expense",
        value: topExpense?.date ?? "No data",
        sideValue: topExpense ? formatInsightAmount(topExpense.amount) : "--",
        icon: ArrowDownRight,
        tone: topExpense ? "negative" : "neutral"
      }
    ]
  ];

  if (mode !== "MONTH") {
    insightRows.push([
      createExtremeInsight(
        "best-month",
        "Best month",
        getPeriodExtreme(selectedMonths, "BEST"),
        CalendarDays,
        "positive"
      ),
      createExtremeInsight(
        "worst-month",
        "Worst month",
        getPeriodExtreme(selectedMonths, "WORST"),
        CalendarDays,
        "negative"
      )
    ]);

    if (mode === "ALL") {
      insightRows.push([
        createExtremeInsight(
          "best-year",
          "Best year",
          getPeriodExtreme(yearlyStats, "BEST"),
          Calendar,
          "positive"
        ),
        createExtremeInsight(
          "worst-year",
          "Worst year",
          getPeriodExtreme(yearlyStats, "WORST"),
          Calendar,
          "negative"
        )
      ]);
    }

    insightRows.push([
      ...createCollectionInsights(
        "monthly",
        "months",
        "Avg. month balance",
        getPeriodCollectionSummary(selectedMonths),
        CalendarDays
      )
    ]);

    if (mode === "ALL") {
      insightRows.push([
        ...createCollectionInsights(
          "yearly",
          "years",
          "Avg. year balance",
          getPeriodCollectionSummary(yearlyStats),
          Calendars
        )
      ]);
    }
  }

  function changePeriod(nextIndex: number) {
    if (mode === "ALL") {
      return;
    }

    if (mode === "MONTH") {
      const nextMonth = selectableMonthKeys[nextIndex];

      if (nextMonth) {
        setSelectedMonthKey(nextMonth);
      }
      return;
    }

    if (nextIndex >= 0 && nextIndex < yearlyStats.length) {
      setYearIndex(nextIndex);
    }
  }

  function toggleCategoryValueMode() {
    setCategoryValueMode((currentMode) =>
      currentMode === "AMOUNT" ? "PERCENTAGE" : "AMOUNT"
    );
  }

  function selectYear(year: number) {
    const nextYearIndex = yearlyStats.findIndex(
      (yearlyPeriod) => yearlyPeriod.year === year
    );

    if (nextYearIndex >= 0) {
      setYearIndex(nextYearIndex);
    }
  }

  return (
    <section
      className="home-content home-content--stats"
      aria-labelledby="stats-page-title"
    >
      <div className="stats-page">
        <header className="stats-page__header">
          <h1 id="stats-page-title">Stats</h1>
        </header>

        <SlidingSegmentedControl
          className="stats-period-mode"
          value={mode}
          options={periodOptions}
          onChange={setMode}
          label="Statistics period"
          compact
        />

        <nav
          className={`stats-period-navigation${
            mode === "ALL" ? " stats-period-navigation--all" : ""
          }`}
          aria-label="Select period"
        >
          {mode === "ALL" ? (
            <strong aria-live="polite">{allPeriodLabel}</strong>
          ) : (
            <>
              <button
                type="button"
                onClick={() => changePeriod(periodIndex - 1)}
                disabled={periodIndex === 0}
                aria-label="Previous period"
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              {mode === "MONTH" ? (
                <span
                  className="stats-period-navigation__label"
                  aria-live="polite"
                >
                  <button
                    ref={monthPickerAnchorRef}
                    className="stats-period-navigation__picker"
                    type="button"
                    aria-haspopup="dialog"
                    aria-expanded={isMonthPickerOpen}
                    onClick={() => setIsMonthPickerOpen(true)}
                  >
                    <span>{selectedMonth.month}</span>
                    <span>{selectedMonth.year}</span>
                  </button>
                </span>
              ) : (
                <span
                  className="stats-period-navigation__label"
                  aria-live="polite"
                >
                  {mockStatisticsYearAvailability.availableYears.length > 1 ? (
                    <button
                      ref={yearPickerAnchorRef}
                      className="stats-period-navigation__picker"
                      type="button"
                      aria-haspopup="dialog"
                      aria-expanded={isYearPickerOpen}
                      onClick={() => setIsYearPickerOpen(true)}
                    >
                      {period.label}
                    </button>
                  ) : (
                    <strong>{period.label}</strong>
                  )}
                </span>
              )}
              <button
                type="button"
                onClick={() => changePeriod(periodIndex + 1)}
                disabled={periodIndex === periodCount - 1}
                aria-label="Next period"
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </>
          )}
        </nav>

        <MonthPicker
          open={isMonthPickerOpen}
          anchorRef={monthPickerAnchorRef}
          value={selectedMonthKey}
          availableMonths={mockStatisticsMonthAvailability.availableMonths}
          minimumMonth={mockStatisticsMonthAvailability.minimumMonth}
          maximumMonth={mockStatisticsMonthAvailability.maximumMonth}
          onSelect={setSelectedMonthKey}
          onClose={() => setIsMonthPickerOpen(false)}
        />

        <YearPicker
          open={isYearPickerOpen}
          anchorRef={yearPickerAnchorRef}
          value={yearlyStats[yearIndex].year}
          availableYears={mockStatisticsYearAvailability.availableYears}
          minimumYear={mockStatisticsYearAvailability.minimumYear}
          maximumYear={mockStatisticsYearAvailability.maximumYear}
          onSelect={selectYear}
          onClose={() => setIsYearPickerOpen(false)}
        />

        <div className="stats-sections">
          <section className="stats-money" aria-labelledby="stats-money-title">
            <h2 id="stats-money-title">Money</h2>

            <div className="stats-money__content">
              <div className="stats-money__balance">
                <span>
                  <Scale aria-hidden="true" />
                  Net balance
                </span>
                <strong
                  className={getValueTone(balance)}
                >
                  {formatEuroAmount(balance, {
                    showSign: true,
                    fractionDigits: 0
                  })}
                </strong>
                <p
                  className="stats-money__saved-rate"
                  aria-label="Percentage of income saved"
                >
                  Saved:{" "}
                  <strong
                    className={
                      savingsPercentage === null
                        ? undefined
                        : getValueTone(savingsPercentage)
                    }
                  >
                    {savingsPercentage === null
                      ? "--"
                      : `${savingsPercentage}%`}
                  </strong>
                </p>
              </div>

              <div className="stats-money__breakdown">
                <div>
                  <span>
                    <ArrowUpRight aria-hidden="true" />
                    Income
                  </span>
                  <strong className="stats-value--positive">
                    {formatEuroAmount(roundedIncome, { fractionDigits: 0 })}
                  </strong>
                </div>
                <div>
                  <span>
                    <ArrowDownRight aria-hidden="true" />
                    Expenses
                  </span>
                  <strong className="stats-value--negative">
                    {formatEuroAmount(roundedExpenses, { fractionDigits: 0 })}
                  </strong>
                </div>
              </div>
            </div>
          </section>

          <section
            className="stats-categories"
            aria-labelledby="stats-categories-title"
          >
            <h2 id="stats-categories-title">Categories</h2>

            <SlidingSegmentedControl
              className="stats-category-type"
              value={categoryType}
              options={categoryTypeOptions}
              onChange={setCategoryType}
              label="Category type"
              tone={categoryType === "INCOME" ? "income" : "expense"}
              compact
            />

            <StatsCategoryList
              type={categoryType}
              categories={
                categoryType === "INCOME"
                  ? incomeCategoryBreakdown
                  : expenseCategoryBreakdown
              }
              valueMode={categoryValueMode}
              onToggleValueMode={toggleCategoryValueMode}
            />
          </section>

          <section
            className="stats-insights"
            aria-labelledby="stats-insights-title"
          >
            <h2 id="stats-insights-title">Insights</h2>

            <ul className="stats-insights__list">
              {insightRows.flat().map((insight) => (
                <StatsInsightItem insight={insight} key={insight.id} />
              ))}
            </ul>
          </section>

          <section
            className="stats-expenses"
            aria-labelledby="stats-expenses-title"
          >
            <h2 id="stats-expenses-title">Expenses</h2>

            <ul className="stats-expenses__list">
              {expenseItems.map((item) => (
                <StatsExpenseItem item={item} key={item.id} />
              ))}
            </ul>
          </section>
        </div>
      </div>
    </section>
  );
}
