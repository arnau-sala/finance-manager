import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
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

type IncomeExpensesChartProps = {
  mode: AggregateChartMode;
  intervals: readonly FinancialInterval[];
};

type StepChartData = {
  axisKeys: string[];
  axisLabels: ReadonlyMap<string, string>;
  boundaryKeys: ReadonlySet<string>;
  intervalIndexes: number[];
  incomeValues: number[];
  expenseValues: number[];
};

const compactNumberFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1
});

function createStepChartData(
  intervals: readonly FinancialInterval[]
): StepChartData {
  const axisKeys: string[] = [];
  const axisLabels = new Map<string, string>();
  const boundaryKeys = new Set<string>();
  const intervalIndexes: number[] = [];
  const incomeValues: number[] = [];
  const expenseValues: number[] = [];

  intervals.forEach((interval, intervalIndex) => {
    const boundaryKey = `${interval.key}:start`;
    const midpointKey = `${interval.key}:middle`;
    const income = interval.incomeCents / 100;
    const expenses = -(interval.expenseCents / 100);

    axisKeys.push(boundaryKey, midpointKey);
    boundaryKeys.add(boundaryKey);
    axisLabels.set(midpointKey, interval.axisLabel);
    intervalIndexes.push(intervalIndex, intervalIndex);
    incomeValues.push(income, income);
    expenseValues.push(expenses, expenses);
  });

  const finalInterval = intervals[intervals.length - 1];

  if (finalInterval) {
    const finalBoundaryKey = `${finalInterval.key}:end`;
    axisKeys.push(finalBoundaryKey);
    boundaryKeys.add(finalBoundaryKey);
    intervalIndexes.push(intervals.length - 1);
    incomeValues.push(finalInterval.incomeCents / 100);
    expenseValues.push(-(finalInterval.expenseCents / 100));
  }

  return {
    axisKeys,
    axisLabels,
    boundaryKeys,
    intervalIndexes,
    incomeValues,
    expenseValues
  };
}

