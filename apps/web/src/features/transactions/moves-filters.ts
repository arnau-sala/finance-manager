import { transactionCategories, type TransactionType } from "./category-catalog";

export type MovesTypeFilter = "ALL" | TransactionType;
export type MovesFilterValueMode = "EXACT" | "RANGE";

export type MovesFilters = {
  type: MovesTypeFilter;
  amountMode: MovesFilterValueMode;
  exactAmount: string;
  minimumAmount: string;
  maximumAmount: string;
  dateMode: MovesFilterValueMode;
  exactDate: string;
  startDate: string;
  endDate: string;
  selectedCategoryIds: string[];
};

export function createEmptyMovesFilters(): MovesFilters {
  return {
    type: "ALL",
    amountMode: "RANGE",
    exactAmount: "",
    minimumAmount: "",
    maximumAmount: "",
    dateMode: "RANGE",
    exactDate: "",
    startDate: "",
    endDate: "",
    selectedCategoryIds: []
  };
}

export function getActiveCategoryIds(filters: MovesFilters) {
  if (filters.type === "ALL") {
    return filters.selectedCategoryIds;
  }

  return filters.selectedCategoryIds.filter(
    (categoryId) =>
      transactionCategories.find((category) => category.id === categoryId)
        ?.type === filters.type
  );
}

export function countActiveMovesFilters(filters: MovesFilters) {
  const hasAmountFilter =
    filters.amountMode === "EXACT"
      ? filters.exactAmount.length > 0
      : filters.minimumAmount.length > 0 || filters.maximumAmount.length > 0;
  const hasDateFilter =
    filters.dateMode === "EXACT"
      ? filters.exactDate.length > 0
      : filters.startDate.length > 0 || filters.endDate.length > 0;

  return [
    filters.type !== "ALL",
    hasAmountFilter,
    hasDateFilter,
    getActiveCategoryIds(filters).length > 0
  ].filter(Boolean).length;
}

export function haveEqualMovesFilters(left: MovesFilters, right: MovesFilters) {
  const leftCategoryIds = [...left.selectedCategoryIds].sort();
  const rightCategoryIds = [...right.selectedCategoryIds].sort();

  return (
    left.type === right.type &&
    left.amountMode === right.amountMode &&
    left.exactAmount === right.exactAmount &&
    left.minimumAmount === right.minimumAmount &&
    left.maximumAmount === right.maximumAmount &&
    left.dateMode === right.dateMode &&
    left.exactDate === right.exactDate &&
    left.startDate === right.startDate &&
    left.endDate === right.endDate &&
    leftCategoryIds.length === rightCategoryIds.length &&
    leftCategoryIds.every(
      (categoryId, index) => categoryId === rightCategoryIds[index]
    )
  );
}
