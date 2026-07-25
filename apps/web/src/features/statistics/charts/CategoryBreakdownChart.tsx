import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties
} from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { EChartsCoreOption } from "../../../components/charts/chart-engine";
import { EChart } from "../../../components/charts/EChart";
import {
  SlidingSegmentedControl,
  type SlidingSegmentOption
} from "../../../components/ui/SlidingSegmentedControl";
import { formatEuroAmount } from "../../../money/format-euro";
import {
  getCategoryIcon,
  type TransactionType
} from "../../transactions/category-catalog";
import {
  getMockCategoryBreakdown,
  type CategoryBreakdownItem,
  type StatisticsCategoryPeriodMode
} from "../statistics-category-mock";
import {
  formatFinancialIntervalRange,
  getFinancialIntervals
} from "./statistics-chart-periods";
import {
  getStatisticsChartTheme,
  type StatisticsChartTheme
} from "./statistics-chart-theme";

type CategoryBreakdownChartProps = {
  mode: StatisticsCategoryPeriodMode;
  selectedMonth: string;
  selectedYear: number;
};

const categoryTypeOptions: readonly SlidingSegmentOption<TransactionType>[] = [
  { value: "INCOME", label: "Income", icon: ArrowUpRight },
  { value: "EXPENSE", label: "Expenses", icon: ArrowDownRight }
];

const compactNumberFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1
});
const periodDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC"
});

