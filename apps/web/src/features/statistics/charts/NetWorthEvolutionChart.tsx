import { useMemo } from "react";

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

type NetWorthEvolutionChartProps = {
  mode: StatisticsPeriodMode;
  periodStart: string;
  periodEnd: string;
  netWorth: StatisticsCharts["netWorth"];
};

type ReadyNetWorth = Extract<
  StatisticsCharts["netWorth"],
  { status: "READY" }
>;

type NetWorthPoint = ReadyNetWorth["points"][number];

const shortMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  timeZone: "UTC"
});
const fullDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
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
  return new Date(`${date}T00:00:00.000Z`);
}

function formatDate(date: string) {
  return periodDateFormatter.format(toUtcDate(date));
}

function createMonthTicks(points: readonly NetWorthPoint[]) {
  const labels = new Map<string, string>();
  const markerCount = Math.min(7, points.length);

  for (let index = 0; index < markerCount; index += 1) {
    const pointIndex = Math.round(
      (index * Math.max(points.length - 1, 0)) /
        Math.max(markerCount - 1, 1)
    );
    const point = points[pointIndex];

    if (point) {
      labels.set(point.date, String(Number(point.date.slice(-2))));
    }
  }

  return labels;
}

function createYearTicks(points: readonly NetWorthPoint[]) {
  const labels = new Map<string, string>();
  const pointsByMonth = new Map<string, NetWorthPoint[]>();

  points.forEach((point) => {
    const month = point.date.slice(0, 7);
    const monthPoints = pointsByMonth.get(month) ?? [];
    monthPoints.push(point);
    pointsByMonth.set(month, monthPoints);
  });

  pointsByMonth.forEach((monthPoints) => {
    const middlePoint = monthPoints[Math.floor((monthPoints.length - 1) / 2)];

    if (middlePoint) {
      labels.set(
        middlePoint.date,
        shortMonthFormatter.format(toUtcDate(middlePoint.date))
      );
    }
  });

  return labels;
}

function createAllTicks(points: readonly NetWorthPoint[]) {
  const labels = new Map<string, string>();
  const pointsByYear = new Map<string, NetWorthPoint[]>();

  points.forEach((point) => {
    const year = point.date.slice(0, 4);
    const yearPoints = pointsByYear.get(year) ?? [];
    yearPoints.push(point);
    pointsByYear.set(year, yearPoints);
  });

  pointsByYear.forEach((yearPoints, year) => {
    const middlePoint = yearPoints[Math.floor((yearPoints.length - 1) / 2)];

    if (middlePoint) {
      labels.set(middlePoint.date, year);
    }
  });

  return labels;
}

function createPeriodStartMarkers(
  points: readonly NetWorthPoint[],
  periodKeyLength: number
) {
  const markers = new Set<string>();

  points.forEach((point, index) => {
    const previousPoint = points[index - 1];

    if (
      !previousPoint ||
      previousPoint.date.slice(0, periodKeyLength) !==
        point.date.slice(0, periodKeyLength)
    ) {
      markers.add(point.date);
    }
  });

  return markers;
}

function createPeriodBoundaryTicks(
  points: readonly NetWorthPoint[],
  periodKeyLength: number
) {
  const boundaries = createPeriodStartMarkers(points, periodKeyLength);
  const finalPoint = points[points.length - 1];

  if (finalPoint) {
    boundaries.add(finalPoint.date);
  }

  return boundaries;
}

function createMonthStartMarkers(points: readonly NetWorthPoint[]) {
  return new Set(
    points
      .filter((point) => point.date.endsWith("-01"))
      .map((point) => point.date)
  );
}

function createTickLabels(
  mode: StatisticsPeriodMode,
  points: readonly NetWorthPoint[]
) {
  if (mode === "MONTH") {
    return createMonthTicks(points);
  }

  if (mode === "YEAR") {
    return createYearTicks(points);
  }

  return createAllTicks(points);
}

