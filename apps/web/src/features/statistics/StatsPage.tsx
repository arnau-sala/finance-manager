import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Calendar,
  CalendarDays,
  Calendars,
  ChartPie,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  List,
  PiggyBank,
  RefreshCw,
  Scale,
  Trophy,
  type LucideIcon
} from "lucide-react";

import { MonthPicker } from "../../components/ui/MonthPicker";
import {
  SlidingSegmentedControl,
  type SlidingSegmentOption
} from "../../components/ui/SlidingSegmentedControl";
import { YearPicker } from "../../components/ui/YearPicker";
import { formatEuroAmount } from "../../money/format-euro";
import {
  getCategoryIcon,
  type TransactionType
} from "../transactions/category-catalog";
import {
  getStatisticsAvailability,
  getStatisticsCharts,
  getStatisticsOverview,
  StatisticsApiError,
  type StatisticsAvailability,
  type StatisticsCharts,
  type StatisticsOverview,
  type StatisticsPeriodMode,
  type StatisticsPeriodRequest
} from "./statistics-api";
import type { CategoryBreakdownItem } from "./statistics-categories";

const StatsChartsView = lazy(() => import("./charts/StatsChartsView"));

type StatsPageProps = {
  userId: string;
  onSessionExpired: () => void;
};

type StatsViewMode = "OVERVIEW" | "CHARTS";
type CategoryValueMode = "AMOUNT" | "PERCENTAGE";
type LoadingState = "loading" | "ready" | "error";
type InsightTone = "positive" | "negative" | "neutral";

type ExpenseSectionItem = {
  id: string;
  label: string;
  detail?: string;
  value: string;
  icon: LucideIcon;
  earnedTrophy?: boolean;
};

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

const periodOptions: readonly SlidingSegmentOption<StatisticsPeriodMode>[] = [
  { value: "MONTH", label: "Month", icon: CalendarDays },
  { value: "YEAR", label: "Year", icon: Calendar },
  { value: "ALL", label: "All", icon: Calendars }
];

const statsViewOptions: readonly SlidingSegmentOption<StatsViewMode>[] = [
  { value: "OVERVIEW", label: "Show overview", icon: List },
  { value: "CHARTS", label: "Show charts", icon: ChartPie }
];

const categoryTypeOptions: readonly SlidingSegmentOption<TransactionType>[] = [
  { value: "INCOME", label: "Income", icon: ArrowUpRight },
  { value: "EXPENSE", label: "Expenses", icon: ArrowDownRight }
];

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

function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function toUtcDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatMonthKey(month: string) {
  const [year, monthNumber] = month.split("-");
  const monthName = monthNames[Number(monthNumber) - 1];

  return `${monthName?.slice(0, 3) ?? month} ${year}`;
}

