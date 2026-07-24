import { useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CalendarDays,
  Calendars,
  ChevronLeft,
  ChevronRight,
  Scale,
  type LucideIcon
} from "lucide-react";

import {
  SlidingSegmentedControl,
  type SlidingSegmentOption
} from "../../components/ui/SlidingSegmentedControl";
import { MonthPicker } from "../../components/ui/MonthPicker";
import { formatEuroAmount } from "../../money/format-euro";
import {
  getCategoryIcon,
  transactionCategories,
  type TransactionType
} from "../transactions/category-catalog";
import {
  mockStatisticsMonthAvailability
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
  ["July", 3325.75, 1918.3],
  ["August", 3100, 2120],
  ["September", 3890, 2650],
  ["October", 3450, 3010],
  ["November", 4200, 2300],
  ["December", 4550, 3400]
]);

const monthlyStats2027 = createMonthlyStats(2027, [
  ["January", 3800, 2700],
  ["February", 3900, 2950],
  ["March", 4400, 2800],
  ["April", 4050, 3300],
  ["May", 4750, 3100],
  ["June", 4300, 3600],
  ["July", 5100, 3350]
]);

const allMonthlyStats: readonly MonthlyStatsPeriod[] = [
  ...monthlyStats2024,
  ...monthlyStats2025,
  ...monthlyStats2026,
  ...monthlyStats2027
];