function formatCompactEuro(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${compactNumberFormatter.format(value / 1000)}k€`;
  }

  return `${Math.round(value)}€`;
}

function toUtcDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function getMonthEndDate(monthKey: string) {
  const [year = 0, month = 1] = monthKey.split("-").map(Number);
  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}`;

  if (monthKey === currentMonthKey) {
    return `${monthKey}-${String(today.getDate()).padStart(2, "0")}`;
  }

  const finalDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${monthKey}-${String(finalDay).padStart(2, "0")}`;
}

function formatDisplayedPeriod(
  mode: StatisticsCategoryPeriodMode,
  selectedMonth: string,
  selectedYear: number
) {
  if (mode === "MONTH") {
    return `${periodDateFormatter.format(
      toUtcDate(`${selectedMonth}-01`)
    )} - ${periodDateFormatter.format(
      toUtcDate(getMonthEndDate(selectedMonth))
    )}`;
  }

  return formatFinancialIntervalRange(
    getFinancialIntervals(mode, selectedYear)
  );
}

function getVisibleCategories(categories: readonly CategoryBreakdownItem[]) {
  const total = categories.reduce(
    (sum, category) => sum + category.amount,
    0
  );

  if (total <= 0) {
    return [];
  }

  return categories.filter(
    (category) => (category.amount * 100) / total >= 1
  );
}

function createChartOption(
  categories: readonly CategoryBreakdownItem[],
  type: TransactionType,
  selectedCategoryIndex: number | null,
  theme: StatisticsChartTheme
): EChartsCoreOption {
  const isIncome = type === "INCOME";
  const color = isIncome ? theme.primary : theme.danger;
  const softColor = isIncome ? theme.primarySoft : theme.dangerSoft;

  return {
    animationDuration: 650,
    animationDurationUpdate: 420,
    animationDelay: (index: number) => index * 35,
    animationEasing: "cubicOut",
    animationEasingUpdate: "cubicOut",
    aria: {
      enabled: true,
      description: `Horizontal bar chart showing ${type.toLowerCase()} totals by category.`
    },
    grid: {
      top: 10,
      right: 8,
      bottom: 28,
      left: 32,
      containLabel: false
    },
    tooltip: {
      trigger: "item",
      triggerOn: "none",
      confine: true,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      padding: [8, 10],
      textStyle: {
        color: theme.text,
        fontFamily: theme.fontFamily,
        fontSize: 12,
        fontWeight: 400
      },
      formatter: (rawParams: unknown) => {
        const dataIndex =
          typeof rawParams === "object" &&
          rawParams !== null &&
          "dataIndex" in rawParams
            ? Number(rawParams.dataIndex)
            : -1;
        const category = categories[dataIndex];

        if (!category) {
          return "";
        }

        return [
          category.name,
          `<strong>${formatEuroAmount(category.amount, {
            fractionDigits: 2
          })}</strong>`,
          `${category.percentage}% of ${isIncome ? "income" : "expenses"}`
        ].join("<br/>");
      }
    },
    xAxis: {
      type: "value",
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        color: theme.textMuted,
        fontFamily: theme.fontFamily,
        fontSize: 10,
        margin: 8,
        formatter: (value: number) => formatCompactEuro(value)
      },
      splitLine: {
        lineStyle: {
          color: theme.border,
          opacity: 0.55,
          width: 1
        }
      }
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: categories.map(({ id }) => id),
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        show: false
      }
    },
    series: [
      {
        id: "category-breakdown-series",
        type: "bar",
        data: categories.map(({ amount }, index) => ({
          value: amount,
          itemStyle: {
            color: softColor,
            borderColor: color,
            borderWidth: 1.5,
            borderRadius: [0, 4, 4, 0],
            opacity:
              selectedCategoryIndex === null ||
              selectedCategoryIndex === index
                ? 1
                : 0.2
          }
        })),
        barWidth: 18,
        emphasis: {
          disabled: true
        }
      }
    ]
  };
}

export default function CategoryBreakdownChart({
  mode,
  selectedMonth,
  selectedYear
}: CategoryBreakdownChartProps) {
  const [type, setType] = useState<TransactionType>("INCOME");
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<
    number | null
  >(null);
  const categories = useMemo(
    () =>
      getVisibleCategories(
        getMockCategoryBreakdown({
          mode,
          selectedMonth,
          selectedYear,
          type
        })
      ),
    [mode, selectedMonth, selectedYear, type]
  );
  const displayedPeriod = useMemo(
    () => formatDisplayedPeriod(mode, selectedMonth, selectedYear),
    [mode, selectedMonth, selectedYear]
  );
  const chartHeight = Math.max(240, categories.length * 38 + 58);

  useEffect(() => {
    setSelectedCategoryIndex(null);
  }, [mode, selectedMonth, selectedYear, type]);

  const option = useMemo(
    () =>
      createChartOption(
        categories,
        type,
        selectedCategoryIndex,
        getStatisticsChartTheme()
      ),
    [categories, selectedCategoryIndex, type]
  );

  return (
    <section
      className="stats-chart-section stats-category-breakdown"
      aria-labelledby="category-breakdown-chart-title"
      style={
        {
          "--category-breakdown-chart-height": `${chartHeight}px`
        } as CSSProperties
      }
    >
      <header className="stats-chart-section__header">
        <h2 id="category-breakdown-chart-title">Category Breakdown</h2>
        <span className="stats-chart-section__period">{displayedPeriod}</span>
      </header>

      <SlidingSegmentedControl
        className="stats-category-breakdown__type"
        value={type}
        options={categoryTypeOptions}
        onChange={setType}
        label="Category type"
        tone={type === "INCOME" ? "income" : "expense"}
        compact
      />

      <div
        className={`stats-category-breakdown__visual stats-category-breakdown__visual--${type.toLowerCase()}`}
      >
        <div
          className="stats-category-breakdown__axis-icons"
          style={{
            gridTemplateRows: `repeat(${categories.length}, minmax(0, 1fr))`
          }}
          aria-hidden="true"
        >
          {categories.map((category) => {
            const Icon = getCategoryIcon(category.id, type);

            return (
              <span key={category.id}>
                <Icon />
              </span>
            );
          })}
        </div>

        <EChart
          className="stats-category-breakdown__chart"
          option={option}
          ariaLabel={`${type === "INCOME" ? "Income" : "Expense"} category breakdown from ${displayedPeriod}.`}
          toggleItemSelectionOnClick
          highlightSelectedItemOnClick={false}
          onItemSelectionChange={setSelectedCategoryIndex}
          mergeOptionUpdates
          hideTooltip={selectedCategoryIndex === null}
        />
      </div>
    </section>
  );
}
