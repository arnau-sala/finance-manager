import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Ellipsis,
  Pencil,
  Share,
  Trash2,
  X
} from "lucide-react";
import { createPortal } from "react-dom";

import { ActionButton } from "../../components/ui/ActionButton";
import { formatErrorMessage } from "../../components/ui/error-message";
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

const ACTIONS_ANIMATION_MS = 220;

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

function formatShareDate(value: string) {
  const date = parseLocalDateOnly(value);

  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
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

function formatFixedRateDecimal(value: string | number, fractionDigits: number) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "unavailable";
  }

  return numericValue.toLocaleString("es-ES", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: false
  });
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

function getShareRateLabel(exchange: CurrencyExchangeListItem) {
  const basePerUsd = Number(exchange.exchangeRateBasePerUsd);
  const usdToEur = `1$ = ${formatFixedRateDecimal(
    exchange.exchangeRateBasePerUsd,
    4
  )}\u20ac`;
  const eurToUsd = `1\u20ac = ${formatFixedRateDecimal(1 / basePerUsd, 4)}$`;

  return exchange.fromCurrency === "USD"
    ? `${usdToEur} | ${eurToUsd}`
    : `${eurToUsd} | ${usdToEur}`;
}

function buildCurrencyExchangeShareText(exchange: CurrencyExchangeListItem) {
  const directionPrefix = exchange.fromCurrency === "EUR" ? "\u27a1\ufe0f" : "\u2b05\ufe0f";
  const amountPrefix = exchange.fromCurrency === "EUR" ? "\ud83d\udcb5" : "\ud83d\udcb6";

  return [
    "\ud83d\udcb1 Exchange",
    `${directionPrefix} ${exchange.fromCurrency} to ${exchange.toCurrency}`,
    "",
    `${amountPrefix} ${formatCurrencyAmount(
      exchange.fromAmount,
      exchange.fromCurrency
    )} to ${formatCurrencyAmount(exchange.toAmount, exchange.toCurrency)}`,
    `\ud83d\udcc8 ${getShareRateLabel(exchange)}`,
    "",
    `\ud83d\udcc5 ${formatShareDate(exchange.date)}`
  ].join("\n");
}

async function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.append(textArea);
  textArea.select();

  const copied = document.execCommand("copy");
  textArea.remove();

  if (!copied) {
    throw new Error("Clipboard access is unavailable");
  }
}

