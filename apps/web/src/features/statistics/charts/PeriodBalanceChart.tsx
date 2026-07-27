import { useEffect, useMemo, useState } from "react";
import type { EChartsCoreOption } from "../../../components/charts/chart-engine";
import { EChart } from "../../../components/charts/EChart";
import { formatEuroAmount } from "../../../money/format-euro";
import {
  formatFinancialIntervalRange,
  type AggregateChartMode,
  type FinancialInterval
} from "./statistics-chart-periods";
import {
  getStatisticsChartTheme,
  type StatisticsChartTheme
} from "./statistics-chart-theme";

type PeriodBalanceChartProps = {
  mode: AggregateChartMode;
  intervals: readonly FinancialInterval[];
};

const compactNumberFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1
});

function formatCompactEuro(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${compactNumberFormatter.format(value / 1000)}k€`;
  }

  return `${Math.round(value)}€`;
}

function getYearBarWidth(intervalCount: number) {
  const missingMonths = Math.max(0, 12 - intervalCount);
  return Math.min(30, 18 + missingMonths * 2);
}

function createPeriodBalanceTooltipPosition(
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
    const chartEdgeGap = 8;
    const columnGap = 16;
    const estimatedPlotLeft = 42;
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
    const plotRight = Math.max(
      estimatedPlotLeft,
      chartWidth - chartEdgeGap
    );
    const intervalWidth =
      intervalCount > 0
        ? (plotRight - estimatedPlotLeft) / intervalCount
        : 0;
    const intervalCenter =
      dataIndex >= 0
        ? estimatedPlotLeft + (dataIndex + 0.5) * intervalWidth
        : (point[0] ?? 0);
    const columnLeft = intervalCenter - barWidth / 2;
    const columnRight = intervalCenter + barWidth / 2;
    const rightPosition = columnRight + columnGap;
    const leftPosition = columnLeft - columnGap - tooltipWidth;
    const maximumLeft = chartWidth - tooltipWidth - chartEdgeGap;
    const fitsOnRight = rightPosition <= maximumLeft;
    const fitsOnLeft = leftPosition >= chartEdgeGap;
    let left: number;

    if (fitsOnRight) {
      left = rightPosition;
    } else if (fitsOnLeft) {
      left = leftPosition;
    } else {
      left = Math.min(
        maximumLeft,
        Math.max(chartEdgeGap, rightPosition)
      );
    }

    const minimumTop = 18;
    const maximumTop = Math.max(
      minimumTop,
      chartHeight - tooltipHeight - chartEdgeGap
    );
    const top = Math.min(
      maximumTop,
      Math.max(minimumTop, (point[1] ?? 0) - tooltipHeight / 2)
    );

    return [Math.max(chartEdgeGap, left), top];
  };
}

function createChartOption(
  mode: PeriodBalanceChartProps["mode"],
  intervals: readonly FinancialInterval[],
  selectedIntervalIndex: number | null,
  theme: StatisticsChartTheme
): EChartsCoreOption {
  const barWidth =
    mode === "YEAR" ? getYearBarWidth(intervals.length) : 34;

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
      position: createPeriodBalanceTooltipPosition(
        intervals.length,
        barWidth
      ),
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
        id: "period-balance-series",
        name: "Balance",
        type: "bar",
        data: intervals.map(({ balanceCents }, index) => {
          const value = balanceCents / 100;
          const isPositive = value >= 0;
          const isDimmed =
            selectedIntervalIndex !== null &&
            selectedIntervalIndex !== index;

          return {
            value,
            itemStyle: {
              color: isPositive ? theme.primarySoft : theme.dangerSoft,
              borderColor: isPositive ? theme.primary : theme.danger,
              borderWidth: 2,
              borderRadius: isPositive
                ? [4, 4, 0, 0]
                : [0, 0, 4, 4],
              opacity: isDimmed ? 0.2 : 1
            }
          };
        }),
        barWidth: mode === "YEAR" ? barWidth : undefined,
        barMaxWidth: mode === "ALL" ? 34 : undefined,
        emphasis: {
          disabled: true
        }
      }
    ]
  };
}

export default function PeriodBalanceChart({
  mode,
  intervals
}: PeriodBalanceChartProps) {
  const [selectedIntervalIndex, setSelectedIntervalIndex] = useState<
    number | null
  >(null);
  const displayedPeriod = useMemo(
    () => formatFinancialIntervalRange(intervals),
    [intervals]
  );
  useEffect(() => {
    setSelectedIntervalIndex(null);
  }, [intervals, mode]);
  const option = useMemo(
    () =>
      createChartOption(
        mode,
        intervals,
        selectedIntervalIndex,
        getStatisticsChartTheme()
      ),
    [mode, intervals, selectedIntervalIndex]
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
        highlightSelectedItemOnClick={false}
        onItemSelectionChange={setSelectedIntervalIndex}
        mergeOptionUpdates
        hideTooltip={selectedIntervalIndex === null}
      />
    </section>
  );
}
