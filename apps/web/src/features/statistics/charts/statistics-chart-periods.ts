export type AggregateChartMode = "YEAR" | "ALL";

export type FinancialInterval = {
  key: string;
  axisLabel: string;
  tooltipLabel: string;
  startDate: string;
  endDate: string;
  incomeCents: number;
  expenseCents: number;
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

function toUtcDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

export function createFinancialIntervals(
  mode: AggregateChartMode,
  intervals: readonly {
    key: string;
    startDate: string;
    endDate: string;
    income: number;
    expenses: number;
    balance: number;
  }[]
): FinancialInterval[] {
  return intervals.map((interval) => {
    const date = toUtcDate(interval.startDate);

    return {
      key: interval.key,
      axisLabel:
        mode === "YEAR" ? shortMonthFormatter.format(date) : interval.key,
      tooltipLabel:
        mode === "YEAR" ? longMonthFormatter.format(date) : interval.key,
      startDate: interval.startDate,
      endDate: interval.endDate,
      incomeCents: Math.round(interval.income * 100),
      expenseCents: Math.round(interval.expenses * 100),
      balanceCents: Math.round(interval.balance * 100)
    };
  });
}

export function formatFinancialIntervalRange(
  intervals: readonly FinancialInterval[]
) {
  const firstInterval = intervals[0];
  const finalInterval = intervals[intervals.length - 1];

  if (!firstInterval || !finalInterval) {
    return "";
  }

  return `${periodDateFormatter.format(
    toUtcDate(firstInterval.startDate)
  )} - ${periodDateFormatter.format(toUtcDate(finalInterval.endDate))}`;
}
