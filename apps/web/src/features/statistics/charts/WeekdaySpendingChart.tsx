import { useEffect, useMemo, useState } from "react";
import type { EChartsCoreOption } from "../../../components/charts/chart-engine";
import { EChart } from "../../../components/charts/EChart";
import { formatEuroAmount } from "../../../money/format-euro";
import type {
  StatisticsCharts,
  StatisticsPeriodMode
} from "../statistics-api";
import {
  getStatisticsChartTheme,
  type StatisticsChartTheme
} from "./statistics-chart-theme";

type WeekdaySpendingChartProps = {
  mode: StatisticsPeriodMode;
  periodStart: string;
  periodEnd: string;
  spending: StatisticsCharts["weekdaySpending"];
};

type SpendingInterval = {
  key: string;
  axisLabel: string;
  tooltipLabel: string;
  averageAmount: number;
  totalAmount: number;
  transactionCount: number;
};

const WEEKDAY_LABELS = [
  { axis: "Mon", full: "Monday" },
  { axis: "Tue", full: "Tuesday" },
  { axis: "Wed", full: "Wednesday" },
  { axis: "Thu", full: "Thursday" },
  { axis: "Fri", full: "Friday" },
  { axis: "Sat", full: "Saturday" },
  { axis: "Sun", full: "Sunday" }
] as const;
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
  return new Date(`${date}T00:00:00.000Z`);
}

function formatCompactEuro(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${compactNumberFormatter.format(value / 1000)}k€`;
  }

  return `${Math.round(value)}€`;
}

function formatDisplayedPeriod(startDate: string, endDate: string) {
  return `${periodDateFormatter.format(
    toUtcDate(startDate)
  )} - ${periodDateFormatter.format(toUtcDate(endDate))}`;
}

function createTooltipPosition(
  intervalCount: number,
  barWidth: number
) {
  return (
    point: number[],
    rawParams: unknown,
    _element: unknown,
    _rect: unknown,
    size: {
      contentSize: number[];
      viewSize: number[];
    }
  ) => {
    const edgeGap = 8;
    const columnGap = 14;
    const plotLeft = 42;
    const chartWidth = size.viewSize[0] ?? 0;
    const chartHeight = size.viewSize[1] ?? 0;
    const tooltipWidth = size.contentSize[0] ?? 0;
    const tooltipHeight = size.contentSize[1] ?? 0;
    const dataIndex =
      typeof rawParams === "object" &&
      rawParams !== null &&
      "dataIndex" in rawParams
        ? Number(rawParams.dataIndex)
        : -1;
    const plotRight = Math.max(plotLeft, chartWidth - edgeGap);
    const intervalWidth =
      intervalCount > 0 ? (plotRight - plotLeft) / intervalCount : 0;
    const intervalCenter =
      dataIndex >= 0
        ? plotLeft + (dataIndex + 0.5) * intervalWidth
        : (point[0] ?? 0);
    const rightPosition =
      intervalCenter + barWidth / 2 + columnGap;
    const leftPosition =
      intervalCenter - barWidth / 2 - columnGap - tooltipWidth;
    const maximumLeft = chartWidth - tooltipWidth - edgeGap;
    const left =
      rightPosition <= maximumLeft
        ? rightPosition
        : leftPosition >= edgeGap
          ? leftPosition
          : Math.min(maximumLeft, Math.max(edgeGap, rightPosition));
    const minimumTop = 18;
    const maximumTop = Math.max(
      minimumTop,
      chartHeight - tooltipHeight - edgeGap
    );
    const top = Math.min(
      maximumTop,
      Math.max(minimumTop, (point[1] ?? 0) - tooltipHeight / 2)
    );

    return [Math.max(edgeGap, left), top];
  };
}

function createChartOption(
  intervals: readonly SpendingInterval[],
  selectedIntervalIndex: number | null,
  theme: StatisticsChartTheme
): EChartsCoreOption {
  const barWidth = 28;

  return {
    animationDuration: 650,
    animationDurationUpdate: 420,
    animationDelay: (index: number) => index * 34,
    animationEasing: "cubicOut",
    animationEasingUpdate: "cubicOut",
    aria: {
      enabled: true,
      description:
        "Bar chart showing average spending for each displayed weekday."
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
      position: createTooltipPosition(intervals.length, barWidth),
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

        const transactionLabel =
          interval.transactionCount === 1
            ? "1 transaction"
            : `${interval.transactionCount} transactions`;

        return [
          interval.tooltipLabel,
          `Average <strong>${formatEuroAmount(
            interval.averageAmount,
            { fractionDigits: 2 }
          )}</strong>`,
          `Total <strong>${formatEuroAmount(interval.totalAmount, {
            fractionDigits: 2
          })}</strong>`,
          transactionLabel
        ].join("<br/>");
      }
    },
    xAxis: {
      type: "category",
      data: intervals.map(({ axisLabel }) => axisLabel),
      axisLine: {
        show: true,
        lineStyle: {
          color: theme.border,
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
      min: 0,
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
        id: "weekday-spending-series",
        name: "Average spending",
        type: "bar",
        data: intervals.map(({ averageAmount }, index) => ({
          value: averageAmount,
          itemStyle: {
            color: theme.dangerSoft,
            borderColor: theme.danger,
            borderWidth: 2,
            borderRadius: [4, 4, 0, 0],
            opacity:
              selectedIntervalIndex === null ||
              selectedIntervalIndex === index
                ? 1
                : 0.2
          }
        })),
        barWidth,
        emphasis: {
          disabled: true
        }
      }
    ]
  };
}

export default function WeekdaySpendingChart({
  mode,
  periodStart,
  periodEnd,
  spending
}: WeekdaySpendingChartProps) {
  const [selectedIntervalIndex, setSelectedIntervalIndex] = useState<
    number | null
  >(null);
  const intervals = useMemo(
    () =>
      spending.values.map<SpendingInterval>((value) => {
        const label = WEEKDAY_LABELS[value.weekday - 1] ?? WEEKDAY_LABELS[0];

        return {
          key: label.axis,
          axisLabel: label.axis,
          tooltipLabel: label.full,
          averageAmount: value.averageAmount,
          totalAmount: value.totalAmount,
          transactionCount: value.transactionCount
        };
      }),
    [spending.values]
  );
  const displayedPeriod = useMemo(
    () => formatDisplayedPeriod(periodStart, periodEnd),
    [periodEnd, periodStart]
  );
  const option = useMemo(
    () =>
      createChartOption(
        intervals,
        selectedIntervalIndex,
        getStatisticsChartTheme()
      ),
    [intervals, selectedIntervalIndex]
  );

  useEffect(() => {
    setSelectedIntervalIndex(null);
  }, [mode, periodEnd, periodStart]);

  if (!spending.hasEnoughData) {
    return null;
  }

  return (
    <section
      className="stats-chart-section stats-weekday-spending"
      aria-labelledby="weekday-spending-chart-title"
    >
      <header className="stats-chart-section__header">
        <h2 id="weekday-spending-chart-title">Weekday Spending</h2>
        <span className="stats-chart-section__period">
          {displayedPeriod}
        </span>
      </header>

      <EChart
        className="stats-weekday-spending__chart"
        option={option}
        ariaLabel={`Weekday average spending from ${displayedPeriod}.`}
        toggleItemSelectionOnClick
        highlightSelectedItemOnClick={false}
        onItemSelectionChange={setSelectedIntervalIndex}
        mergeOptionUpdates
        hideTooltip={selectedIntervalIndex === null}
      />
    </section>
  );
}
