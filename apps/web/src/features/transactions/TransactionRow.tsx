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
};

function formatTransactionAmount(
  amount: TransactionRowData["amount"],
  type: TransactionType
) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return "--";
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

export function TransactionRow({
  type,
  categoryId,
  categoryName,
  amount,
  description,
  date
}: TransactionRowData) {
  const Icon = getCategoryIcon(categoryId, type);

  return (
    <li className="transaction-row">
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
    </li>
  );
}
