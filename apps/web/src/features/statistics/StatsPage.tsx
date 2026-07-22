import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Scale
} from "lucide-react";

import {
  SlidingSegmentedControl,
  type SlidingSegmentOption
} from "../../components/ui/SlidingSegmentedControl";
import { formatEuroAmount } from "../../money/format-euro";
import {
  getCategoryIcon,
  transactionCategories,
  type TransactionType
} from "../transactions/category-catalog";

type StatsPeriodMode = "MONTH" | "YEAR";
type CategoryValueMode = "AMOUNT" | "PERCENTAGE";

type StatsPeriod = {
  label: string;
  income: number;
  expenses: number;
};

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

const periodOptions: readonly SlidingSegmentOption<StatsPeriodMode>[] = [
  { value: "MONTH", label: "Month", icon: CalendarDays },
  { value: "YEAR", label: "Year", icon: CalendarRange }
];

const monthlyStats: readonly StatsPeriod[] = [
  { label: "January 2026", income: 3250, expenses: 2450.8 },
  { label: "February 2026", income: 0, expenses: 482.65 },
  { label: "March 2026", income: 4250, expenses: 1987.45 },
  { label: "April 2026", income: 2350, expenses: 2784.2 },
  { label: "May 2026", income: 5175.4, expenses: 2240.75 },
  { label: "June 2026", income: 2890, expenses: 2455.85 },
  { label: "July 2026", income: 3325.75, expenses: 1918.3 }
];

const yearlyStats: readonly StatsPeriod[] = [
  { label: "2024", income: 28450.5, expenses: 21680.25 },
  { label: "2025", income: 44500.2, expenses: 29125.85 },
  { label: "2026", income: 21241.15, expenses: 14320 }
];

const expenseCategoryProfiles: readonly (readonly CategoryWeight[])[] = [
  [
    { id: "expense-housing", share: 0.38 },
    { id: "expense-groceries", share: 0.23 },
    { id: "expense-dining", share: 0.14 },
    { id: "expense-transportation", share: 0.1 },
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
    { id: "expense-transportation", share: 0.08 }
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

export function StatsPage() {
  const [mode, setMode] = useState<StatsPeriodMode>("MONTH");
  const [monthIndex, setMonthIndex] = useState(monthlyStats.length - 1);
  const [yearIndex, setYearIndex] = useState(yearlyStats.length - 1);
  const [categoryValueMode, setCategoryValueMode] =
    useState<CategoryValueMode>("AMOUNT");
  const periods = mode === "MONTH" ? monthlyStats : yearlyStats;
  const periodIndex = mode === "MONTH" ? monthIndex : yearIndex;
  const period = periods[periodIndex];
  const roundedIncome = Math.round(period.income);
  const roundedExpenses = Math.round(period.expenses);
  const balance = roundedIncome - roundedExpenses;
  const savingsPercentage =
    roundedIncome > 0 ? Math.round((balance / roundedIncome) * 100) : null;
  const expenseCategoryBreakdown = getCategoryBreakdown(
    roundedExpenses,
    "EXPENSE",
    expenseCategoryProfiles[periodIndex % expenseCategoryProfiles.length]
  );
  const incomeCategoryBreakdown = getCategoryBreakdown(
    roundedIncome,
    "INCOME",
    incomeCategoryProfiles[periodIndex % incomeCategoryProfiles.length]
  );

  function changePeriod(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= periods.length) {
      return;
    }

    if (mode === "MONTH") {
      setMonthIndex(nextIndex);
    } else {
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

        <nav className="stats-period-navigation" aria-label="Select period">
          <button
            type="button"
            onClick={() => changePeriod(periodIndex - 1)}
            disabled={periodIndex === 0}
            aria-label="Previous period"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <strong aria-live="polite">{period.label}</strong>
          <button
            type="button"
            onClick={() => changePeriod(periodIndex + 1)}
            disabled={periodIndex === periods.length - 1}
            aria-label="Next period"
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </nav>

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
      </div>
    </section>
  );
}
