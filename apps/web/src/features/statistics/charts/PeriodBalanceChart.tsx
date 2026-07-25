import { useMemo } from "react";
import type { EChartsCoreOption } from "../../../components/charts/chart-engine";
import { EChart } from "../../../components/charts/EChart";
import { formatEuroAmount } from "../../../money/format-euro";
import { mockStatisticsMonthlyTotals } from "../statistics-mock";
import {
  getStatisticsChartTheme,
  type StatisticsChartTheme
} from "./statistics-chart-theme";

type PeriodBalanceChartProps = {
  mode: "YEAR" | "ALL";
  selectedYear: number;
};

type BalanceInterval = {
  key: string;
  axisLabel: string;
  tooltipLabel: string;
  startDate: string;
  endDate: string;
  balanceCents: number;
};

const shortMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  timeZone: "UTC"
});
const longMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC"
});
const periodDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC"
});
const compactNumberFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1
});

function toUtcDate(date: string) {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function getLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function getMonthEndDate(monthKey: string) {
  const todayKey = getLocalDateKey(new Date());

  if (monthKey === todayKey.slice(0, 7)) {
    return todayKey;
  }

  const [year = 0, month = 1] = monthKey.split("-").map(Number);
  const finalDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${monthKey}-${String(finalDay).padStart(2, "0")}`;
}

function getMonthlyBalanceCents(income: number, expenses: number) {
  return Math.round(income * 100) - Math.round(expenses * 100);
}

function createYearIntervals(selectedYear: number): BalanceInterval[] {
  return mockStatisticsMonthlyTotals
    .filter(({ month }) => month.startsWith(`${selectedYear}-`))
    .map(({ month, income, expenses }) => {
      const startDate = `${month}-01`;
      const date = toUtcDate(startDate);

      return {
        key: month,
        axisLabel: shortMonthFormatter.format(date),
        tooltipLabel: longMonthFormatter.format(date),
        startDate,
        endDate: getMonthEndDate(month),
        balanceCents: getMonthlyBalanceCents(income, expenses)
      };
    });
}

function createAllIntervals(): BalanceInterval[] {
  const intervalsByYear = new Map<number, BalanceInterval>();

  mockStatisticsMonthlyTotals.forEach(({ month, income, expenses }) => {
    const year = Number(month.slice(0, 4));
    const existingInterval = intervalsByYear.get(year);
    const balanceCents = getMonthlyBalanceCents(income, expenses);

    if (existingInterval) {
      existingInterval.endDate = getMonthEndDate(month);
      existingInterval.balanceCents += balanceCents;
      return;
    }

    intervalsByYear.set(year, {
      key: String(year),
      axisLabel: String(year),
      tooltipLabel: String(year),
      startDate: `${month}-01`,
      endDate: getMonthEndDate(month),
      balanceCents
    });
  });

  return [...intervalsByYear.values()];
}

function getIntervals(
  mode: PeriodBalanceChartProps["mode"],
  selectedYear: number
) {
  return mode === "YEAR"
    ? createYearIntervals(selectedYear)
    : createAllIntervals();
}

function formatCompactEuro(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${compactNumberFormatter.format(value / 1000)}k€`;
  }

  return `${Math.round(value)}€`;
}

function formatDisplayedPeriod(intervals: readonly BalanceInterval[]) {
  const firstInterval = intervals[0];
  const finalInterval = intervals[intervals.length - 1];

  if (!firstInterval || !finalInterval) {
    return "";
  }

  return `${periodDateFormatter.format(
    toUtcDate(firstInterval.startDate)
  )} - ${periodDateFormatter.format(toUtcDate(finalInterval.endDate))}`;
}

function getYearBarWidth(intervalCount: number) {
  const missingMonths = Math.max(0, 12 - intervalCount);
  return Math.min(30, 18 + missingMonths * 2);
}

function createChartOption(
  mode: PeriodBalanceChartProps["mode"],
  intervals: readonly BalanceInterval[],
  theme: StatisticsChartTheme
): EChartsCoreOption {
  return {
    animationDuration: 650,
    animationDurationUpdate: 420,
    animationDelay: (index: number) => index * 28,
    animationEasing: "cubicOut",
    animationEasingUpdate: "cubicOut",
    aria: {
      enabled: true,
      description:
        "Bar chart showing positive and negative balances for each interval."
    },
    grid: {
      top: 18,
      right: 8,
      bottom: 4,
      left: 4,
      containLabel: true
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
        const interval = intervals[dataIndex];

        if (!interval) {
          return "";
        }

        return `${interval.tooltipLabel}<br/><strong>${formatEuroAmount(
          interval.balanceCents / 100,
          { showSign: true, fractionDigits: 2 }
        )}</strong>`;
      }
    },
    xAxis: {
      type: "category",
      data: intervals.map(({ axisLabel }) => axisLabel),
      axisLine: {
        show: true,
        onZero: true,
        lineStyle: {
          color: theme.border,
          opacity: 1,
          width: 1,
          type: "solid"
        }
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        interval: 0,
        color: theme.textMuted,
        fontFamily: theme.fontFamily,
        fontSize: 10,
        margin: 10,
        hideOverlap: false
      }
    },
    yAxis: {
      type: "value",
      scale: false,
      splitNumber: 4,
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
    series: [
      {
        name: "Balance",
        type: "bar",
        data: intervals.map(({ balanceCents }) => {
          const value = balanceCents / 100;
          const isPositive = value >= 0;

          return {
            value,
            itemStyle: {
              color: isPositive ? theme.primarySoft : theme.dangerSoft,
              borderColor: isPositive ? theme.primary : theme.danger,
              borderWidth: 2,
              borderRadius: isPositive ? [4, 4, 0, 0] : [0, 0, 4, 4]
            }
          };
        }),
        barWidth:
          mode === "YEAR" ? getYearBarWidth(intervals.length) : undefined,
        barMaxWidth: mode === "ALL" ? 34 : undefined,
        emphasis: {
          focus: "self",
          itemStyle: {
            opacity: 1
          }
        }
      }
    ]
  };
}

export default function PeriodBalanceChart({
  mode,
  selectedYear
}: PeriodBalanceChartProps) {
  const intervals = useMemo(
    () => getIntervals(mode, selectedYear),
    [mode, selectedYear]
  );
  const displayedPeriod = useMemo(
    () => formatDisplayedPeriod(intervals),
    [intervals]
  );
  const option = useMemo(
    () => createChartOption(mode, intervals, getStatisticsChartTheme()),
    [mode, intervals]
  );
  const ariaLabel = `Period balance from ${displayedPeriod}. ${intervals.length} intervals shown.`;

  return (
    <section
      className="stats-chart-section stats-period-balance"
      aria-labelledby="period-balance-chart-title"
    >
      <header className="stats-chart-section__header">
        <h2 id="period-balance-chart-title">Period Balance</h2>
        <span className="stats-chart-section__period">{displayedPeriod}</span>
      </header>

      <EChart
        className="stats-period-balance__chart"
        option={option}
        ariaLabel={ariaLabel}
        toggleItemSelectionOnClick
      />
    </section>
  );
}
