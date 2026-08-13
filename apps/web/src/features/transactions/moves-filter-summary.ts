import { parseLocalDateOnly } from "../../dates/date-only";
import { formatEuroInputAmount } from "../../money/format-euro";
import { transactionCategories } from "./category-catalog";
import {
  getActiveCategoryIds,
  type MovesFilters
} from "./moves-filters";

function formatAmountValue(value: string) {
  return formatEuroInputAmount(value);
}

export function formatFilterDateValue(value: string) {
  const date = parseLocalDateOnly(value);

  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric"
  }).format(date);
}

function formatCompactDayMonth(value: string) {
  const date = parseLocalDateOnly(value);

  if (!date) {
    return value;
  }

  return `${date.getDate()}/${date.getMonth() + 1}`;
}

function formatCompactMonthYear(value: string) {
  const date = parseLocalDateOnly(value);

  if (!date) {
    return value;
  }

  return `${date.getMonth() + 1}/${String(date.getFullYear()).slice(-2)}'`;
}

export function getAmountFilterSummary(filters: MovesFilters) {
  if (filters.amountMode === "EXACT") {
    return filters.exactAmount
      ? formatAmountValue(filters.exactAmount)
      : null;
  }

  if (filters.minimumAmount && filters.maximumAmount) {
    return `${formatAmountValue(filters.minimumAmount)} - ${formatAmountValue(
      filters.maximumAmount
    )}`;
  }

  if (filters.minimumAmount) {
    return `From ${formatAmountValue(filters.minimumAmount)}`;
  }

  return filters.maximumAmount
    ? `Up to ${formatAmountValue(filters.maximumAmount)}`
    : null;
}

export function getDateFilterSummary(filters: MovesFilters) {
  if (filters.dateMode === "EXACT") {
    return filters.exactDate
      ? formatFilterDateValue(filters.exactDate)
      : null;
  }

  const currentYear = new Date().getFullYear();
  const useMonthYearRangeFormat = [
    filters.startDate,
    filters.endDate
  ].some((value) => {
    const date = parseLocalDateOnly(value);
    return date !== null && date.getFullYear() !== currentYear;
  });
  const formatRangeDate = useMonthYearRangeFormat
    ? formatCompactMonthYear
    : formatCompactDayMonth;

  if (filters.startDate && filters.endDate) {
    return `${formatRangeDate(filters.startDate)} - ${formatRangeDate(
      filters.endDate
    )}`;
  }

  if (filters.startDate) {
    return `Start ${formatRangeDate(filters.startDate)}`;
  }

  return filters.endDate
    ? `End ${formatRangeDate(filters.endDate)}`
    : null;
}

export function getCategoryFilterSummary(filters: MovesFilters) {
  const categoryIds = getActiveCategoryIds(filters);

  if (categoryIds.length === 0) {
    return null;
  }

  if (categoryIds.length === 1) {
    return (
      transactionCategories.find((category) => category.id === categoryIds[0])
        ?.name ?? "1 selected"
    );
  }

  return `${categoryIds.length} selected`;
}