async function shareCurrencyExchange(exchange: CurrencyExchangeListItem) {
  const text = buildCurrencyExchangeShareText(exchange);

  if (typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: "Finance Manager",
        text
      });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }

  await copyText(text);
  return "copied";
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
  const shareNoticeTimerRef = useRef<number | null>(null);
  const open = exchange !== null;
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsRendered, setActionsRendered] = useState(false);
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const [actionsInteractive, setActionsInteractive] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  if (exchange) {
    renderedExchangeRef.current = exchange;
  }

  const displayedExchange = exchange ?? renderedExchangeRef.current;

  useEffect(() => {
    if (!open) {
      setActionsOpen(false);
      setIsSharing(false);
      setShareNotice(null);
      return;
    }

    setActionsOpen(false);
    setIsSharing(false);
    setShareNotice(null);

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", closeWithEscape);
    return () => {
      window.removeEventListener("keydown", closeWithEscape);

      if (shareNoticeTimerRef.current !== null) {
        window.clearTimeout(shareNoticeTimerRef.current);
        shareNoticeTimerRef.current = null;
      }
    };
  }, [exchange?.id, onClose, open]);

  useEffect(() => {
    setActionsInteractive(false);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (actionsOpen) {
      setActionsRendered(true);

      if (reduceMotion) {
        setActionsExpanded(true);
        setActionsInteractive(true);
        return;
      }

      const expansionFrame = requestAnimationFrame(() => {
        setActionsExpanded(true);
      });
      const interactionTimer = window.setTimeout(() => {
        setActionsInteractive(true);
      }, ACTIONS_ANIMATION_MS);

      return () => {
        cancelAnimationFrame(expansionFrame);
        window.clearTimeout(interactionTimer);
      };
    }

    setActionsExpanded(false);

    if (!actionsRendered) {
      return;
    }

    if (reduceMotion) {
      setActionsRendered(false);
      return;
    }

    const unmountTimer = window.setTimeout(() => {
      setActionsRendered(false);
    }, ACTIONS_ANIMATION_MS);

    return () => window.clearTimeout(unmountTimer);
  }, [actionsOpen, actionsRendered]);

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

  function showShareNotice(kind: "success" | "error", message: string) {
    if (shareNoticeTimerRef.current !== null) {
      window.clearTimeout(shareNoticeTimerRef.current);
      shareNoticeTimerRef.current = null;
    }

    setShareNotice({ kind, message });
    shareNoticeTimerRef.current = window.setTimeout(() => {
      setShareNotice(null);
      shareNoticeTimerRef.current = null;
    }, 2800);
  }

  async function shareDisplayedExchange() {
    if (!displayedExchange || isSharing) {
      return;
    }

    setIsSharing(true);

    try {
      const result = await shareCurrencyExchange(displayedExchange);

      if (result === "shared" || result === "copied") {
        setActionsOpen(false);
      }

      if (result === "copied") {
        showShareNotice("success", "Exchange copied to clipboard");
      }
    } catch {
      setActionsOpen(false);
      showShareNotice(
        "error",
        "Unable to share this exchange\nPlease try again"
      );
    } finally {
      setIsSharing(false);
    }
  }

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
          <div className="transaction-detail-sheet__more">
            <ActionButton
              shape="icon"
              type="button"
              className="transaction-detail-sheet__action-button"
              aria-label="More exchange actions"
              aria-haspopup="menu"
              aria-expanded={actionsOpen}
              title="More"
              disabled={isSharing}
              onClick={() => {
                setActionsOpen((current) => !current);
              }}
            >
              <Ellipsis aria-hidden="true" />
            </ActionButton>

            {actionsRendered ? (
              <div
                className={`transaction-detail-sheet__action-menu${
                  actionsExpanded ? " is-open" : ""
                }${actionsInteractive ? " is-interactive" : ""}`}
                role="menu"
                aria-label="Exchange actions"
              >
                <ActionButton
                  shape="icon"
                  type="button"
                  className="transaction-detail-sheet__floating-action transaction-detail-sheet__floating-action--share"
                  role="menuitem"
                  aria-label="Share exchange"
                  title="Share"
                  disabled={!actionsInteractive || isSharing}
                  onClick={shareDisplayedExchange}
                >
                  <Share aria-hidden="true" />
                </ActionButton>
                <ActionButton
                  shape="icon"
                  type="button"
                  className="transaction-detail-sheet__floating-action transaction-detail-sheet__floating-action--edit"
                  role="menuitem"
                  aria-label="Edit exchange"
                  title="Edit"
                  disabled={!actionsInteractive}
                  onClick={() => setActionsOpen(false)}
                >
                  <Pencil aria-hidden="true" />
                </ActionButton>
                <ActionButton
                  shape="icon"
                  type="button"
                  className="transaction-detail-sheet__floating-action transaction-detail-sheet__floating-action--delete"
                  role="menuitem"
                  aria-label="Delete exchange"
                  title="Delete"
                  disabled={!actionsInteractive}
                  onClick={() => setActionsOpen(false)}
                >
                  <Trash2 aria-hidden="true" />
                </ActionButton>
              </div>
            ) : null}
          </div>
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

        {shareNotice ? (
          <p
            className={`transaction-detail-sheet__share-notice transaction-detail-sheet__share-notice--${shareNotice.kind}`}
            role={shareNotice.kind === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {shareNotice.kind === "error"
              ? formatErrorMessage(shareNotice.message)
              : shareNotice.message}
          </p>
        ) : null}

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
