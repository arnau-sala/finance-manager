export type StatisticsPeriodMode = "MONTH" | "YEAR" | "ALL";

export type StatisticsPeriodSelection =
  | {
      mode: "MONTH";
      month: string;
    }
  | {
      mode: "YEAR";
      year: number;
    }
  | {
      mode: "ALL";
    };

export type ResolvedStatisticsPeriod = {
  mode: StatisticsPeriodMode;
  key: string;
  from: string;
  to: string;
  endDate: string;
};

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function shiftDate(date: string, days: number) {
  const shiftedDate = new Date(`${date}T00:00:00.000Z`);
  shiftedDate.setUTCDate(shiftedDate.getUTCDate() + days);
  return shiftedDate.toISOString().slice(0, 10);
}

function getNextMonth(month: string) {
  const [year = 0, monthNumber = 1] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
}

export function getNextDate(date: string) {
  return shiftDate(date, 1);
}

export function getPreviousDate(date: string) {
  return shiftDate(date, -1);
}

export function resolveStatisticsPeriod(
  selection: StatisticsPeriodSelection,
  today: string,
  firstTransactionDate: string | null
): ResolvedStatisticsPeriod {
  const tomorrow = getNextDate(today);

  if (selection.mode === "MONTH") {
    const naturalEnd = getNextMonth(selection.month);
    const to = naturalEnd < tomorrow ? naturalEnd : tomorrow;

    return {
      mode: selection.mode,
      key: selection.month,
      from: `${selection.month}-01`,
      to,
      endDate: getPreviousDate(to)
    };
  }

  if (selection.mode === "YEAR") {
    const naturalEnd = `${selection.year + 1}-01-01`;
    const to = naturalEnd < tomorrow ? naturalEnd : tomorrow;

    return {
      mode: selection.mode,
      key: String(selection.year),
      from: `${selection.year}-01-01`,
      to,
      endDate: getPreviousDate(to)
    };
  }

  const from = firstTransactionDate ?? today;

  return {
    mode: selection.mode,
    key: "all",
    from,
    to: tomorrow,
    endDate: today
  };
}

export function getMonthKeys(from: string, endDate: string) {
  const keys: string[] = [];
  const [startYear = 0, startMonth = 1] = from.split("-").map(Number);
  const [endYear = 0, endMonth = 1] = endDate.split("-").map(Number);
  const cursor = new Date(Date.UTC(startYear, startMonth - 1, 1));
  const end = Date.UTC(endYear, endMonth - 1, 1);

  while (cursor.getTime() <= end) {
    keys.push(
      `${cursor.getUTCFullYear()}-${padDatePart(cursor.getUTCMonth() + 1)}`
    );
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return keys;
}

export function getInclusiveDayCount(from: string, endDate: string) {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  return Math.max(0, Math.floor((end - start) / 86_400_000) + 1);
}

