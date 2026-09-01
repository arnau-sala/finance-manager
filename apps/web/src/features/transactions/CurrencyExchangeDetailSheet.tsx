import { useEffect, useId, useRef } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { createPortal } from "react-dom";

import { ActionButton } from "../../components/ui/ActionButton";
import { parseLocalDateOnly } from "../../dates/date-only";
import { formatMoneyAmount } from "../../money/format-euro";
import type {
  CurrencyCode,
  CurrencyExchangeListItem
} from "../currency/currency-api";

type CurrencyExchangeDetailSheetProps = {
  exchange: CurrencyExchangeListItem | null;
  exchanges: CurrencyExchangeListItem[];
  onClose: () => void;
};

function formatFullDate(value: string) {
  const date = parseLocalDateOnly(value);

  if (!date) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatPeriodImpact(value: number) {
  if (value > 0 && value < 1) {
    return `${value.toLocaleString("es-ES", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    })}%`;
  }

  return `${Math.round(value).toLocaleString("es-ES")}%`;
}

function decimalAmountToMinorUnits(amount: string) {
  const trimmedAmount = amount.trim();
  const sign = trimmedAmount.startsWith("-") ? -1 : 1;
  const unsignedAmount = trimmedAmount.replace(/^-/, "");
  const [wholePart = "0", decimalPart = ""] = unsignedAmount.split(".");
  const wholeUnits = Number.parseInt(wholePart, 10);
  const decimalUnits = Number.parseInt(
    decimalPart.padEnd(2, "0").slice(0, 2),
    10
  );

  if (!Number.isFinite(wholeUnits) || !Number.isFinite(decimalUnits)) {
    return 0;
  }

  return sign * (wholeUnits * 100 + decimalUnits);
}

function formatCurrencyAmount(amount: string, currency: CurrencyCode) {
  return formatMoneyAmount(amount, { currency });
}

function formatDirection(exchange: CurrencyExchangeListItem) {
  return `${exchange.fromCurrency} to ${exchange.toCurrency}`;
}

function formatDirectionDetail(exchange: CurrencyExchangeListItem) {
  return `${exchange.fromCurrency} to ${exchange.toCurrency}`;
}

function formatRateDecimal(value: string | number) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "unavailable";
  }

  const formattedValue = numericValue.toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
    useGrouping: false
  });

  if (!formattedValue.includes(",")) {
    return formattedValue;
  }

  return formattedValue.replace(/0+$/, "").replace(/,$/, "");
}

function getRateLabels(exchange: CurrencyExchangeListItem) {
  const basePerUsd = Number(exchange.exchangeRateBasePerUsd);
  const usdToEur = `1$ = ${formatRateDecimal(
    exchange.exchangeRateBasePerUsd
  )}\u20ac`;
  const eurToUsd = `1\u20ac = ${formatRateDecimal(1 / basePerUsd)}$`;

  return exchange.fromCurrency === "USD"
    ? [usdToEur, eurToUsd]
    : [eurToUsd, usdToEur];
}

function compareExchangeRank(
  left: CurrencyExchangeListItem,
  right: CurrencyExchangeListItem
) {
  const amountComparison =
    decimalAmountToMinorUnits(right.toAmount) -
    decimalAmountToMinorUnits(left.toAmount);

  if (amountComparison !== 0) {
    return amountComparison;
  }

  const dateComparison = right.date.localeCompare(left.date);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  const createdAtComparison = right.createdAt.localeCompare(left.createdAt);

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return left.id.localeCompare(right.id);
}

function getExchangeContext(
  exchange: CurrencyExchangeListItem,
  exchanges: CurrencyExchangeListItem[]
) {
  const matchingExchanges = exchanges.filter(
    (item) =>
      item.fromCurrency === exchange.fromCurrency &&
      item.toCurrency === exchange.toCurrency
  );
  const directionExchanges = matchingExchanges.some(
    (item) => item.id === exchange.id
  )
    ? matchingExchanges
    : [...matchingExchanges, exchange];
  const rankedExchanges = [...directionExchanges].sort(compareExchangeRank);
  const rank =
    rankedExchanges.findIndex((item) => item.id === exchange.id) + 1 || 1;
  const exchangeAmount = decimalAmountToMinorUnits(exchange.toAmount);
  const totalAmount = directionExchanges.reduce(
    (sum, item) => sum + decimalAmountToMinorUnits(item.toAmount),
    0
  );

  return {
    rank,
    total: directionExchanges.length,
    impact: totalAmount > 0 ? (exchangeAmount / totalAmount) * 100 : 0
  };
}

