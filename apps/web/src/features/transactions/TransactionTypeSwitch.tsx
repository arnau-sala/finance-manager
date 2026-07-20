import {
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight
} from "lucide-react";

import {
  SlidingSegmentedControl,
  type SlidingSegmentOption
} from "../../components/ui/SlidingSegmentedControl";
import { type TransactionType } from "./category-catalog";

export type TransactionTypeSelection = "ALL" | TransactionType;

type TransactionTypeSwitchProps = {
  value: TransactionTypeSelection;
  onChange: (value: TransactionTypeSelection) => void;
  includeAll?: boolean;
  compact?: boolean;
  disabled?: boolean;
  label?: string;
};

const TRANSACTION_TYPE_OPTIONS: readonly SlidingSegmentOption<TransactionTypeSelection>[] = [
  { value: "EXPENSE", label: "Expense", icon: ArrowDownRight },
  { value: "INCOME", label: "Income", icon: ArrowUpRight }
];
const FILTER_TYPE_OPTIONS: readonly SlidingSegmentOption<TransactionTypeSelection>[] = [
  { value: "ALL", label: "All", icon: ArrowRightLeft },
  ...TRANSACTION_TYPE_OPTIONS
];

export function TransactionTypeSwitch({
  value,
  onChange,
  includeAll = false,
  compact = false,
  disabled = false,
  label = "Transaction type"
}: TransactionTypeSwitchProps) {
  const tone =
    value === "EXPENSE" ? "expense" : value === "INCOME" ? "income" : "primary";

  return (
    <SlidingSegmentedControl
      value={value}
      options={includeAll ? FILTER_TYPE_OPTIONS : TRANSACTION_TYPE_OPTIONS}
      onChange={onChange}
      label={label}
      className="transaction-type-switch"
      tone={tone}
      compact={compact}
      disabled={disabled}
    />
  );
}
