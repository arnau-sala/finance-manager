import { mockStatisticsMonthlyTotals } from "../statistics-mock";

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

function toCents(value: number) {
  return Math.round(value * 100);
}

function createYearIntervals(selectedYear: number): FinancialInterval[] {
  return mockStatisticsMonthlyTotals
    .filter(({ month }) => month.startsWith(`${selectedYear}-`))
    .map(({ month, income, expenses }) => {
      const startDate = `${month}-01`;
      const date = toUtcDate(startDate);
      const incomeCents = toCents(income);
      const expenseCents = toCents(expenses);

      return {
        key: month,
        axisLabel: shortMonthFormatter.format(date),
        tooltipLabel: longMonthFormatter.format(date),
        startDate,
        endDate: getMonthEndDate(month),
        incomeCents,
        expenseCents,
        balanceCents: incomeCents - expenseCents
      };
    });
}

function createAllIntervals(): FinancialInterval[] {
  const intervalsByYear = new Map<number, FinancialInterval>();

  mockStatisticsMonthlyTotals.forEach(({ month, income, expenses }) => {
    const year = Number(month.slice(0, 4));
    const incomeCents = toCents(income);
    const expenseCents = toCents(expenses);
    const existingInterval = intervalsByYear.get(year);

    if (existingInterval) {
      existingInterval.endDate = getMonthEndDate(month);
      existingInterval.incomeCents += incomeCents;
      existingInterval.expenseCents += expenseCents;
      existingInterval.balanceCents += incomeCents - expenseCents;
      return;
    }

    intervalsByYear.set(year, {
      key: String(year),
      axisLabel: String(year),
      tooltipLabel: String(year),
      startDate: `${month}-01`,
      endDate: getMonthEndDate(month),
      incomeCents,
      expenseCents,
      balanceCents: incomeCents - expenseCents
    });
  });

  return [...intervalsByYear.values()];
}

export function getFinancialIntervals(
  mode: AggregateChartMode,
  selectedYear: number
) {
  return mode === "YEAR"
    ? createYearIntervals(selectedYear)
    : createAllIntervals();
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
