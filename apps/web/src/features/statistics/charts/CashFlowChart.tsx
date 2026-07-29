import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Scale
} from "lucide-react";
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

type CashFlowChartProps = {
  mode: AggregateChartMode;
  intervals: readonly FinancialInterval[];
};

type CashFlowMetric = "income" | "expenses" | "balance";

type CashFlowMetricPhase = "visible" | "exiting" | "hidden";

type CashFlowMetricPhases = Record<
  CashFlowMetric,
  CashFlowMetricPhase
>;

type CashFlowTooltipPositionCache = {
  intervalIndex: number;
  chartWidth: number;
  chartHeight: number;
  position: [number, number];
};

const METRIC_TRANSITION_DURATION_MS = 420;
const METRIC_HIDE_DELAY_MS = METRIC_TRANSITION_DURATION_MS + 40;

const cashFlowMetricOptions = [
  {
    key: "income",
    label: "Income",
    icon: ArrowUpRight
  },
  {
    key: "expenses",
    label: "Expenses",
    icon: ArrowDownRight
  },
  {
    key: "balance",
    label: "Balance",
    icon: Scale
  }
] as const;

const compactNumberFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1
});

function formatCompactEuro(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${compactNumberFormatter.format(value / 1000)}k€`;
  }

  return `${Math.round(value)}€`;
}

function createTooltipMarker(color: string) {
  return `<span style="display:inline-block;width:7px;height:7px;margin-right:6px;border-radius:2px;background:${color};vertical-align:1px"></span>`;
}

function getYearBarWidth(intervalCount: number) {
  const missingMonths = Math.max(0, 12 - intervalCount);
  return Math.min(30, 18 + missingMonths * 2);
}

function createCashFlowTooltipPosition(
  intervalCount: number,
  barWidth: number,
  selectedIntervalIndex: number | null,
  positionCache: {
    current: CashFlowTooltipPositionCache | null;
  }
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
    const firstParam = Array.isArray(rawParams) ? rawParams[0] : rawParams;
    const dataIndex =
      typeof firstParam === "object" &&
      firstParam !== null &&
      "dataIndex" in firstParam
        ? Number(firstParam.dataIndex)
        : -1;
    const cachedPosition = positionCache.current;

    if (
      selectedIntervalIndex === dataIndex &&
      cachedPosition?.intervalIndex === dataIndex &&
      cachedPosition.chartWidth === chartWidth &&
      cachedPosition.chartHeight === chartHeight
    ) {
      return cachedPosition.position;
    }

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

    const position: [number, number] = [
      Math.max(chartEdgeGap, left),
      top
    ];

    if (dataIndex >= 0) {
      positionCache.current = {
        intervalIndex: dataIndex,
        chartWidth,
        chartHeight,
        position
      };
    }

    return position;
  };
}

function createChartOption(
  mode: AggregateChartMode,
  intervals: readonly FinancialInterval[],
  selectedIntervalIndex: number | null,
  metricPhases: CashFlowMetricPhases,
  theme: StatisticsChartTheme,
  tooltipPositionCache: {
    current: CashFlowTooltipPositionCache | null;
  }
): EChartsCoreOption {
  const barWidth =
    mode === "YEAR" ? getYearBarWidth(intervals.length) : 34;
  const axisLabels = new Map(
    intervals.map((interval) => [interval.key, interval.axisLabel])
  );
  const isMetricVisible = (metric: CashFlowMetric) =>
    metricPhases[metric] === "visible";
  const shouldRenderMetric = (metric: CashFlowMetric) =>
    metricPhases[metric] !== "hidden";

  return {
    animationDuration: 650,
    animationDurationUpdate: METRIC_TRANSITION_DURATION_MS,
    animationDelay: (index: number) => index * 28,
    animationEasing: "cubicOut",
    animationEasingUpdate: "cubicOut",
    aria: {
      enabled: true,
      description:
        "Layered column chart comparing income, expenses and balance for each interval."
    },
    grid: {
      top: 18,
      right: 8,
      bottom: 4,
      left: 4,
      containLabel: true
    },
    tooltip: {
      trigger: "axis",
      triggerOn: "click",
      alwaysShowContent: selectedIntervalIndex !== null,
      className: `stats-cash-flow-tooltip${
        selectedIntervalIndex !== null
          ? " stats-cash-flow-tooltip--visible"
          : ""
      }`,
      displayTransition: true,
      transitionDuration: 0.42,
      confine: true,
      position: createCashFlowTooltipPosition(
        intervals.length,
        barWidth,
        selectedIntervalIndex,
        tooltipPositionCache
      ),
      backgroundColor: "transparent",
      borderColor: "transparent",
      borderWidth: 0,
      padding: 0,
      shadowBlur: 0,
      shadowColor: "transparent",
      textStyle: {
        color: theme.text,
        fontFamily: theme.fontFamily,
        fontSize: 12,
        fontWeight: 400
      },
      axisPointer: {
        type: "line",
        lineStyle: {
          opacity: 0
        }
      },
      formatter: (rawParams: unknown) => {
        const firstParam = Array.isArray(rawParams) ? rawParams[0] : rawParams;
        const dataIndex =
          typeof firstParam === "object" &&
          firstParam !== null &&
          "dataIndex" in firstParam
            ? Number(firstParam.dataIndex)
            : -1;
        const interval = intervals[dataIndex];

        if (!interval) {
          return "";
        }

        const rows = [interval.tooltipLabel];

        if (isMetricVisible("income")) {
          rows.push(
            `${createTooltipMarker(theme.primary)}Income <strong>${formatEuroAmount(
              interval.incomeCents / 100,
              { fractionDigits: 2 }
            )}</strong>`
          );
        }

        if (isMetricVisible("expenses")) {
          rows.push(
            `${createTooltipMarker(theme.danger)}Expenses <strong>${formatEuroAmount(
              interval.expenseCents / 100,
              { fractionDigits: 2 }
            )}</strong>`
          );
        }

        if (isMetricVisible("balance")) {
          rows.push(
            `${createTooltipMarker(theme.balance)}Balance <strong>${formatEuroAmount(
              interval.balanceCents / 100,
              { showSign: true, fractionDigits: 2 }
            )}</strong>`
          );
        }

        return `<div class="stats-cash-flow-tooltip__content">${rows.join(
          "<br/>"
        )}</div>`;
      }
    },
    xAxis: {
      type: "category",
      z: 1,
      data: intervals.map(({ key }) => key),
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
        hideOverlap: false,
        formatter: (value: string) => axisLabels.get(value) ?? value
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
        id: "income-series",
        name: "Income",
        type: "bar",
        data: intervals.map(({ incomeCents }, index) => {
          const hasIncome = incomeCents !== 0;
          const shouldRender =
            shouldRenderMetric("income") && hasIncome;

          return {
            value: isMetricVisible("income") ? incomeCents / 100 : 0,
            itemStyle: {
              color: theme.primarySoft,
              borderColor: theme.primary,
              borderWidth: shouldRender ? 2 : 0,
              borderRadius: [4, 4, 0, 0],
              opacity: shouldRender
                ? selectedIntervalIndex !== null &&
                  selectedIntervalIndex !== index
                  ? 0.2
                  : 1
                : 0
            }
          };
        }),
        stack: "cash-flow-income",
        barWidth: mode === "YEAR" ? barWidth : undefined,
        barMaxWidth: mode === "ALL" ? barWidth : undefined,
        emphasis: {
          disabled: true
        },
        z: 3
      },
      {
        id: "expenses-series",
        name: "Expenses",
        type: "bar",
        data: intervals.map(({ expenseCents }, index) => {
          const hasExpenses = expenseCents !== 0;
          const shouldRender =
            shouldRenderMetric("expenses") && hasExpenses;

          return {
            value: isMetricVisible("expenses")
              ? -(expenseCents / 100)
              : 0,
            itemStyle: {
              color: theme.dangerSoft,
              borderColor: theme.danger,
              borderWidth: shouldRender ? 2 : 0,
              borderRadius: [0, 0, 4, 4],
              opacity: shouldRender
                ? selectedIntervalIndex !== null &&
                  selectedIntervalIndex !== index
                  ? 0.2
                  : 1
                : 0
            }
          };
        }),
        stack: "cash-flow-expenses",
        barWidth: mode === "YEAR" ? barWidth : undefined,
        barMaxWidth: mode === "ALL" ? barWidth : undefined,
        emphasis: {
          disabled: true
        },
        z: 3
      },
      {
        id: "balance-series",
        name: "Balance",
        type: "bar",
        data: intervals.map(({ balanceCents }, index) => {
          const balance = balanceCents / 100;
          const hasBalance = balanceCents !== 0;
          const shouldRender =
            shouldRenderMetric("balance") && hasBalance;
          const value = isMetricVisible("balance")
            ? balance
            : 0;
          const isPositive = balance >= 0;

          return {
            value,
            itemStyle: {
              color: theme.balanceSoft,
              borderColor: theme.balance,
              borderWidth: shouldRender ? 2 : 0,
              borderRadius: isPositive
                ? [4, 4, 0, 0]
                : [0, 0, 4, 4],
              opacity: shouldRender
                ? selectedIntervalIndex !== null &&
                  selectedIntervalIndex !== index
                  ? 0.2
                  : 1
                : 0
            }
          };
        }),
        stack: "cash-flow-balance",
        barWidth: mode === "YEAR" ? barWidth : undefined,
        barMaxWidth: mode === "ALL" ? barWidth : undefined,
        barGap: "-100%",
        emphasis: {
          disabled: true
        },
        z: 5
      }
    ]
  };
}

export default function CashFlowChart({
  mode,
  intervals
}: CashFlowChartProps) {
  const [selectedIntervalIndex, setSelectedIntervalIndex] = useState<
    number | null
  >(null);
  const [metricPhases, setMetricPhases] =
    useState<CashFlowMetricPhases>({
      income: "visible",
      expenses: "visible",
      balance: "visible"
    });
  const selectedIntervalIndexRef = useRef<number | null>(null);
  const tooltipPositionCacheRef =
    useRef<CashFlowTooltipPositionCache | null>(null);
  const metricExitTimersRef = useRef<
    Partial<Record<CashFlowMetric, number>>
  >({});
  const displayedPeriod = useMemo(
    () => formatFinancialIntervalRange(intervals),
    [intervals]
  );

  useEffect(() => {
    selectedIntervalIndexRef.current = null;
    tooltipPositionCacheRef.current = null;
    setSelectedIntervalIndex(null);
  }, [intervals, mode]);

  useEffect(
    () => () => {
      Object.values(metricExitTimersRef.current).forEach((timer) => {
        window.clearTimeout(timer);
      });
    },
    []
  );

  const activeMetricCount = Object.values(metricPhases).filter(
    (phase) => phase === "visible"
  ).length;
  const toggleMetric = useCallback(
    (metric: CashFlowMetric) => {
      const currentPhase = metricPhases[metric];

      if (currentPhase === "visible" && activeMetricCount === 1) {
        return;
      }

      selectedIntervalIndexRef.current = null;
      tooltipPositionCacheRef.current = null;
      setSelectedIntervalIndex(null);

      const activeTimer = metricExitTimersRef.current[metric];

      if (activeTimer !== undefined) {
        window.clearTimeout(activeTimer);
        delete metricExitTimersRef.current[metric];
      }

      if (currentPhase !== "visible") {
        setMetricPhases((current) => ({
          ...current,
          [metric]: "visible"
        }));
        return;
      }

      setMetricPhases((current) => ({
        ...current,
        [metric]: "exiting"
      }));
      metricExitTimersRef.current[metric] = window.setTimeout(() => {
        setMetricPhases((current) =>
          current[metric] === "exiting"
            ? {
                ...current,
                [metric]: "hidden"
              }
            : current
        );
        delete metricExitTimersRef.current[metric];
      }, METRIC_HIDE_DELAY_MS);
    },
    [activeMetricCount, metricPhases]
  );

  const handleAxisPointerSelection = useCallback(
    (axisValue: string | number | null) => {
      if (axisValue === null) {
        selectedIntervalIndexRef.current = null;
        setSelectedIntervalIndex(null);
        return true;
      }

      const intervalIndex =
        typeof axisValue === "number"
          ? Math.round(axisValue)
          : intervals.findIndex(({ key }) => key === axisValue);

      if (intervalIndex < 0) {
        return false;
      }

      if (intervalIndex === selectedIntervalIndexRef.current) {
        selectedIntervalIndexRef.current = null;
        setSelectedIntervalIndex(null);
        return false;
      }

      selectedIntervalIndexRef.current = intervalIndex;
      setSelectedIntervalIndex(intervalIndex);
      return true;
    },
    [intervals]
  );
  const option = useMemo(
    () =>
      createChartOption(
        mode,
        intervals,
        selectedIntervalIndex,
        metricPhases,
        getStatisticsChartTheme(),
        tooltipPositionCacheRef
      ),
    [mode, intervals, selectedIntervalIndex, metricPhases]
  );
  const ariaLabel = `Cash flow from ${displayedPeriod}. ${intervals.length} intervals shown.`;

  return (
    <section
      className="stats-chart-section stats-cash-flow"
      aria-labelledby="cash-flow-chart-title"
    >
      <header className="stats-chart-section__header">
        <h2 id="cash-flow-chart-title">Cash Flow</h2>
        <div
          className="stats-cash-flow__metrics"
          role="group"
          aria-label="Visible cash flow metrics"
        >
          {cashFlowMetricOptions.map(({ key, label, icon: Icon }) => {
            const isVisible = metricPhases[key] === "visible";
            const isOnlyVisible = isVisible && activeMetricCount === 1;

            return (
              <button
                key={key}
                type="button"
                className={`stats-cash-flow__metric stats-cash-flow__metric--${key}`}
                aria-label={`${isVisible ? "Hide" : "Show"} ${label.toLowerCase()}`}
                aria-pressed={isVisible}
                disabled={isOnlyVisible}
                title={
                  isOnlyVisible
                    ? `${label} must remain visible`
                    : `${isVisible ? "Hide" : "Show"} ${label.toLowerCase()}`
                }
                onClick={() => toggleMetric(key)}
              >
                <Icon aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </header>

      <EChart
        className="stats-cash-flow__chart"
        option={option}
        ariaLabel={ariaLabel}
        mergeOptionUpdates
        hideTooltip={selectedIntervalIndex === null}
        onAxisPointerSelection={handleAxisPointerSelection}
      />
    </section>
  );
}
