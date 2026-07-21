import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Percent,
  ReceiptText,
  WalletCards
} from "lucide-react";

import {
  SlidingSegmentedControl,
  type SlidingSegmentOption
} from "../../components/ui/SlidingSegmentedControl";
import { formatEuroAmount } from "../../money/format-euro";

type StatsPeriodMode = "MONTH" | "YEAR";

type StatsPeriod = {
  id: string;
  label: string;
  comparisonLabel: string | null;
  income: number;
  expenses: number;
  incomeTransactions: number;
  expenseTransactions: number;
};

const periodOptions: readonly SlidingSegmentOption<StatsPeriodMode>[] = [
  { value: "MONTH", label: "Month", icon: CalendarDays },
  { value: "YEAR", label: "Year", icon: CalendarRange }
];

const monthlyStats: readonly StatsPeriod[] = [
  {
    id: "2026-01",
    label: "January 2026",
    comparisonLabel: null,
    income: 3250,
    expenses: 2450.8,
    incomeTransactions: 3,
    expenseTransactions: 34
  },
  {
    id: "2026-02",
    label: "February 2026",
    comparisonLabel: "January",
    income: 0,
    expenses: 482.65,
    incomeTransactions: 0,
    expenseTransactions: 8
  },
  {
    id: "2026-03",
    label: "March 2026",
    comparisonLabel: "February",
    income: 4250,
    expenses: 1987.45,
    incomeTransactions: 5,
    expenseTransactions: 26
  },
  {
    id: "2026-04",
    label: "April 2026",
    comparisonLabel: "March",
    income: 2350,
    expenses: 2784.2,
    incomeTransactions: 3,
    expenseTransactions: 31
  },
  {
    id: "2026-05",
    label: "May 2026",
    comparisonLabel: "April",
    income: 5175.4,
    expenses: 2240.75,
    incomeTransactions: 7,
    expenseTransactions: 29
  },
  {
    id: "2026-06",
    label: "June 2026",
    comparisonLabel: "May",
    income: 2890,
    expenses: 2455.85,
    incomeTransactions: 4,
    expenseTransactions: 35
  },
  {
    id: "2026-07",
    label: "July 2026",
    comparisonLabel: "June",
    income: 3325.75,
    expenses: 1918.3,
    incomeTransactions: 5,
    expenseTransactions: 27
  }
];

const yearlyStats: readonly StatsPeriod[] = [
  {
    id: "2024",
    label: "2024",
    comparisonLabel: null,
    income: 28450.5,
    expenses: 21680.25,
    incomeTransactions: 45,
    expenseTransactions: 267
  },
  {
    id: "2025",
    label: "2025",
    comparisonLabel: "2024",
    income: 36780.2,
    expenses: 29125.85,
    incomeTransactions: 63,
    expenseTransactions: 346
  },
  {
    id: "2026",
    label: "2026",
    comparisonLabel: "2025",
    income: 21241.15,
    expenses: 14320,
    incomeTransactions: 27,
    expenseTransactions: 190
  }
];

function getAverage(total: number, count: number) {
  return count > 0 ? total / count : null;
}

function getSavingsRate(income: number, expenses: number) {
  return income > 0 ? ((income - expenses) / income) * 100 : null;
}

function formatPercentage(value: number) {
  return `${Math.abs(Math.round(value))}%`;
}

