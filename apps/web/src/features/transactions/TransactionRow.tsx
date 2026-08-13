import { forwardRef } from "react";

import { parseLocalDateOnly } from "../../dates/date-only";
import { formatEuroAmount } from "../../money/format-euro";
import { getCategoryIcon, type TransactionType } from "./category-catalog";

export type TransactionRowData = {
  type: TransactionType;
  categoryId: string;
  categoryName: string;
  amount: string | number;
  description: string;
  date: string;
  onSelect?: () => void;
};

function formatTransactionAmount(
  amount: TransactionRowData["amount"],
  type: TransactionType
) {
  const normalizedAmount =
    typeof amount === "string" ? amount.trim() : amount;
  const numericAmount =
    normalizedAmount === "" ? Number.NaN : Number(normalizedAmount);

  if (!Number.isFinite(numericAmount)) {
    return "Amount unavailable";
  }

  const signedAmount =
    type === "INCOME" ? Math.abs(numericAmount) : -Math.abs(numericAmount);

  return formatEuroAmount(signedAmount, { showSign: true });
}

function formatTransactionDate(value: string) {
  const date = parseLocalDateOnly(value);

  if (!date) {
    return "Date unavailable";
  }

  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (isToday) {
    return "Today";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric"
  }).format(date);
}

export const TransactionRow = forwardRef<HTMLLIElement, TransactionRowData>(
  function TransactionRow(
    {
      type,
      categoryId,
      categoryName,
      amount,
      description,
      date,
      onSelect
    },
    ref
  ) {
  const Icon = getCategoryIcon(categoryId, type);
  const content = (
    <>
      <span className="transaction-row__icon" aria-hidden="true">
        <Icon />
      </span>
      <span className="transaction-row__details">
        <strong>{description}</strong>
        <span>
          {categoryName} &middot; {formatTransactionDate(date)}
        </span>
      </span>
      <span
        className={`transaction-row__amount transaction-row__amount--${type.toLowerCase()}`}
      >
        {formatTransactionAmount(amount, type)}
      </span>
    </>
  );

  return (
    <li ref={ref} className="transaction-row">
      {onSelect ? (
        <button
          className="transaction-row__content"
          type="button"
          aria-label={`View ${description} transaction details`}
          onClick={onSelect}
        >
          {content}
        </button>
      ) : (
        <div className="transaction-row__content">{content}</div>
      )}
    </li>
  );
  }
);
