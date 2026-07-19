export type DateOnlyRange = {
  from: string;
  to: string;
};

function padDatePart(value: number) {
  return value.toString().padStart(2, "0");
}

export function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function getTodayDateOnly(now = new Date()) {
  return `${now.getFullYear()}-${padDatePart(now.getMonth() + 1)}-${padDatePart(
    now.getDate()
  )}`;
}

export function getMonthDateOnlyRange(
  month: number,
  year: number
): DateOnlyRange {
  return {
    from: formatDateOnly(new Date(Date.UTC(year, month - 1, 1))),
    to: formatDateOnly(new Date(Date.UTC(year, month, 1)))
  };
}

export function getYearDateOnlyRange(year: number): DateOnlyRange {
  return {
    from: `${year}-01-01`,
    to: `${year + 1}-01-01`
  };
}