function toMonthKey(period: MonthlyStatsPeriod) {
  const monthNumber = monthNames.indexOf(period.month) + 1;
  return `${period.year}-${String(monthNumber).padStart(2, "0")}`;
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

const yearlyStats: readonly YearlyStatsPeriod[] = [2024, 2025, 2026, 2027].map(
  summarizeYear
);

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
      label: `Up ${periodLabel}`,
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
  profile: readonly CategoryWeight[]
) {
  if (total <= 0) {
    return [];
  }

  let allocatedAmount = 0;

  return profile
    .map<CategoryBreakdownItem | null>((entry, index) => {
      const category = transactionCategories.find(
        (candidate) => candidate.id === entry.id && candidate.type === type
      );

      if (!category) {
        return null;
      }

      const amount =
        index === profile.length - 1
          ? total - allocatedAmount
          : Math.round(total * entry.share);
      allocatedAmount += amount;

      return {
        id: category.id,
        name: category.name,
        amount,
        percentage: Math.round(entry.share * 100)
      };
    })
    .filter((entry): entry is CategoryBreakdownItem =>
      Boolean(entry && entry.amount > 0)
    )
    .sort((first, second) => second.amount - first.amount);
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
      profiles[index % profiles.length]
    );

    breakdown.forEach((category) => {
      amountsByCategory.set(
        category.id,
        (amountsByCategory.get(category.id) ?? 0) + category.amount
      );
    });
  });

  const totalAmount = [...amountsByCategory.values()].reduce(
    (total, amount) => total + amount,
    0
  );
  const categories = [...amountsByCategory.entries()].map(([id, amount]) => {
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
    .map<CategoryBreakdownItem>((category) => ({
      id: category.id,
      name: category.name,
      amount: category.amount,
      percentage: category.percentage + (roundedUpIds.has(category.id) ? 1 : 0)
    }))
    .sort((first, second) => second.amount - first.amount);
}

type StatsCategoryColumnProps = {
  title: string;
  type: TransactionType;
  categories: readonly CategoryBreakdownItem[];
  valueMode: CategoryValueMode;
  onToggleValueMode: () => void;
};

function StatsCategoryColumn({
  title,
  type,
  categories,
  valueMode,
  onToggleValueMode
}: StatsCategoryColumnProps) {
  const titleId = `stats-category-${type.toLowerCase()}-title`;

  return (
    <section
      className={`stats-category-column stats-category-column--${type.toLowerCase()}`}
      aria-labelledby={titleId}
    >
      <h3 id={titleId}>{title}</h3>

      {categories.length > 0 ? (
        <ul className="stats-category-list">
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
  const label = (
    <span className="stats-insight__label">
      <Icon aria-hidden="true" />
      {insight.label}
    </span>
  );

  return (
    <article
      className={`stats-insight stats-insight--${insight.tone ?? "neutral"}${
        insight.sideValue ? " stats-insight--split" : ""
      }`}
    >
      {insight.sideValue ? (
        <>
          <div className="stats-insight__body">
            {label}
            <strong className="stats-insight__value">{insight.value}</strong>
          </div>
          <strong className="stats-insight__side-value">
            {insight.sideValue}
          </strong>
        </>
      ) : (
        <>
          {label}
          <strong className="stats-insight__value">{insight.value}</strong>
          {insight.detail ? (
            <span className="stats-insight__detail">{insight.detail}</span>
          ) : null}
        </>
      )}
    </article>
  );
}

export function StatsPage() {
  const monthPickerAnchorRef = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<StatsPeriodMode>("MONTH");
  const [selectedMonthKey, setSelectedMonthKey] = useState(
    toMonthKey(allMonthlyStats[allMonthlyStats.length - 1])
  );
  const [yearIndex, setYearIndex] = useState(yearlyStats.length - 1);
  const [categoryValueMode, setCategoryValueMode] =
    useState<CategoryValueMode>("AMOUNT");
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const selectableMonthKeys =
    mockStatisticsMonthAvailability.availableMonths;
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
  const expenseCategoryBreakdown =
    mode === "ALL"
      ? getAllTimeCategoryBreakdown("EXPENSE", expenseCategoryProfiles)
      : getCategoryBreakdown(
          roundedExpenses,
          "EXPENSE",
          expenseCategoryProfiles[
            categoryProfileIndex % expenseCategoryProfiles.length
          ]
        );
  const incomeCategoryBreakdown =
    mode === "ALL"
      ? getAllTimeCategoryBreakdown("INCOME", incomeCategoryProfiles)
      : getCategoryBreakdown(
          roundedIncome,
          "INCOME",
          incomeCategoryProfiles[
            categoryProfileIndex % incomeCategoryProfiles.length
          ]
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
  const topExpense = getTopMovement(selectedMonths, "EXPENSE");
  const topIncome = getTopMovement(selectedMonths, "INCOME");
  const insightRows: StatsInsight[][] = [
    [
      {
        id: "top-income",
        label: "Top income",
        value: topIncome?.date ?? "No data",
        sideValue: topIncome ? formatInsightAmount(topIncome.amount) : "--",
        icon: ArrowUpRight,
        tone: topIncome ? "positive" : "neutral"
      },
      {
        id: "top-expense",
        label: "Top expense",
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
        "Month avg.",
        getPeriodCollectionSummary(selectedMonths),
        CalendarDays
      )
    ]);

    if (mode === "ALL") {
      insightRows.push([
        ...createCollectionInsights(
          "yearly",
          "years",
          "Year avg.",
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
            <strong aria-live="polite">{period.label}</strong>
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
                    className="stats-period-navigation__month-picker"
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
                <strong aria-live="polite">{period.label}</strong>
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

        <section className="stats-money" aria-labelledby="stats-money-title">
          <h2 id="stats-money-title">Money</h2>

          <div className="stats-money__content">
            <div className="stats-money__balance">
              <span>
                <Scale aria-hidden="true" />
                Net balance
              </span>
              <strong className={getValueTone(balance)}>
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
                  {savingsPercentage === null ? "--" : `${savingsPercentage}%`}
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

          <div className="stats-category-columns">
            <StatsCategoryColumn
              title="Expenses"
              type="EXPENSE"
              categories={expenseCategoryBreakdown}
              valueMode={categoryValueMode}
              onToggleValueMode={toggleCategoryValueMode}
            />
            <StatsCategoryColumn
              title="Income"
              type="INCOME"
              categories={incomeCategoryBreakdown}
              valueMode={categoryValueMode}
              onToggleValueMode={toggleCategoryValueMode}
            />
          </div>
        </section>

        <section className="stats-insights" aria-labelledby="stats-insights-title">
          <h2 id="stats-insights-title">Insights</h2>

          <div className="stats-insights__table">
            {insightRows.map((row) => (
              <div className="stats-insights__row" key={row[0].id}>
                {row.map((insight) => (
                  <StatsInsightItem insight={insight} key={insight.id} />
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
