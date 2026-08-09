import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import type { SlidingSegmentOption } from "../../components/ui/SlidingSegmentedControl";
import type { TransactionType } from "../transactions/category-catalog";
import {
  hasCategoryTypeData,
  type CategoryBreakdownItem
} from "./statistics-categories";

type TypedCategoryBreakdownItem = CategoryBreakdownItem & {
  type: TransactionType;
};

export function createCategoryTypeOptions(
  categories: readonly TypedCategoryBreakdownItem[]
): readonly SlidingSegmentOption<TransactionType>[] {
  const hasIncomeData = hasCategoryTypeData(categories, "INCOME");
  const hasExpenseData = hasCategoryTypeData(categories, "EXPENSE");

  return [
    {
      value: "INCOME",
      label: hasIncomeData ? "Income" : "No income",
      icon: ArrowUpRight,
      disabled: !hasIncomeData
    },
    {
      value: "EXPENSE",
      label: hasExpenseData ? "Expenses" : "No expenses",
      icon: ArrowDownRight,
      disabled: !hasExpenseData
    }
  ];
}
