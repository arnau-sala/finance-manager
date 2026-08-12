import { describe, expect, it } from "vitest";

import {
  getDefaultCategoryType,
  getVisibleCategoryBreakdown,
  hasCategoryTypeData,
} from "../src/features/statistics/statistics-categories";
import { createCategoryTypeOptions } from "../src/features/statistics/statistics-category-switch";
import {
  createFinancialIntervals,
  formatFinancialIntervalRange,
} from "../src/features/statistics/charts/statistics-chart-periods";

const categories = [
  {
    id: "income-salary",
    name: "Salary",
    type: "INCOME" as const,
    amount: 2500,
    percentage: 100,
    transactionCount: 1,
    averageAmount: 2500,
  },
  {
    id: "expense-housing",
    name: "Housing",
    type: "EXPENSE" as const,
    amount: 900,
    percentage: 90,
    transactionCount: 1,
    averageAmount: 900,
  },
];

describe("statistics categories", () => {
  it("prefers income when both types contain data", () => {
    expect(hasCategoryTypeData(categories, "INCOME")).toBe(true);
    expect(hasCategoryTypeData(categories, "EXPENSE")).toBe(true);
    expect(getDefaultCategoryType(categories)).toBe("INCOME");
  });

  it("falls back to expenses and disables empty switch options", () => {
    const expenseOnly = categories.filter((category) => category.type === "EXPENSE");
    expect(getDefaultCategoryType(expenseOnly)).toBe("EXPENSE");
    const options = createCategoryTypeOptions(expenseOnly);
    expect(options[0]).toMatchObject({ label: "No income", disabled: true });
    expect(options[1]).toMatchObject({ label: "Expenses", disabled: false });
  });

  it("groups categories below one percent into Other", () => {
    const result = getVisibleCategoryBreakdown(
      [
        { id: "large", name: "Large", amount: 995, percentage: 0, transactionCount: 2, averageAmount: 497.5 },
        { id: "tiny", name: "Tiny", amount: 4, percentage: 0, transactionCount: 2, averageAmount: 2 },
        { id: "income-other", name: "Other", amount: 1, percentage: 0, transactionCount: 1, averageAmount: 1 },
      ],
      "INCOME",
    );
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("large");
    expect(result[1]).toMatchObject({
      id: "income-other",
      amount: 5,
      transactionCount: 3,
      averageAmount: 5 / 3,
    });
  });

  it("returns an ordered copy and handles empty totals", () => {
    expect(getVisibleCategoryBreakdown([], "EXPENSE")).toEqual([]);
    expect(
      getVisibleCategoryBreakdown(
        [
          { id: "a", name: "A", amount: 20, percentage: 20, transactionCount: 1, averageAmount: 20 },
          { id: "b", name: "B", amount: 80, percentage: 80, transactionCount: 1, averageAmount: 80 },
        ],
        "EXPENSE",
      ).map((item) => item.id),
    ).toEqual(["b", "a"]);
  });
});

describe("statistics chart periods", () => {
  it("converts yearly intervals to labels and integer cents", () => {
    const result = createFinancialIntervals("YEAR", [
      {
        key: "2026-01",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        income: 10.505,
        expenses: 2.2,
        balance: 8.305,
      },
    ]);
    expect(result[0]).toMatchObject({
      axisLabel: "Jan",
      tooltipLabel: "January 2026",
      incomeCents: 1051,
      expenseCents: 220,
      balanceCents: 831,
    });
  });

  it("keeps year labels for all-time data and formats the full range", () => {
    const intervals = createFinancialIntervals("ALL", [
      { key: "2025", startDate: "2025-01-01", endDate: "2025-12-31", income: 1, expenses: 2, balance: -1 },
      { key: "2026", startDate: "2026-01-01", endDate: "2026-08-12", income: 3, expenses: 1, balance: 2 },
    ]);
    expect(intervals.map((item) => item.axisLabel)).toEqual(["2025", "2026"]);
    expect(formatFinancialIntervalRange(intervals)).toBe("1 Jan 2025 - 12 Aug 2026");
    expect(formatFinancialIntervalRange([])).toBe("");
  });
});
