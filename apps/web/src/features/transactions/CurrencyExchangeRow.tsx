import { ArrowLeft, ArrowRight } from "lucide-react";

import { parseLocalDateOnly } from "../../dates/date-only";
import { formatMoneyAmount } from "../../money/format-euro";
import type {
  CurrencyCode,
  CurrencyExchangeListItem
} from "../currency/currency-api";

type CurrencyExchangeRowProps = {
  exchange: CurrencyExchangeListItem;
};

function formatExchangeDate(value: string) {
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

function formatCurrencyAmount(
  amount: string,
  currency: CurrencyCode
) {
  return formatMoneyAmount(amount, { currency });
}

export function CurrencyExchangeRow({ exchange }: CurrencyExchangeRowProps) {
  const Icon = exchange.toCurrency === "USD" ? ArrowRight : ArrowLeft;

  return (
    <li className="transaction-row currency-exchange-row">
      <div className="transaction-row__content currency-exchange-row__content">
        <span
          className="transaction-row__icon currency-exchange-row__icon"
          aria-hidden="true"
        >
          <Icon />
        </span>
        <span className="transaction-row__details currency-exchange-row__details">
          <strong>Currency exchange</strong>
          <span>
            {formatCurrencyAmount(
              exchange.fromAmount,
              exchange.fromCurrency
            )}{" "}
            &middot; {formatExchangeDate(exchange.date)}
          </span>
        </span>
        <span className="transaction-row__amount currency-exchange-row__amount">
          {formatCurrencyAmount(exchange.toAmount, exchange.toCurrency)}
        </span>
      </div>
    </li>
  );
}