function getMonthParts(month: string) {
  const [year = "", monthNumber = "1"] = month.split("-");
  return {
    month: monthNames[Number(monthNumber) - 1] ?? monthNames[0],
    year
  };
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

function formatInsightAmount(value: number, showSign = false) {
  return formatEuroAmount(value, { fractionDigits: 0, showSign });
}

function formatMovementDate(date: string) {
  return fullDateFormatter.format(toUtcDate(date));
}

function formatNoSpendStart(
  streak: StatisticsOverview["expenses"]["currentStreak"]
) {
  if (!streak.startDate || !streak.endDate || streak.days === 0) {
    return "No active streak";
  }

  const isCurrent = streak.endDate === getLocalDateKey();

  if (isCurrent && streak.days === 1) {
    return "Since today";
  }

  if (isCurrent && streak.days === 2) {
    return "Since yesterday";
  }

  const start = toUtcDate(streak.startDate);

  if (isCurrent && streak.days <= 6) {
    return `Since ${weekdayFormatter.format(start)}`;
  }

  const formatter =
    start.getUTCFullYear() === new Date().getFullYear()
      ? shortDateFormatter
      : fullDateFormatter;

  return `Since ${formatter.format(start)}`;
}

function formatStreakPeriod(
  streak: StatisticsOverview["expenses"]["longestStreak"],
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
    const range =
      startDay === endDay
        ? `${startDay} ${startMonth}`
        : `${startDay}-${endDay} ${startMonth}`;
    return includeYear ? `${range} ${startYear}` : range;
  }

  if (startYear === endYear) {
    const range = `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
    return includeYear ? `${range} ${startYear}` : range;
  }

  return `${startDay} ${startMonth} ${startYear} - ${endDay} ${endMonth} ${endYear}`;
}

function formatDayCount(days: number) {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function createExtremeInsight(
  id: string,
  label: string,
  extreme: StatisticsOverview["insights"]["bestMonth"],
  icon: LucideIcon,
  tone: Exclude<InsightTone, "neutral">,
  period: "MONTH" | "YEAR"
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

  return {
    id,
    label,
    value: `${formatInsightAmount(extreme.balance, true)} (${
      extreme.savingsPercentage
    }%)`,
    sideValue:
      period === "MONTH"
        ? `${formatMonthKey(extreme.key).slice(0, 3)} ${extreme.key.slice(
            2,
            4
          )}`
        : extreme.key,
    icon,
    tone
  };
}

function createCollectionInsights(
  idPrefix: string,
  periodLabel: "months" | "years",
  averageLabel: string,
  summary: NonNullable<StatisticsOverview["insights"]["months"]>,
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

function createInsightRows(overview: StatisticsOverview) {
  const { insights, period } = overview;
  const rows: StatsInsight[][] = [
    [
      {
        id: "top-income",
        label: "Largest income",
        value: insights.largestIncome
          ? formatMovementDate(insights.largestIncome.date)
          : "No data",
        sideValue: insights.largestIncome
          ? formatInsightAmount(insights.largestIncome.amount)
          : "--",
        icon: ArrowUpRight,
        tone: insights.largestIncome ? "positive" : "neutral"
      },
      {
        id: "top-expense",
        label: "Largest expense",
        value: insights.largestExpense
          ? formatMovementDate(insights.largestExpense.date)
          : "No data",
        sideValue: insights.largestExpense
          ? formatInsightAmount(insights.largestExpense.amount)
          : "--",
        icon: ArrowDownRight,
        tone: insights.largestExpense ? "negative" : "neutral"
      }
    ]
  ];

  if (period.mode !== "MONTH") {
    rows.push([
      createExtremeInsight(
        "best-month",
        "Best month",
        insights.bestMonth,
        CalendarDays,
        "positive",
        "MONTH"
      ),
      createExtremeInsight(
        "worst-month",
        "Worst month",
        insights.worstMonth,
        CalendarDays,
        "negative",
        "MONTH"
      )
    ]);

    if (period.mode === "ALL") {
      rows.push([
        createExtremeInsight(
          "best-year",
          "Best year",
          insights.bestYear,
          Calendar,
          "positive",
          "YEAR"
        ),
        createExtremeInsight(
          "worst-year",
          "Worst year",
          insights.worstYear,
          Calendar,
          "negative",
          "YEAR"
        )
      ]);
    }

    if (insights.months) {
      rows.push([
        ...createCollectionInsights(
          "monthly",
          "months",
          "Avg. month balance",
          insights.months,
          CalendarDays
        )
      ]);
    }

    if (period.mode === "ALL" && insights.years) {
      rows.push([
        ...createCollectionInsights(
          "yearly",
          "years",
          "Avg. year balance",
          insights.years,
          Calendars
        )
      ]);
    }
  }

  return rows;
}

function createExpenseItems(
  overview: StatisticsOverview
): readonly ExpenseSectionItem[] {
  const { expenses, period } = overview;
  const unit = expenses.averagePeriodUnit.toLowerCase();
  const averageLabel =
    expenses.averagePeriodUnit === "DAY"
      ? "Daily Avg. expense"
      : expenses.averagePeriodUnit === "MONTH"
        ? "Monthly Avg. expense"
        : "Yearly Avg. expense";
  const averageIcon =
    expenses.averagePeriodUnit === "DAY"
      ? CalendarDays
      : expenses.averagePeriodUnit === "MONTH"
        ? Calendar
        : Calendars;

  return [
    {
      id: "typical-expense",
      label: "Typical expense",
      detail: `${expenses.transactionCount} ${
        expenses.transactionCount === 1 ? "expense" : "expenses"
      }`,
      value: formatEuroAmount(expenses.typicalAmount, {
        fractionDigits: 0
      }),
      icon: ChartColumn
    },
    {
      id: "average-expense",
      label: averageLabel,
      detail: `${expenses.averagePeriodCount} ${unit}${
        expenses.averagePeriodCount === 1 ? "" : "s"
      }`,
      value: formatEuroAmount(expenses.averageAmount, {
        fractionDigits: 0
      }),
      icon: averageIcon
    },
    {
      id: "no-spend-days",
      label: "No-spend streak",
      detail: formatNoSpendStart(expenses.currentStreak),
      value: formatDayCount(expenses.currentStreak.days),
      icon: PiggyBank,
      earnedTrophy: expenses.isLongestCurrent
    },
    {
      id: "longest-no-spend-streak",
      label: "Longest streak",
      detail: formatStreakPeriod(
        expenses.longestStreak,
        period.mode === "ALL"
      ),
      value: formatDayCount(expenses.longestStreak.days),
      icon: Award
    }
  ];
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
                      ? formatEuroAmount(category.amount, {
                          fractionDigits: 0
                        })
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

function StatisticsLoadState({
  message,
  retry
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="stats-load-state" role={retry ? "alert" : "status"}>
      <span>{message}</span>
      {retry ? (
        <button type="button" onClick={retry}>
          <RefreshCw aria-hidden="true" />
          Try again
        </button>
      ) : null}
    </div>
  );
}

function StatsOverviewContent({
  overview,
  categoryType,
  onCategoryTypeChange,
  categoryValueMode,
  onToggleCategoryValueMode
}: {
  overview: StatisticsOverview;
  categoryType: TransactionType;
  onCategoryTypeChange: (type: TransactionType) => void;
  categoryValueMode: CategoryValueMode;
  onToggleCategoryValueMode: () => void;
}) {
  const { money } = overview;
  const categories = overview.categories.filter(
    (category) => category.type === categoryType
  );
  const insightRows = createInsightRows(overview);
  const expenseItems = createExpenseItems(overview);

  return (
    <div className="stats-sections">
      <section className="stats-money" aria-labelledby="stats-money-title">
        <h2 id="stats-money-title">Money</h2>

        <div className="stats-money__content">
          <div className="stats-money__balance">
            <span>
              <Scale aria-hidden="true" />
              Net balance
            </span>
            <strong className={getValueTone(money.balance)}>
              {formatEuroAmount(money.balance, {
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
                  money.savingsPercentage === null
                    ? undefined
                    : getValueTone(money.savingsPercentage)
                }
              >
                {money.savingsPercentage === null
                  ? "--"
                  : `${money.savingsPercentage}%`}
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
                {formatEuroAmount(money.income, { fractionDigits: 0 })}
              </strong>
            </div>
            <div>
              <span>
                <ArrowDownRight aria-hidden="true" />
                Expenses
              </span>
              <strong className="stats-value--negative">
                {formatEuroAmount(money.expenses, { fractionDigits: 0 })}
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
          onChange={onCategoryTypeChange}
          label="Category type"
          tone={categoryType === "INCOME" ? "income" : "expense"}
          compact
        />

        <StatsCategoryList
          type={categoryType}
          categories={categories}
          valueMode={categoryValueMode}
          onToggleValueMode={onToggleCategoryValueMode}
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
  );
}

export function StatsPage({ userId, onSessionExpired }: StatsPageProps) {
  const currentMonthKey = getLocalDateKey().slice(0, 7);
  const currentYear = Number(currentMonthKey.slice(0, 4));
  const monthPickerAnchorRef = useRef<HTMLButtonElement>(null);
  const yearPickerAnchorRef = useRef<HTMLButtonElement>(null);
  const [viewMode, setViewMode] = useState<StatsViewMode>("OVERVIEW");
  const [hasOpenedCharts, setHasOpenedCharts] = useState(false);
  const [mode, setMode] = useState<StatisticsPeriodMode>("MONTH");
  const [selectedMonthKey, setSelectedMonthKey] = useState(currentMonthKey);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [categoryValueMode, setCategoryValueMode] =
    useState<CategoryValueMode>("AMOUNT");
  const [categoryType, setCategoryType] =
    useState<TransactionType>("INCOME");
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const [availability, setAvailability] =
    useState<StatisticsAvailability | null>(null);
  const [overview, setOverview] = useState<StatisticsOverview | null>(null);
  const [charts, setCharts] = useState<StatisticsCharts | null>(null);
  const [overviewState, setOverviewState] =
    useState<LoadingState>("loading");
  const [chartsState, setChartsState] =
    useState<LoadingState>("loading");
  const [overviewRetryKey, setOverviewRetryKey] = useState(0);
  const [chartsRetryKey, setChartsRetryKey] = useState(0);

  const periodRequest = useMemo<StatisticsPeriodRequest>(
    () =>
      mode === "MONTH"
        ? { mode, month: selectedMonthKey }
        : mode === "YEAR"
          ? { mode, year: selectedYear }
          : { mode },
    [mode, selectedMonthKey, selectedYear]
  );
  const availableMonths = availability?.availableMonths ?? [];
  const monthNavigationKeys = useMemo(
    () => [...new Set([...availableMonths, currentMonthKey])].sort(),
    [availableMonths, currentMonthKey]
  );
  const availableYears = useMemo(
    () => [
      ...new Set(
        availableMonths.map((month) => Number(month.slice(0, 4)))
      )
    ],
    [availableMonths]
  );
  const yearNavigationValues = useMemo(
    () => [...new Set([...availableYears, currentYear])].sort(),
    [availableYears, currentYear]
  );
  const monthIndex = monthNavigationKeys.indexOf(selectedMonthKey);
  const yearIndex = yearNavigationValues.indexOf(selectedYear);
  const periodIndex = mode === "MONTH" ? monthIndex : yearIndex;
  const periodCount =
    mode === "MONTH"
      ? monthNavigationKeys.length
      : yearNavigationValues.length;
  const selectedMonth = getMonthParts(selectedMonthKey);
  const firstAvailableMonth =
    availability?.minimumMonth ?? currentMonthKey;
  const allPeriodLabel = `${formatMonthKey(
    firstAvailableMonth
  )} - ${formatMonthKey(currentMonthKey)}`;

  useEffect(() => {
    const controller = new AbortController();

    getStatisticsAvailability(userId, controller.signal)
      .then(setAvailability)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (error instanceof StatisticsApiError && error.status === 401) {
          onSessionExpired();
        }
      });

    return () => controller.abort();
  }, [onSessionExpired, userId]);

  useEffect(() => {
    if (viewMode !== "OVERVIEW") {
      return;
    }

    const controller = new AbortController();
    setOverview(null);
    setOverviewState("loading");

    getStatisticsOverview(userId, periodRequest, controller.signal)
      .then((nextOverview) => {
        setOverview(nextOverview);
        setOverviewState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setOverviewState("error");

        if (error instanceof StatisticsApiError && error.status === 401) {
          onSessionExpired();
        }
      });

    return () => controller.abort();
  }, [
    onSessionExpired,
    overviewRetryKey,
    periodRequest,
    userId,
    viewMode
  ]);

  useEffect(() => {
    if (viewMode !== "CHARTS") {
      return;
    }

    const controller = new AbortController();
    setCharts(null);
    setChartsState("loading");

    getStatisticsCharts(userId, periodRequest, controller.signal)
      .then((nextCharts) => {
        setCharts(nextCharts);
        setChartsState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setChartsState("error");

        if (error instanceof StatisticsApiError && error.status === 401) {
          onSessionExpired();
        }
      });

    return () => controller.abort();
  }, [
    chartsRetryKey,
    onSessionExpired,
    periodRequest,
    userId,
    viewMode
  ]);

  function changePeriod(nextIndex: number) {
    if (mode === "ALL") {
      return;
    }

    if (mode === "MONTH") {
      const nextMonth = monthNavigationKeys[nextIndex];

      if (nextMonth) {
        setSelectedMonthKey(nextMonth);
      }
      return;
    }

    const nextYear = yearNavigationValues[nextIndex];

    if (nextYear !== undefined) {
      setSelectedYear(nextYear);
    }
  }

  function toggleCategoryValueMode() {
    setCategoryValueMode((currentMode) =>
      currentMode === "AMOUNT" ? "PERCENTAGE" : "AMOUNT"
    );
  }

  function changeViewMode(nextView: StatsViewMode) {
    if (nextView === "CHARTS") {
      setHasOpenedCharts(true);
    }

    setViewMode(nextView);
  }

  return (
    <section
      className="home-content home-content--stats"
      aria-labelledby="stats-page-title"
    >
      <div className="stats-page">
        <header className="stats-page__header">
          <h1 id="stats-page-title">Stats</h1>

          <SlidingSegmentedControl
            className="stats-view-toggle"
            value={viewMode}
            options={statsViewOptions}
            onChange={changeViewMode}
            label="Statistics view"
            compact
            iconOnly
            allowDrag={false}
          />
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
                disabled={periodIndex <= 0}
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
                  {availableYears.length > 1 ? (
                    <button
                      ref={yearPickerAnchorRef}
                      className="stats-period-navigation__picker"
                      type="button"
                      aria-haspopup="dialog"
                      aria-expanded={isYearPickerOpen}
                      onClick={() => setIsYearPickerOpen(true)}
                    >
                      {selectedYear}
                    </button>
                  ) : (
                    <strong>{selectedYear}</strong>
                  )}
                </span>
              )}
              <button
                type="button"
                onClick={() => changePeriod(periodIndex + 1)}
                disabled={periodIndex < 0 || periodIndex === periodCount - 1}
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
          availableMonths={availableMonths}
          minimumMonth={availability?.minimumMonth ?? currentMonthKey}
          maximumMonth={availability?.maximumMonth ?? currentMonthKey}
          onSelect={setSelectedMonthKey}
          onClose={() => setIsMonthPickerOpen(false)}
        />

        <YearPicker
          open={isYearPickerOpen}
          anchorRef={yearPickerAnchorRef}
          value={selectedYear}
          availableYears={availableYears}
          minimumYear={availableYears[0] ?? currentYear}
          maximumYear={currentYear}
          onSelect={setSelectedYear}
          onClose={() => setIsYearPickerOpen(false)}
        />

        <div
          className={`stats-view-stage stats-view-stage--${viewMode.toLowerCase()}`}
        >
          <div
            className="stats-view-panel stats-view-panel--overview"
            aria-hidden={viewMode !== "OVERVIEW"}
            inert={viewMode !== "OVERVIEW"}
          >
            {overviewState === "ready" && overview ? (
              <StatsOverviewContent
                overview={overview}
                categoryType={categoryType}
                onCategoryTypeChange={setCategoryType}
                categoryValueMode={categoryValueMode}
                onToggleCategoryValueMode={toggleCategoryValueMode}
              />
            ) : overviewState === "error" ? (
              <StatisticsLoadState
                message="Your statistics could not be loaded."
                retry={() =>
                  setOverviewRetryKey((current) => current + 1)
                }
              />
            ) : (
              <StatisticsLoadState message="Loading statistics..." />
            )}
          </div>

          <section
            className="stats-view-panel stats-view-panel--charts"
            aria-label="Charts"
            aria-hidden={viewMode !== "CHARTS"}
            inert={viewMode !== "CHARTS"}
          >
            {hasOpenedCharts ? (
              <Suspense
                fallback={
                  <StatisticsLoadState message="Loading charts..." />
                }
              >
                {chartsState === "ready" && charts ? (
                  <StatsChartsView charts={charts} />
                ) : chartsState === "error" ? (
                  <StatisticsLoadState
                    message="Your charts could not be loaded."
                    retry={() =>
                      setChartsRetryKey((current) => current + 1)
                    }
                  />
                ) : (
                  <StatisticsLoadState message="Loading charts..." />
                )}
              </Suspense>
            ) : null}
          </section>
        </div>
      </div>
    </section>
  );
}
