import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  countActiveMovesFilters,
  createEmptyMovesFilters,
  getActiveCategoryIds,
  haveEqualMovesFilters,
} from "../src/features/transactions/moves-filters";
import {
  formatFilterDateValue,
  getAmountFilterSummary,
  getCategoryFilterSummary,
  getDateFilterSummary,
} from "../src/features/transactions/moves-filter-summary";
import {
  buildTransactionShareText,
  shareTransaction,
} from "../src/features/transactions/transaction-share";
import { validateCreateTransaction } from "../src/features/transactions/transaction-validation";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { getCategoryIcon } from "../src/features/transactions/category-catalog";

describe("transaction filters", () => {
  it("starts empty and counts each active filter group once", () => {
    const empty = createEmptyMovesFilters();
    expect(countActiveMovesFilters(empty)).toBe(0);

    const active = {
      ...empty,
      type: "EXPENSE" as const,
      minimumAmount: "10",
      maximumAmount: "100",
      startDate: "2026-08-01",
      selectedCategoryIds: ["expense-dining", "income-salary"],
    };
    expect(getActiveCategoryIds(active)).toEqual(["expense-dining"]);
    expect(countActiveMovesFilters(active)).toBe(4);
  });

  it("does not treat selecting every visible category as a filter", () => {
    const filters = {
      ...createEmptyMovesFilters(),
      type: "INCOME" as const,
      selectedCategoryIds: [
        "income-allowance",
        "income-benefits",
        "income-freelance",
        "income-gifts",
        "income-investments",
        "income-salary",
        "income-sales",
        "income-other",
      ],
    };
    expect(getActiveCategoryIds(filters)).toEqual([]);
    expect(getCategoryFilterSummary(filters)).toBeNull();
  });

  it("compares filters independently of category order", () => {
    const left = {
      ...createEmptyMovesFilters(),
      selectedCategoryIds: ["expense-dining", "expense-health"],
    };
    const right = {
      ...left,
      selectedCategoryIds: ["expense-health", "expense-dining"],
    };
    expect(haveEqualMovesFilters(left, right)).toBe(true);
    expect(haveEqualMovesFilters(left, { ...right, exactAmount: "12" })).toBe(
      false,
    );
  });

  it("builds concise amount, date and category labels", () => {
    const base = createEmptyMovesFilters();
    expect(
      getAmountFilterSummary({ ...base, amountMode: "EXACT", exactAmount: "12.5" }),
    ).toBe("12,5€");
    expect(
      getAmountFilterSummary({
        ...base,
        amountMode: "EXACT",
        exactAmount: "1234.5",
      }),
    ).toBe("1\u202f234,5\u20ac");
    expect(
      getAmountFilterSummary({ ...base, minimumAmount: "10", maximumAmount: "20" }),
    ).toBe("10€ - 20€");
    expect(getAmountFilterSummary({ ...base, minimumAmount: "10" })).toBe(
      "From 10€",
    );
    expect(getAmountFilterSummary({ ...base, maximumAmount: "20" })).toBe(
      "Up to 20€",
    );
    expect(
      getDateFilterSummary({
        ...base,
        dateMode: "EXACT",
        exactDate: "2026-08-12",
      }),
    ).toBe(formatFilterDateValue("2026-08-12"));
    expect(
      getCategoryFilterSummary({
        ...base,
        selectedCategoryIds: ["expense-dining", "expense-health"],
      }),
    ).toBe("2 selected");
    expect(
      getCategoryFilterSummary({
        ...base,
        selectedCategoryIds: ["expense-dining"],
      }),
    ).toBe("Dining");
    expect(getDateFilterSummary({ ...base, startDate: "2026-08-01" })).toBe(
      "Start 1/8",
    );
    expect(getDateFilterSummary({ ...base, endDate: "2025-12-31" })).toBe(
      "End 12/25'",
    );
  });

  it("provides category-specific and safe fallback icons", () => {
    expect(getCategoryIcon("expense-dining", "EXPENSE")).not.toBe(ArrowDownRight);
    expect(getCategoryIcon("missing", "EXPENSE")).toBe(ArrowDownRight);
    expect(getCategoryIcon(undefined, "INCOME")).toBe(ArrowUpRight);
  });
});

describe("transaction validation", () => {
  const validInput = {
    amount: "12,50",
    type: "EXPENSE" as const,
    description: "Lunch",
    categoryId: "expense-dining",
    date: "2026-08-12",
  };

  it("normalizes valid amounts for the API", () => {
    const result = validateCreateTransaction(validInput);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBe("12.50");
  });

  it.each([
    [{ ...validInput, amount: "0" }, "amount"],
    [{ ...validInput, amount: "12,345" }, "amount"],
    [{ ...validInput, description: "" }, "description"],
    [{ ...validInput, date: "not-a-date" }, "date"],
    [{ ...validInput, categoryId: "income-salary" }, "categoryId"],
  ])("rejects invalid transaction fields", (input, field) => {
    const result = validateCreateTransaction(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(
        true,
      );
    }
  });
});

describe("transaction sharing", () => {
  const transaction = {
    id: "tx-1",
    type: "EXPENSE" as const,
    categoryId: "expense-dining",
    category: { id: "expense-dining", name: "Dining", type: "EXPENSE" as const },
    amount: "18.50",
    description: "Dinner",
    date: "2026-08-12",
  };

  beforeEach(() => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("formats a readable signed expense", () => {
    const text = buildTransactionShareText(transaction);
    expect(text).toContain("Expense");
    expect(text).toContain("Dinner");
    expect(text).toContain("-18,50€");
    expect(text).toContain("Dining");
  });

  it("uses native share when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    await expect(shareTransaction(transaction)).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: "Finance Manager" }));
  });

  it("reports cancellation without copying", async () => {
    const error = new DOMException("cancelled", "AbortError");
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: vi.fn().mockRejectedValue(error),
    });
    await expect(shareTransaction(transaction)).resolves.toBe("cancelled");
  });

  it("falls back to the clipboard after a share failure", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error("unavailable")),
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    await expect(shareTransaction(transaction)).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledOnce();
  });
});
