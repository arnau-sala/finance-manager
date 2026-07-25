import { useEffect, useMemo, useState } from "react";
import type { EChartsCoreOption } from "../../../components/charts/chart-engine";
import { EChart } from "../../../components/charts/EChart";
import { formatEuroAmount } from "../../../money/format-euro";
import {
  mockStatisticsMonthlyTotals,
  mockStatisticsTransactions,
  type MockStatisticsTransaction
} from "../statistics-mock";
import {
  getStatisticsChartTheme,
  type StatisticsChartTheme
} from "./statistics-chart-theme";

type WeekdaySpendingChartProps = {
  selectedMonth: string;
};

type SpendingInterval = {
  key: string;
  axisLabel: string;
  tooltipLabel: string;
  averageAmount: number;
  totalAmount: number;
  transactionCount: number;
};

type ExpenseTransaction = {
  date: string;
  amount: number;
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

function getStringHash(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function getMonthlyExpenseTotal(monthKey: string) {
  return (
    mockStatisticsMonthlyTotals.find(({ month }) => month === monthKey)
      ?.expenses ?? 0
  );
}

function isExpenseTransaction(transaction: MockStatisticsTransaction) {
  return transaction.type !== "INCOME";
}

function createMonthExpenseTransactions(monthKey: string) {
  const monthlyTotal = getMonthlyExpenseTotal(monthKey);
  const transactions = mockStatisticsTransactions.filter(
    (transaction) =>
      transaction.date.startsWith(`${monthKey}-`) &&
      isExpenseTransaction(transaction)
  );

  if (monthlyTotal <= 0 || transactions.length === 0) {
    return [];
  }

  const fixedTransactions = transactions.filter(
    (transaction) => transaction.amountCents !== undefined
  );
  const generatedTransactions = transactions.filter(
    (transaction) => transaction.amountCents === undefined
  );
  const fixedTotal = fixedTransactions.reduce(
    (total, transaction) =>
      total + (transaction.amountCents ?? 0) / 100,
    0
  );
  const amountToDistribute = Math.max(0, monthlyTotal - fixedTotal);
  const weights = generatedTransactions.map(
    (transaction) => 20 + (getStringHash(transaction.id) % 181)
  );
  const totalWeight = weights.reduce(
    (total, weight) => total + weight,
    0
  );
  let allocatedAmount = 0;

  const generatedExpenses = generatedTransactions.map<ExpenseTransaction>(
    (transaction, index) => {
      const amount =
        index === generatedTransactions.length - 1
          ? amountToDistribute - allocatedAmount
          : Math.round(
              ((amountToDistribute * (weights[index] ?? 0)) /
                totalWeight) *
                100
            ) / 100;
      allocatedAmount += amount;

      return {
        date: transaction.date,
        amount: Math.max(0, amount)
      };
    }
  );

  return [
    ...generatedExpenses,
    ...fixedTransactions.map<ExpenseTransaction>((transaction) => ({
      date: transaction.date,
      amount: (transaction.amountCents ?? 0) / 100
    }))
  ];
}

function getWeekdayIndex(date: string) {
  return (toUtcDate(date).getUTCDay() + 6) % 7;
}

function createMonthSpendingIntervals(selectedMonth: string) {
  const endDate = getMonthEndDate(selectedMonth);
  const finalDay = Number(endDate.slice(8, 10));
  const transactions = createMonthExpenseTransactions(selectedMonth);
  const occurrenceCounts = Array.from({ length: 7 }, () => 0);
  const totalAmounts = Array.from({ length: 7 }, () => 0);
  const transactionCounts = Array.from({ length: 7 }, () => 0);

  for (let day = 1; day <= finalDay; day += 1) {
    const date = `${selectedMonth}-${String(day).padStart(2, "0")}`;
    const weekdayIndex = getWeekdayIndex(date);

    occurrenceCounts[weekdayIndex] =
      (occurrenceCounts[weekdayIndex] ?? 0) + 1;
  }

  transactions.forEach((transaction) => {
    const weekdayIndex = getWeekdayIndex(transaction.date);
    totalAmounts[weekdayIndex] =
      (totalAmounts[weekdayIndex] ?? 0) + transaction.amount;
    transactionCounts[weekdayIndex] =
      (transactionCounts[weekdayIndex] ?? 0) + 1;
  });

  return {
    hasEnoughData: transactions.length > 5,
    startDate: `${selectedMonth}-01`,
    endDate,
    intervals: WEEKDAY_LABELS.map<SpendingInterval>(
      (weekday, weekdayIndex) => {
        const totalAmount = totalAmounts[weekdayIndex] ?? 0;
        const occurrenceCount = occurrenceCounts[weekdayIndex] ?? 0;

        return {
          key: weekday.axis,
          axisLabel: weekday.axis,
          tooltipLabel: weekday.full,
          averageAmount:
            occurrenceCount > 0 ? totalAmount / occurrenceCount : 0,
          totalAmount,
          transactionCount: transactionCounts[weekdayIndex] ?? 0
        };
      }
    )
  };
}

function formatCompactEuro(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${compactNumberFormatter.format(value / 1000)}k\u20ac`;
  }

  return `${Math.round(value)}\u20ac`;
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
        "Bar chart showing average spending for each displayed interval."
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
  selectedMonth
}: WeekdaySpendingChartProps) {
  const [selectedIntervalIndex, setSelectedIntervalIndex] = useState<
    number | null
  >(null);
  const chartData = useMemo(
    () => createMonthSpendingIntervals(selectedMonth),
    [selectedMonth]
  );
  const displayedPeriod = useMemo(
    () =>
      formatDisplayedPeriod(chartData.startDate, chartData.endDate),
    [chartData.endDate, chartData.startDate]
  );
  const option = useMemo(
    () =>
      createChartOption(
        chartData.intervals,
        selectedIntervalIndex,
        getStatisticsChartTheme()
      ),
    [chartData.intervals, selectedIntervalIndex]
  );

  useEffect(() => {
    setSelectedIntervalIndex(null);
  }, [selectedMonth]);

  if (!chartData.hasEnoughData) {
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
