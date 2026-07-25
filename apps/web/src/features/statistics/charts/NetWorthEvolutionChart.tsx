import { useMemo } from "react";
import type { EChartsCoreOption } from "../../../components/charts/chart-engine";
import { EChart } from "../../../components/charts/EChart";
import { formatEuroAmount } from "../../../money/format-euro";
import {
  mockDailyFinancialSnapshots,
  mockOpeningNetWorth,
  type MockDailyFinancialSnapshot
} from "./statistics-chart-mock";

type NetWorthEvolutionChartProps = {
  mode: "MONTH" | "YEAR" | "ALL";
  selectedMonth: string;
  selectedYear: number;
};

type ChartTheme = {
  primary: string;
  primarySoft: string;
  border: string;
  surface: string;
  text: string;
  textMuted: string;
  fontFamily: string;
};

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
const compactNumberFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1
});

function toUtcDate(date: string) {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function getChartTheme(): ChartTheme {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string) => styles.getPropertyValue(name).trim();

  return {
    primary: token("--color-primary"),
    primarySoft: token("--color-primary-soft"),
    border: token("--color-border"),
    surface: token("--color-surface"),
    text: token("--color-text"),
    textMuted: token("--color-text-muted"),
    fontFamily: styles.fontFamily
  };
}

function getMonthEndSnapshots(
  snapshots: readonly MockDailyFinancialSnapshot[]
) {
  const monthEnds: MockDailyFinancialSnapshot[] = [];

  snapshots.forEach((snapshot, index) => {
    const nextSnapshot = snapshots[index + 1];

    if (!nextSnapshot || nextSnapshot.date.slice(0, 7) !== snapshot.date.slice(0, 7)) {
      monthEnds.push(snapshot);
    }
  });

  const openingSnapshot: MockDailyFinancialSnapshot = {
    date: mockOpeningNetWorth.date,
    incomeCents: 0,
    expenseCents: 0,
    netWorthCents: mockOpeningNetWorth.amountCents
  };

  return [openingSnapshot, ...monthEnds];
}

function getVisibleSnapshots(
  mode: NetWorthEvolutionChartProps["mode"],
  selectedMonth: string,
  selectedYear: number
) {
  if (mode === "MONTH") {
    return mockDailyFinancialSnapshots.filter((snapshot) =>
      snapshot.date.startsWith(selectedMonth)
    );
  }

  if (mode === "YEAR") {
    return mockDailyFinancialSnapshots.filter((snapshot) =>
      snapshot.date.startsWith(`${selectedYear}-`)
    );
  }

  return getMonthEndSnapshots(mockDailyFinancialSnapshots);
}

function createMonthTicks(snapshots: readonly MockDailyFinancialSnapshot[]) {
  const labels = new Map<string, string>();
  const markerCount = Math.min(7, snapshots.length);

  for (let index = 0; index < markerCount; index += 1) {
    const snapshotIndex = Math.round(
      (index * Math.max(snapshots.length - 1, 0)) /
        Math.max(markerCount - 1, 1)
    );
    const snapshot = snapshots[snapshotIndex];

    if (snapshot) {
      labels.set(snapshot.date, String(Number(snapshot.date.slice(-2))));
    }
  }

  return labels;
}

function createYearTicks(snapshots: readonly MockDailyFinancialSnapshot[]) {
  const labels = new Map<string, string>();

  snapshots.forEach((snapshot, index) => {
    const previousSnapshot = snapshots[index - 1];
    const month = snapshot.date.slice(0, 7);

    if (!previousSnapshot || previousSnapshot.date.slice(0, 7) !== month) {
      labels.set(snapshot.date, shortMonthFormatter.format(toUtcDate(snapshot.date)));
    }
  });

  return labels;
}

function createAllTicks(snapshots: readonly MockDailyFinancialSnapshot[]) {
  const labels = new Map<string, string>();
  const representedYears = new Set(
    snapshots.map((snapshot) => snapshot.date.slice(0, 4))
  );
  const showMidYearReference = representedYears.size <= 3;

  snapshots.forEach((snapshot, index) => {
    const year = snapshot.date.slice(0, 4);
    const month = snapshot.date.slice(5, 7);

    if (index === 0 || month === "01") {
      labels.set(snapshot.date, year);
    } else if (showMidYearReference && month === "07") {
      labels.set(snapshot.date, "Jul");
    }
  });

  return labels;
}

function createTickLabels(
  mode: NetWorthEvolutionChartProps["mode"],
  snapshots: readonly MockDailyFinancialSnapshot[]
) {
  if (mode === "MONTH") {
    return createMonthTicks(snapshots);
  }

  if (mode === "YEAR") {
    return createYearTicks(snapshots);
  }

  return createAllTicks(snapshots);
}

function formatCompactEuro(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${compactNumberFormatter.format(value / 1000)}k€`;
  }

  return `${Math.round(value)}€`;
}

function createChartOption(
  snapshots: readonly MockDailyFinancialSnapshot[],
  tickLabels: ReadonlyMap<string, string>,
  theme: ChartTheme
): EChartsCoreOption {
  const dates = snapshots.map((snapshot) => snapshot.date);
  const values = snapshots.map((snapshot) => ({
    value: snapshot.netWorthCents / 100,
    symbolSize: tickLabels.has(snapshot.date) ? 6 : 0
  }));

  return {
    animationDuration: 650,
    animationDurationUpdate: 420,
    animationEasing: "cubicOut",
    animationEasingUpdate: "cubicOut",
    aria: {
      enabled: true,
      description:
        "Line chart showing the evolution of net worth throughout the selected period."
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
        const snapshot = snapshots[dataIndex];

        if (!snapshot) {
          return "";
        }

        return `${fullDateFormatter.format(toUtcDate(snapshot.date))}<br/><strong>${formatEuroAmount(
          snapshot.netWorthCents / 100,
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
        show: false
      },
      axisLabel: {
        interval: 0,
        color: theme.textMuted,
        fontFamily: theme.fontFamily,
        fontSize: 10,
        margin: 10,
        hideOverlap: true,
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
          focus: "series",
          scale: 1.2
        }
      }
    ]
  };
}

export default function NetWorthEvolutionChart({
  mode,
  selectedMonth,
  selectedYear
}: NetWorthEvolutionChartProps) {
  const snapshots = useMemo(
    () => getVisibleSnapshots(mode, selectedMonth, selectedYear),
    [mode, selectedMonth, selectedYear]
  );
  const tickLabels = useMemo(
    () => createTickLabels(mode, snapshots),
    [mode, snapshots]
  );
  const option = useMemo(
    () => createChartOption(snapshots, tickLabels, getChartTheme()),
    [snapshots, tickLabels]
  );
  const finalSnapshot = snapshots[snapshots.length - 1];
  const currentValue = finalSnapshot?.netWorthCents ?? 0;
  const ariaLabel = `Net worth evolution. Final value ${formatEuroAmount(
    currentValue / 100,
    { fractionDigits: 0 }
  )}.`;

  return (
    <section
      className="stats-chart-section stats-net-worth"
      aria-labelledby="net-worth-chart-title"
    >
      <header className="stats-chart-section__header">
        <div>
          <h2 id="net-worth-chart-title">Net Worth Evolution</h2>
          <p>Mock data · Started Mar 2024</p>
        </div>
        <strong>
          {formatEuroAmount(currentValue / 100, { fractionDigits: 0 })}
        </strong>
      </header>

      <EChart
        className="stats-net-worth__chart"
        option={option}
        ariaLabel={ariaLabel}
      />
    </section>
  );
}