export function CurrencyExchangeDetailSheet({
  exchange,
  exchanges,
  onClose
}: CurrencyExchangeDetailSheetProps) {
  const titleId = useId();
  const dateId = useId();
  const renderedExchangeRef = useRef<CurrencyExchangeListItem | null>(null);
  const open = exchange !== null;

  if (exchange) {
    renderedExchangeRef.current = exchange;
  }

  const displayedExchange = exchange ?? renderedExchangeRef.current;

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [onClose, open]);

  const Icon = displayedExchange?.toCurrency === "USD" ? ArrowRight : ArrowLeft;
  const [primaryRate, secondaryRate] = displayedExchange
    ? getRateLabels(displayedExchange)
    : ["", ""];
  const context = displayedExchange
    ? getExchangeContext(displayedExchange, exchanges)
    : null;
  const direction = displayedExchange ? formatDirection(displayedExchange) : "";
  const directionDetail = displayedExchange
    ? formatDirectionDetail(displayedExchange)
    : "";

  return createPortal(
    <div
      className={`transaction-detail-backdrop${open ? " is-open" : ""}`}
      aria-hidden={!open}
      inert={!open}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <article
        className="transaction-detail-sheet transaction-detail-sheet--exchange currency-exchange-detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={displayedExchange ? dateId : undefined}
        tabIndex={-1}
      >
        <div className="transaction-detail-sheet__drag-region" aria-hidden="true">
          <span />
        </div>

        <div className="transaction-detail-sheet__toolbar">
          <span aria-hidden="true" />
          <ActionButton
            shape="icon"
            type="button"
            className="transaction-detail-sheet__close"
            aria-label="Close exchange details"
            title="Close"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </ActionButton>
        </div>

        <div className="transaction-detail-sheet__scroll-area">
          <div className="transaction-detail-sheet__content">
            {displayedExchange && context ? (
              <>
                <header className="transaction-detail-hero currency-exchange-detail-hero">
                  <span
                    className="transaction-detail-hero__icon currency-exchange-detail-hero__icon"
                    aria-hidden="true"
                  >
                    <Icon />
                  </span>
                  <p>Exchange &middot; {direction}</p>
                  <h2 id={titleId}>Currency exchange</h2>
                  <strong>
                    {formatCurrencyAmount(
                      displayedExchange.toAmount,
                      displayedExchange.toCurrency
                    )}
                  </strong>
                  <span className="currency-exchange-detail-hero__from">
                    {formatCurrencyAmount(
                      displayedExchange.fromAmount,
                      displayedExchange.fromCurrency
                    )}
                  </span>
                  <time id={dateId} dateTime={displayedExchange.date}>
                    {formatFullDate(displayedExchange.date)}
                  </time>
                </header>

                <section
                  className="transaction-detail-section"
                  aria-label="Exchange rates"
                >
                  <div className="currency-exchange-rates">
                    <span>
                      <small>Exchange rate</small>
                      <strong>{primaryRate}</strong>
                    </span>
                    <span>
                      <small>Reverse</small>
                      <strong>{secondaryRate}</strong>
                    </span>
                  </div>
                </section>

                <section
                  className="transaction-detail-section transaction-detail-context currency-exchange-detail-context"
                  aria-labelledby="currency-exchange-context-title"
                >
                  <div className="transaction-detail-section__heading">
                    <h3 id="currency-exchange-context-title">Context</h3>
                    <span>All time</span>
                  </div>

                  <dl className="transaction-detail-context__rows">
                    <div>
                      <dt>
                        Category rank
                        <span>
                          Among {context.total} exchanges from {directionDetail}
                        </span>
                      </dt>
                      <dd>#{context.rank}</dd>
                    </div>
                    <div>
                      <dt>
                        Period impact
                        <span>
                          Among {context.total} exchanges from {directionDetail}
                        </span>
                      </dt>
                      <dd>{formatPeriodImpact(context.impact)}</dd>
                    </div>
                  </dl>
                </section>
              </>
            ) : (
              <h2 id={titleId} className="sr-only">
                Currency exchange
              </h2>
            )}
          </div>
        </div>
      </article>
    </div>,
    document.body
  );
}
