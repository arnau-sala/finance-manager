import type { ReactNode } from "react";

import {
  transactionCategories,
  type TransactionType
} from "./category-catalog";

type TransactionCategoryPickerProps = {
  type: TransactionType;
  selectedCategoryIds: readonly string[];
  onCategorySelect: (categoryId: string) => void;
  legend?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  headerAction?: ReactNode;
};

export function TransactionCategoryPicker({
  type,
  selectedCategoryIds,
  onCategorySelect,
  legend = "Category",
  disabled = false,
  invalid = false,
  describedBy,
  headerAction
}: TransactionCategoryPickerProps) {
  const categories = transactionCategories.filter(
    (category) => category.type === type
  );

  return (
    <fieldset
      className="transaction-category-picker"
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
    >
      {headerAction ? (
        <>
          <legend className="sr-only">{legend}</legend>
          <div className="transaction-category-picker__heading">
            <span>{legend}</span>
            {headerAction}
          </div>
        </>
      ) : (
        <legend>{legend}</legend>
      )}
      <div className="transaction-category-grid">
        {categories.map((category) => {
          const Icon = category.icon;
          const isSelected = selectedCategoryIds.includes(category.id);

          return (
            <button
              key={category.id}
              className={`transaction-category-option${
                isSelected ? " is-selected" : ""
              }`}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onCategorySelect(category.id)}
            >
              <span
                className="transaction-category-option__icon"
                aria-hidden="true"
              >
                <Icon />
              </span>
              <span>{category.name}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
