import { ArrowLeftRight } from "lucide-react";

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

function formatExchangeRate(value: string) {
  const rate = Number(value);

  if (!Number.isFinite(rate) || rate <= 0) {
    return "Rate unavailable";
  }

  return rate
    .toFixed(6)
    .replace(/(?:\.0+|(\.\d*?)0+)$/, "$1")
    .replace(".", ",");
}

export function CurrencyExchangeRow({ exchange }: CurrencyExchangeRowProps) {
  return (
    <li className="transaction-row currency-exchange-row">
      <div className="transaction-row__content currency-exchange-row__content">
        <span
          className="transaction-row__icon currency-exchange-row__icon"
          aria-hidden="true"
        >
          <ArrowLeftRight />
        </span>
        <span className="transaction-row__details currency-exchange-row__details">
          <strong>Currency exchange</strong>
          <span>
            {formatCurrencyAmount(
              exchange.fromAmount,
              exchange.fromCurrency
            )}{" "}
            to{" "}
            {formatCurrencyAmount(exchange.toAmount, exchange.toCurrency)}{" "}
            &middot; {formatExchangeDate(exchange.date)}
          </span>
        </span>
        <span className="currency-exchange-row__rate">
          1$ = {formatExchangeRate(exchange.exchangeRateBasePerUsd)}
          {"\u20ac"}
        </span>
      </div>
    </li>
  );
}
