import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ReceiptText,
  Scale
} from "lucide-react";

import {
  SlidingSegmentedControl,
  type SlidingSegmentOption
} from "../../components/ui/SlidingSegmentedControl";
import { formatEuroAmount } from "../../money/format-euro";

type StatsPeriodMode = "MONTH" | "YEAR";

type StatsPeriod = {
  label: string;
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
    label: "January 2026",
    income: 3250,
    expenses: 2450.8,
    incomeTransactions: 3,
    expenseTransactions: 34
  },
  {
    label: "February 2026",
    income: 0,
    expenses: 482.65,
    incomeTransactions: 0,
    expenseTransactions: 8
  },
  {
    label: "March 2026",
    income: 4250,
    expenses: 1987.45,
    incomeTransactions: 5,
    expenseTransactions: 26
  },
  {
    label: "April 2026",
    income: 2350,
    expenses: 2784.2,
    incomeTransactions: 3,
    expenseTransactions: 31
  },
  {
    label: "May 2026",
    income: 5175.4,
    expenses: 2240.75,
    incomeTransactions: 7,
    expenseTransactions: 29
  },
  {
    label: "June 2026",
    income: 2890,
    expenses: 2455.85,
    incomeTransactions: 4,
    expenseTransactions: 35
  },
  {
    label: "July 2026",
    income: 3325.75,
    expenses: 1918.3,
    incomeTransactions: 5,
    expenseTransactions: 27
  }
];

const yearlyStats: readonly StatsPeriod[] = [
  {
    label: "2024",
    income: 28450.5,
    expenses: 21680.25,
    incomeTransactions: 45,
    expenseTransactions: 267
  },
  {
    label: "2025",
    income: 36780.2,
    expenses: 29125.85,
    incomeTransactions: 63,
    expenseTransactions: 346
  },
  {
    label: "2026",
    income: 21241.15,
    expenses: 14320,
    incomeTransactions: 27,
    expenseTransactions: 190
  }
];

function getBalanceTone(balance: number) {
  if (balance > 0) return "stats-value--positive";
  if (balance < 0) return "stats-value--negative";
  return undefined;
}

export function StatsPage() {
  const [mode, setMode] = useState<StatsPeriodMode>("MONTH");
  const [monthIndex, setMonthIndex] = useState(monthlyStats.length - 1);
  const [yearIndex, setYearIndex] = useState(yearlyStats.length - 1);

  const periods = mode === "MONTH" ? monthlyStats : yearlyStats;
  const periodIndex = mode === "MONTH" ? monthIndex : yearIndex;
  const period = periods[periodIndex];
  const roundedIncome = Math.round(period.income);
  const roundedExpenses = Math.round(period.expenses);
  const balance = roundedIncome - roundedExpenses;
  const transactionCount =
    period.incomeTransactions + period.expenseTransactions;

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
              <strong className={getBalanceTone(balance)}>
                {formatEuroAmount(balance, {
                  showSign: true,
                  fractionDigits: 0
                })}
              </strong>
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
          className="stats-transactions"
          aria-labelledby="stats-transactions-title"
        >
          <h2 id="stats-transactions-title">Transactions</h2>

          <div className="stats-transaction-counts">
            <div>
              <ReceiptText aria-hidden="true" />
              <span>
                <small>Total</small>
                <strong>{transactionCount}</strong>
              </span>
            </div>
            <div className="stats-transaction-counts__expense">
              <ArrowDownRight aria-hidden="true" />
              <span>
                <small>Expenses</small>
                <strong>{period.expenseTransactions}</strong>
              </span>
            </div>
            <div className="stats-transaction-counts__income">
              <ArrowUpRight aria-hidden="true" />
              <span>
                <small>Income</small>
                <strong>{period.incomeTransactions}</strong>
              </span>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