function formatCompactEuro(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${compactNumberFormatter.format(value / 1000)}k€`;
  }

  return formatEuroAmount(value, { fractionDigits: 0 });
}

type TooltipPositionSize = {
  contentSize: [number, number];
  viewSize: [number, number];
};

function positionTooltipAbovePointer(
  point: [number, number],
  _params: unknown,
  _element: HTMLElement,
  _rect: unknown,
  size: TooltipPositionSize
): [number, number] {
  const [pointerX, pointerY] = point;
  const [tooltipWidth, tooltipHeight] = size.contentSize;
  const [viewWidth, viewHeight] = size.viewSize;
  const edgeMargin = 4;
  const pointerGap = 26;
  const centeredX = pointerX - tooltipWidth / 2;
  const maxX = Math.max(edgeMargin, viewWidth - tooltipWidth - edgeMargin);
  const x = Math.min(Math.max(centeredX, edgeMargin), maxX);
  const yAbove = pointerY - tooltipHeight - pointerGap;

  if (yAbove >= edgeMargin) {
    return [x, yAbove];
  }

  const yBelow = pointerY + pointerGap;
  const maxY = Math.max(edgeMargin, viewHeight - tooltipHeight - edgeMargin);

  return [x, Math.min(yBelow, maxY)];
}

function createChartOption(
  mode: StatisticsPeriodMode,
  points: readonly NetWorthPoint[],
  tickLabels: ReadonlyMap<string, string>,
  theme: StatisticsChartTheme
): EChartsCoreOption {
  const dates = points.map((point) => point.date);
  const axisTickDates =
    mode === "YEAR"
      ? createPeriodBoundaryTicks(points, 7)
      : mode === "ALL"
        ? createPeriodBoundaryTicks(points, 4)
        : new Set(tickLabels.keys());
  const markerDates =
    mode === "YEAR"
      ? createPeriodStartMarkers(points, 7)
      : mode === "ALL"
        ? createMonthStartMarkers(points)
        : new Set(tickLabels.keys());
  const values = points.map((point) => {
    const isMarker = markerDates.has(point.date);

    return {
      value: point.value,
      symbol: isMarker ? "circle" : "none",
      symbolSize: isMarker ? 6 : 0
    };
  });

  return {
    animationDuration: 650,
    animationDurationUpdate: 420,
    animationEasing: "cubicOut",
    animationEasingUpdate: "cubicOut",
    aria: {
      enabled: true,
      description:
        "Line chart showing the evolution of net worth throughout the selected period"
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
      confine: true,
      position: positionTooltipAbovePointer,
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
          width: 1
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
        const point = points[dataIndex];

        if (!point) {
          return "";
        }

        return `${fullDateFormatter.format(toUtcDate(point.date))}<br/><strong>${formatEuroAmount(
          point.value,
          { fractionDigits: 0 }
        )}</strong>`;
      }
    },
    xAxis: {
      type: "category",
      data: dates,
      boundaryGap: false,
      axisLine: {
        lineStyle: {
          color: theme.border
        }
      },
      axisTick: {
        show: true,
        alignWithLabel: true,
        interval: (_index: number, value: string) => axisTickDates.has(value),
        length: 4,
        lineStyle: {
          color: theme.border,
          width: 1
        }
      },
      axisLabel: {
        interval: (_index: number, value: string) => tickLabels.has(value),
        color: theme.textMuted,
        fontFamily: theme.fontFamily,
        fontSize: 10,
        margin: 10,
        hideOverlap: mode === "ALL",
        showMinLabel: true,
        showMaxLabel: true,
        formatter: (value: string) => tickLabels.get(value) ?? ""
      }
    },
    yAxis: {
      type: "value",
      scale: true,
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
        name: "Net worth",
        type: "line",
        data: values,
        showSymbol: true,
        showAllSymbol: true,
        symbol: "circle",
        lineStyle: {
          color: theme.primary,
          width: 2.4
        },
        itemStyle: {
          color: theme.primary,
          borderColor: theme.surface,
          borderWidth: 1.5
        },
        areaStyle: {
          color: theme.primarySoft,
          opacity: 0.5
        },
        emphasis: {
          disabled: true
        }
      }
    ]
  };
}

function ReadyNetWorthChart({
  mode,
  netWorth
}: {
  mode: StatisticsPeriodMode;
  netWorth: ReadyNetWorth;
}) {
  const tickLabels = useMemo(
    () => createTickLabels(mode, netWorth.points),
    [mode, netWorth.points]
  );
  const option = useMemo(
    () =>
      createChartOption(
        mode,
        netWorth.points,
        tickLabels,
        getStatisticsChartTheme()
      ),
    [mode, netWorth.points, tickLabels]
  );
  const firstPoint = netWorth.points[0];
  const finalPoint = netWorth.points[netWorth.points.length - 1];
  const displayedPeriod =
    firstPoint && finalPoint
      ? `${formatDate(firstPoint.date)} - ${formatDate(finalPoint.date)}`
      : "";
  const finalValue = finalPoint?.value ?? netWorth.openingAmount;
  const ariaLabel = `Net worth evolution\nFinal value ${formatEuroAmount(
    finalValue,
    { fractionDigits: 0 }
  )}\nDisplayed period ${displayedPeriod}`;

  return (
    <section
      className="stats-chart-section stats-net-worth"
      aria-labelledby="net-worth-chart-title"
    >
      <header className="stats-chart-section__header">
        <h2 id="net-worth-chart-title">Net Worth Evolution</h2>
        <span className="stats-chart-section__period">{displayedPeriod}</span>
      </header>

      <EChart
        className="stats-net-worth__chart"
        option={option}
        ariaLabel={ariaLabel}
        arbitrateTouchScroll
      />
    </section>
  );
}

export default function NetWorthEvolutionChart({
  mode,
  periodStart,
  periodEnd,
  netWorth
}: NetWorthEvolutionChartProps) {
  if (netWorth.status === "READY") {
    return <ReadyNetWorthChart mode={mode} netWorth={netWorth} />;
  }

  const displayedPeriod = `${formatDate(periodStart)} - ${formatDate(
    periodEnd
  )}`;
  return (
    <section
      className="stats-chart-section stats-net-worth"
      aria-labelledby="net-worth-chart-title"
    >
      <header className="stats-chart-section__header">
        <h2 id="net-worth-chart-title">Net Worth Evolution</h2>
        <span className="stats-chart-section__period">{displayedPeriod}</span>
      </header>

      <div className="stats-chart-unavailable">
        <strong>Starting net worth required</strong>
        <span>This chart will appear after your starting net worth is set</span>
      </div>
    </section>
  );
}