export function StatsPage() {
  const [mode, setMode] = useState<StatsPeriodMode>("MONTH");
  const [monthIndex, setMonthIndex] = useState(monthlyStats.length - 1);
  const [yearIndex, setYearIndex] = useState(yearlyStats.length - 1);

  const periods = mode === "MONTH" ? monthlyStats : yearlyStats;
  const periodIndex = mode === "MONTH" ? monthIndex : yearIndex;
  const period = periods[periodIndex];
  const previousPeriod = periodIndex > 0 ? periods[periodIndex - 1] : null;
  const balance = period.income - period.expenses;
  const transactionCount =
    period.incomeTransactions + period.expenseTransactions;
  const averageIncome = getAverage(
    period.income,
    period.incomeTransactions
  );
  const averageExpense = getAverage(
    period.expenses,
    period.expenseTransactions
  );
  const savingsRate = getSavingsRate(period.income, period.expenses);
  const expenseDifference = previousPeriod
    ? period.expenses - previousPeriod.expenses
    : null;
  const expenseDifferencePercentage =
    expenseDifference !== null &&
    previousPeriod &&
    previousPeriod.expenses > 0
      ? (expenseDifference / previousPeriod.expenses) * 100
      : null;

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

  return (
    <section
      className="home-content home-content--stats"
      aria-labelledby="stats-page-title"
    >
      <div className="stats-page">
        <header className="stats-page__header">
          <div>
            <h1 id="stats-page-title">Stats</h1>
            <p>A clear view of your numbers</p>
          </div>
          <span>{mode === "MONTH" ? "Monthly" : "Yearly"}</span>
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

        <section className="stats-summary" aria-labelledby="stats-summary-title">
          <div className="stats-summary__heading">
            <span className="stats-summary__icon" aria-hidden="true">
              <WalletCards />
            </span>
            <div>
              <h2 id="stats-summary-title">Net balance</h2>
              <p>Income minus expenses</p>
            </div>
          </div>

          <p
            className={`stats-summary__balance stats-value--${
              balance >= 0 ? "positive" : "negative"
            }`}
          >
            {formatEuroAmount(balance, { showSign: true })}
          </p>

          <div className="stats-summary__metrics">
            <div>
              <span>Income</span>
              <strong className="stats-value--positive">
                {formatEuroAmount(period.income)}
              </strong>
            </div>
            <div>
              <span>Expenses</span>
              <strong className="stats-value--negative">
                {formatEuroAmount(period.expenses)}
              </strong>
            </div>
            <div>
              <span>Transactions</span>
              <strong>{transactionCount}</strong>
            </div>
          </div>
        </section>

        <section className="stats-numbers" aria-labelledby="stats-numbers-title">
          <div className="stats-section-heading">
            <h2 id="stats-numbers-title">More numbers</h2>
            <span>{period.label}</span>
          </div>

          <div className="stats-number-list">
            <article className="stats-number-row">
              <span
                className="stats-number-row__icon stats-number-row__icon--income"
                aria-hidden="true"
              >
                <ArrowUpRight />
              </span>
              <div>
                <h3>Average income</h3>
                <p>{period.incomeTransactions} income transactions</p>
              </div>
              <strong>
                {averageIncome === null
                  ? "No income"
                  : formatEuroAmount(averageIncome)}
              </strong>
            </article>

            <article className="stats-number-row">
              <span
                className="stats-number-row__icon stats-number-row__icon--expense"
                aria-hidden="true"
              >
                <ArrowDownRight />
              </span>
              <div>
                <h3>Average expense</h3>
                <p>{period.expenseTransactions} expense transactions</p>
              </div>
              <strong>
                {averageExpense === null
                  ? "No expenses"
                  : formatEuroAmount(averageExpense)}
              </strong>
            </article>

            <article className="stats-number-row">
              <span className="stats-number-row__icon" aria-hidden="true">
                <Percent />
              </span>
              <div>
                <h3>Savings rate</h3>
                <p>Share of income kept</p>
              </div>
              <strong
                className={
                  savingsRate === null
                    ? undefined
                    : `stats-value--${
                        savingsRate >= 0 ? "positive" : "negative"
                      }`
                }
              >
                {savingsRate === null
                  ? "No income"
                  : formatPercentage(savingsRate)}
              </strong>
            </article>

            <article className="stats-number-row">
              <span className="stats-number-row__icon" aria-hidden="true">
                <ReceiptText />
              </span>
              <div>
                <h3>Spending change</h3>
                <p>
                  {period.comparisonLabel
                    ? `Compared with ${period.comparisonLabel}`
                    : "First available period"}
                </p>
              </div>
              <strong
                className={
                  expenseDifference === null || expenseDifference === 0
                    ? undefined
                    : `stats-value--${
                        expenseDifference < 0 ? "positive" : "negative"
                      }`
                }
              >
                {expenseDifferencePercentage === null
                  ? "--"
                  : `${formatPercentage(expenseDifferencePercentage)} ${
                      expenseDifference !== null && expenseDifference <= 0
                        ? "less"
                        : "more"
                    }`}
              </strong>
            </article>
          </div>
        </section>
      </div>
    </section>
  );
}