function formatCompactEuro(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${compactNumberFormatter.format(value / 1000)}k€`;
  }

  return `${Math.round(value)}€`;
}

function createTooltipMarker(color: string) {
  return `<span style="display:inline-block;width:7px;height:7px;margin-right:6px;border-radius:2px;background:${color};vertical-align:1px"></span>`;
}

function createIncomeExpensesTooltipPosition(
  intervalIndexes: readonly number[],
  intervalCount: number
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
    const intervalIndex = intervalIndexes[dataIndex] ?? -1;
    const plotRight = Math.max(
      estimatedPlotLeft,
      chartWidth - chartEdgeGap
    );
    const plotWidth = plotRight - estimatedPlotLeft;
    const intervalWidth =
      intervalCount > 0 ? plotWidth / intervalCount : 0;
    const columnLeft =
      intervalIndex >= 0
        ? estimatedPlotLeft + intervalIndex * intervalWidth
        : (point[0] ?? 0);
    const columnRight =
      intervalIndex >= 0 ? columnLeft + intervalWidth : columnLeft;
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

    const minimumTop = 36;
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
  mode: AggregateChartMode,
  intervals: readonly FinancialInterval[],
  stepData: StepChartData,
  selectedIntervalIndex: number | null,
  theme: StatisticsChartTheme
): EChartsCoreOption {
  const hasSelection = selectedIntervalIndex !== null;
  const baseOpacity = hasSelection ? 0.2 : 1;
  const selectedInterval =
    selectedIntervalIndex === null
      ? null
      : intervals[selectedIntervalIndex] ?? null;
  const selectedStartIndex =
    selectedIntervalIndex === null ? -1 : selectedIntervalIndex * 2;
  const selectedStartKey = stepData.axisKeys[selectedStartIndex];
  const selectedEndKey = stepData.axisKeys[selectedStartIndex + 2];

  return {
    animationDuration: 650,
    animationDurationUpdate: 420,
    animationEasing: "cubicOut",
    animationEasingUpdate: "cubicOut",
    aria: {
      enabled: true,
      description:
        "Stepped area chart comparing income above zero with expenses below zero."
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
      alwaysShowContent: hasSelection,
      confine: true,
      position: createIncomeExpensesTooltipPosition(
        stepData.intervalIndexes,
        intervals.length
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
      axisPointer: {
        type: "line",
        lineStyle: {
          color: theme.border,
          width: 1,
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
        const intervalIndex = stepData.intervalIndexes[dataIndex] ?? -1;
        const interval = intervals[intervalIndex];

        if (!interval) {
          return "";
        }

        return [
          interval.tooltipLabel,
          `${createTooltipMarker(theme.primary)}Income <strong>${formatEuroAmount(
            interval.incomeCents / 100,
            { fractionDigits: 2 }
          )}</strong>`,
          `${createTooltipMarker(theme.danger)}Expenses <strong>${formatEuroAmount(
            interval.expenseCents / 100,
            { fractionDigits: 2 }
          )}</strong>`
        ].join("<br/>");
      }
    },
    xAxis: {
      type: "category",
      data: stepData.axisKeys,
      boundaryGap: false,
      axisLine: {
        show: true,
        onZero: true,
        lineStyle: {
          color: theme.border,
          width: 1,
          type: "solid"
        }
      },
      axisTick: {
        show: true,
        alignWithLabel: true,
        interval: (_index: number, value: string) =>
          stepData.boundaryKeys.has(value),
        length: 4,
        lineStyle: {
          color: theme.border,
          width: 1
        }
      },
      axisLabel: {
        interval: (_index: number, value: string) =>
          stepData.axisLabels.has(value),
        color: theme.textMuted,
        fontFamily: theme.fontFamily,
        fontSize: 10,
        margin: 10,
        hideOverlap: mode === "ALL",
        formatter: (value: string) => stepData.axisLabels.get(value) ?? ""
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
        type: "line",
        data: stepData.incomeValues,
        step: "end",
        showSymbol: false,
        lineStyle: {
          color: theme.primary,
          width: 1.8,
          opacity: baseOpacity
        },
        itemStyle: {
          color: theme.primarySoft,
          borderColor: theme.primary,
          borderWidth: 1.5
        },
        areaStyle: {
          color: theme.primarySoft,
          opacity: baseOpacity
        },
        emphasis: {
          disabled: true
        },
        markArea:
          selectedInterval && selectedStartKey && selectedEndKey
            ? {
                silent: true,
                animation: false,
                data: [
                  [
                    {
                      xAxis: selectedStartKey,
                      yAxis: 0,
                      itemStyle: {
                        color: theme.primarySoft,
                        borderWidth: 0
                      }
                    },
                    {
                      xAxis: selectedEndKey,
                      yAxis: selectedInterval.incomeCents / 100
                    }
                  ]
                ]
              }
            : {
                data: []
              }
      },
      {
        id: "expenses-series",
        name: "Expenses",
        type: "line",
        data: stepData.expenseValues,
        step: "end",
        showSymbol: false,
        lineStyle: {
          color: theme.danger,
          width: 1.8,
          opacity: baseOpacity
        },
        itemStyle: {
          color: theme.dangerSoft,
          borderColor: theme.danger,
          borderWidth: 1.5
        },
        areaStyle: {
          color: theme.dangerSoft,
          opacity: baseOpacity
        },
        emphasis: {
          disabled: true
        },
        markArea:
          selectedInterval && selectedStartKey && selectedEndKey
            ? {
                silent: true,
                animation: false,
                data: [
                  [
                    {
                      xAxis: selectedStartKey,
                      yAxis: 0,
                      itemStyle: {
                        color: theme.dangerSoft,
                        borderWidth: 0
                      }
                    },
                    {
                      xAxis: selectedEndKey,
                      yAxis: -(selectedInterval.expenseCents / 100)
                    }
                  ]
                ]
              }
            : {
                data: []
              }
      },
      {
        id: "income-selection-outline",
        type: "line",
        data:
          selectedInterval && selectedStartKey && selectedEndKey
            ? [
                [selectedStartKey, 0],
                [selectedStartKey, selectedInterval.incomeCents / 100],
                [selectedEndKey, selectedInterval.incomeCents / 100],
                [selectedEndKey, 0]
              ]
            : [],
        symbol: "none",
        silent: true,
        animation: false,
        tooltip: {
          show: false
        },
        lineStyle: {
          color: theme.primary,
          width: 2
        },
        emphasis: {
          disabled: true
        },
        z: 10
      },
      {
        id: "expenses-selection-outline",
        type: "line",
        data:
          selectedInterval && selectedStartKey && selectedEndKey
            ? [
                [selectedStartKey, 0],
                [
                  selectedStartKey,
                  -(selectedInterval.expenseCents / 100)
                ],
                [
                  selectedEndKey,
                  -(selectedInterval.expenseCents / 100)
                ],
                [selectedEndKey, 0]
              ]
            : [],
        symbol: "none",
        silent: true,
        animation: false,
        tooltip: {
          show: false
        },
        lineStyle: {
          color: theme.danger,
          width: 2
        },
        emphasis: {
          disabled: true
        },
        z: 10
      }
    ]
  };
}

export default function IncomeExpensesChart({
  mode,
  intervals
}: IncomeExpensesChartProps) {
  const [selectedIntervalIndex, setSelectedIntervalIndex] = useState<
    number | null
  >(null);
  const selectedIntervalIndexRef = useRef<number | null>(null);
  const stepData = useMemo(
    () => createStepChartData(intervals),
    [intervals]
  );
  const displayedPeriod = useMemo(
    () => formatFinancialIntervalRange(intervals),
    [intervals]
  );
  useEffect(() => {
    selectedIntervalIndexRef.current = null;
    setSelectedIntervalIndex(null);
  }, [intervals, mode]);
  const handleAxisPointerSelection = useCallback(
    (axisValue: string | number | null) => {
      if (axisValue === null) {
        selectedIntervalIndexRef.current = null;
        setSelectedIntervalIndex(null);
        return true;
      }

      const axisIndex =
        typeof axisValue === "number"
          ? Math.round(axisValue)
          : stepData.axisKeys.indexOf(axisValue);
      const intervalIndex = stepData.intervalIndexes[axisIndex];

      if (intervalIndex === undefined) {
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
    [stepData]
  );
  const option = useMemo(
    () =>
      createChartOption(
        mode,
        intervals,
        stepData,
        selectedIntervalIndex,
        getStatisticsChartTheme()
      ),
    [mode, intervals, selectedIntervalIndex, stepData]
  );
  const ariaLabel = `Income and expenses from ${displayedPeriod}. ${intervals.length} intervals shown.`;

  return (
    <section
      className="stats-chart-section stats-income-expenses"
      aria-labelledby="income-expenses-chart-title"
    >
      <header className="stats-chart-section__header">
        <h2 id="income-expenses-chart-title">Income vs Expenses</h2>
        <span className="stats-chart-section__period">{displayedPeriod}</span>
      </header>

      <EChart
        className="stats-income-expenses__chart"
        option={option}
        ariaLabel={ariaLabel}
        mergeOptionUpdates
        hideTooltip={selectedIntervalIndex === null}
        onAxisPointerSelection={handleAxisPointerSelection}
      />
    </section>
  );
}
