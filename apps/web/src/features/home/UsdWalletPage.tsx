import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowUpFromLine,
  ChevronRight,
  ChevronLeft,
  DollarSign,
  Percent,
  Plus,
  ReceiptText,
  Wallet
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ActionButton } from "../../components/ui/ActionButton";
import { SkeletonBlock } from "../../components/ui/SkeletonBlock";
import { parseLocalDateOnly } from "../../dates/date-only";
import { formatEuroAmount, formatMoneyAmount } from "../../money/format-euro";
import {
  CurrencyApiError,
  currencyExchangesQueryOptions,
  usdWalletQueryOptions,
  type CurrencyExchangeListItem
} from "../currency/currency-api";
import { HomeApiError, homeOverviewQueryOptions } from "./home-api";
import { getCategoryIcon } from "../transactions/category-catalog";
import { CurrencyExchangeDetailSheet } from "../transactions/CurrencyExchangeDetailSheet";
import { CurrencyExchangeRow } from "../transactions/CurrencyExchangeRow";
import { createEmptyMovesFilters } from "../transactions/moves-filters";
import {
  createTransactionListRequest,
  TransactionApiError,
  transactionsQueryOptions,
  type TransactionListItem,
  type TransactionPreview
} from "../transactions/transaction-api";

type UsdWalletPageProps = {
  open: boolean;
  userId: string;
  onBack: () => void;
  onNewExchange: () => void;
  onExchangeEdit: (exchange: CurrencyExchangeListItem) => void;
  onExchangeDeleted: () => void;
  editingExchangeId: string | null;
  updatedExchange: CurrencyExchangeListItem | null;
  onTransactionSelect: (transaction: TransactionPreview) => void;
  onSessionExpired: () => void;
};

type UsdWalletHistoryFilter = "expense" | "income" | "exchange";

type UsdWalletHistoryFilters = Record<UsdWalletHistoryFilter, boolean>;

type UsdWalletInsightTone = "positive" | "negative" | "neutral" | "default";

type UsdWalletHistoryEntry =
  | {
      kind: "transaction";
      id: string;
      date: string;
      createdAt: string;
      transaction: TransactionListItem;
    }
  | {
      kind: "exchange";
      id: string;
      date: string;
      createdAt: string;
      exchange: CurrencyExchangeListItem;
    };

const usdTransactionFilters = {
  ...createEmptyMovesFilters(),
  type: "ALL" as const
};

const initialHistoryFilters: UsdWalletHistoryFilters = {
  expense: true,
  income: true,
  exchange: true
};

const historyFilterOptions = [
  {
    key: "expense",
    label: "Expense",
    icon: ArrowDownRight
  },
  {
    key: "income",
    label: "Income",
    icon: ArrowUpRight
  },
  {
    key: "exchange",
    label: "Exchange",
    icon: ArrowLeftRight
  }
] as const;

function getMonthKey(value: string) {
  return value.slice(0, 7);
}

function formatMonthLabel(value: string) {
  const date = parseLocalDateOnly(value);

  if (!date) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric"
  }).format(date);
}

function formatShortDate(value: string) {
  const date = parseLocalDateOnly(value);

  if (!date) {
    return "Date unavailable";
  }

  const today = new Date();

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric"
  }).format(date);
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

function minorUnitsToDecimalAmount(amount: number) {
  const sign = amount < 0 ? "-" : "";
  const absoluteAmount = Math.abs(amount);
  const wholeUnits = Math.floor(absoluteAmount / 100);
  const decimalUnits = String(absoluteAmount % 100).padStart(2, "0");

  return `${sign}${wholeUnits}.${decimalUnits}`;
}

function formatEntryCount(count: number) {
  return `${count} ${count === 1 ? "entry" : "entries"}`;
}

function formatHistoryEntryCount(
  count: number,
  filters: UsdWalletHistoryFilters
) {
  const activeFilter = historyFilterOptions.find(
    ({ key }) => filters[key]
  );
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  if (activeFilterCount !== 1 || !activeFilter) {
    return formatEntryCount(count);
  }

  const label = activeFilter.label.toLowerCase();

  return `${count} ${count === 1 ? label : `${label}s`}`;
}

function formatAverageRatePair(value: string | null) {
  const basePerUsd = Number(value);

  if (!Number.isFinite(basePerUsd) || basePerUsd <= 0) {
    return "Rate unavailable";
  }

  return {
    usdToEur: `1$ = ${formatRatio(basePerUsd)}${"\u20ac"}`,
    eurToUsd: `1${"\u20ac"} = ${formatRatio(1 / basePerUsd)}$`
  };
}

function formatRatio(value: number) {
  return value
    .toFixed(6)
    .replace(/(?:\.0+|(\.\d*?)0+)$/, "$1")
    .replace(".", ",");
}

function formatPercentageValue(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "No data";
  }

  const roundedValue =
    value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;

  return `${roundedValue.toString().replace(".", ",")}%`;
}

function getNetWorthShareValue(
  costBasisMinor: number,
  currentNetWorth: string | null
) {
  if (!currentNetWorth) {
    return null;
  }

  const netWorthMinor = decimalAmountToMinorUnits(currentNetWorth);

  if (netWorthMinor <= 0) {
    return null;
  }

  return (costBasisMinor / netWorthMinor) * 100;
}

function getRemainingFromExchangedUsd({
  exchangedInUsdMinor,
  exchangedOutUsdMinor,
  spentUsdMinor
}: {
  exchangedInUsdMinor: number;
  exchangedOutUsdMinor: number;
  spentUsdMinor: number;
}) {
  if (exchangedInUsdMinor <= 0) {
    return {
      amountMinor: null,
      percentage: null
    };
  }

  const remainingUsdMinor = Math.max(
    0,
    exchangedInUsdMinor - exchangedOutUsdMinor - spentUsdMinor
  );

  return {
    amountMinor: remainingUsdMinor,
    percentage: (remainingUsdMinor / exchangedInUsdMinor) * 100
  };
}

function getUsdOriginalAmount(transaction: TransactionListItem) {
  return transaction.currency === "USD"
    ? transaction.originalAmount ?? transaction.amount
    : transaction.amount;
}

function formatSignedUsdTransactionAmount(transaction: TransactionListItem) {
  const amount = getUsdOriginalAmount(transaction);
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return "Amount unavailable";
  }

  return formatMoneyAmount(
    transaction.type === "INCOME" ? Math.abs(value) : -Math.abs(value),
    {
      currency: "USD",
      showSign: true
    }
  );
}

function compareHistoryEntries(
  left: UsdWalletHistoryEntry,
  right: UsdWalletHistoryEntry
) {
  const dateComparison = right.date.localeCompare(left.date);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  const createdAtComparison = right.createdAt.localeCompare(left.createdAt);

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  if (left.kind !== right.kind) {
    return left.kind === "exchange" ? -1 : 1;
  }

  return left.id.localeCompare(right.id);
}

function UsdWalletSkeleton() {
  return (
    <div
      className="usd-wallet-content"
      aria-label="Loading USD wallet"
      aria-busy="true"
    >
      <section className="stats-money usd-wallet-money">
        <header className="stats-overview-section__header">
          <SkeletonBlock width={94} height={18} />
          <SkeletonBlock width={72} height={13} />
        </header>

        <div className="stats-money__content stats-money__content--skeleton">
          <div className="stats-money__balance">
            <SkeletonBlock width={94} height={13} />
            <SkeletonBlock width={146} height={34} radius={8} />
            <SkeletonBlock width={128} height={13} />
          </div>

          <div className="stats-money__breakdown">
            <div>
              <SkeletonBlock width={78} height={13} />
              <SkeletonBlock width={66} height={20} />
            </div>
            <div>
              <SkeletonBlock width={68} height={13} />
              <SkeletonBlock width={58} height={20} />
            </div>
          </div>
        </div>
      </section>

      <section className="usd-wallet-history-section">
        <header className="stats-chart-section__header usd-wallet-history-header">
          <div className="usd-wallet-history-heading">
            <SkeletonBlock width={92} height={18} />
            <SkeletonBlock width={48} height={12} />
          </div>
          <div className="stats-cash-flow__metrics usd-wallet-history-filters">
            {Array.from({ length: 3 }, (_, index) => (
              <SkeletonBlock width={30} height={30} radius={8} key={index} />
            ))}
          </div>
        </header>
        <ul className="moves-transaction-list usd-wallet-history-list">
          {Array.from({ length: 3 }, (_, index) => (
            <li className="transaction-row transaction-row--skeleton" key={index}>
              <div className="transaction-row__content">
                <SkeletonBlock width={36} height={36} radius="50%" />
                <span className="transaction-row-skeleton__details">
                  <SkeletonBlock width={118} height={14} />
                  <SkeletonBlock width={86} height={12} />
                </span>
                <SkeletonBlock width={68} height={16} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function UsdWalletError() {
  return (
    <div className="usd-wallet-empty-state usd-wallet-empty-state--error">
      <DollarSign aria-hidden="true" strokeWidth={1.7} />
      <strong>Unable to load USD wallet</strong>
      <span>Check your connection and try again</span>
    </div>
  );
}

function EmptyHistory({
  title,
  description,
  onNewExchange,
  showActions = false
}: {
  title: string;
  description: string;
  onNewExchange?: () => void;
  showActions?: boolean;
}) {
  return (
    <div className="first-transaction-empty usd-wallet-history-empty">
      <ReceiptText aria-hidden="true" strokeWidth={1.7} />
      <h2>{title}</h2>
      <p>{description}</p>
      {showActions ? (
        <div className="usd-wallet-history-empty__actions">
          <ActionButton
            className="home-new-transaction usd-wallet-history-empty__action"
            type="button"
            onClick={() => undefined}
          >
            <span className="home-new-transaction__icon" aria-hidden="true">
              <Plus />
            </span>
            <span>New transaction</span>
            <ChevronRight aria-hidden="true" />
          </ActionButton>
          <ActionButton
            className="home-new-transaction usd-wallet-history-empty__action usd-wallet-history-empty__action--secondary"
            type="button"
            onClick={onNewExchange}
          >
            <span className="home-new-transaction__icon" aria-hidden="true">
              <ArrowLeftRight />
            </span>
            <span>New exchange</span>
            <ChevronRight aria-hidden="true" />
          </ActionButton>
        </div>
      ) : null}
    </div>
  );
}

function UsdTransactionHistoryRow({
  transaction,
  onSelect
}: {
  transaction: TransactionListItem;
  onSelect?: () => void;
}) {
  const Icon = getCategoryIcon(transaction.categoryId, transaction.type);
  const content = (
    <>
      <span className="transaction-row__icon" aria-hidden="true">
        <Icon />
      </span>
      <span className="transaction-row__details">
        <strong>{transaction.description}</strong>
        <span>
          {transaction.category.name} &middot;{" "}
          {formatShortDate(transaction.date)}
        </span>
      </span>
      <strong
        className={`transaction-row__amount transaction-row__amount--${transaction.type.toLowerCase()}`}
      >
        {formatSignedUsdTransactionAmount(transaction)}
      </strong>
    </>
  );

  return (
    <li className="transaction-row usd-wallet-history-row">
      {onSelect ? (
        <button
          className="transaction-row__content"
          type="button"
          aria-label={`View ${transaction.description} transaction details`}
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

function UsdWalletInsightRow({
  icon: Icon,
  label,
  detail,
  value,
  tone = "default"
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  value: string;
  tone?: UsdWalletInsightTone;
}) {
  return (
    <li
      className={`stats-insight-row usd-wallet-insight-row${
        tone === "positive" ? " stats-insight-row--positive" : ""
      }${tone === "negative" ? " stats-insight-row--negative" : ""}${
        tone === "neutral" ? " usd-wallet-insight-row--neutral" : ""
      }`}
    >
      <span className="stats-insight-row__icon" aria-hidden="true">
        <Icon />
      </span>
      <span className="stats-insight-row__details">
        <strong>{label}</strong>
      </span>
      <span className="stats-insight-row__detail">{detail}</span>
      <strong className="stats-insight-row__value">{value}</strong>
    </li>
  );
}

export function UsdWalletPage({
  open,
  userId,
  onBack,
  onNewExchange,
  onExchangeEdit,
  onExchangeDeleted,
  editingExchangeId,
  updatedExchange,
  onTransactionSelect,
  onSessionExpired
}: UsdWalletPageProps) {
  const screenRef = useRef<HTMLElement>(null);
  const [historyFilters, setHistoryFilters] =
    useState<UsdWalletHistoryFilters>(initialHistoryFilters);
  const [selectedExchange, setSelectedExchange] =
    useState<CurrencyExchangeListItem | null>(null);
  const transactionRequest = useMemo(
    () =>
      createTransactionListRequest("", usdTransactionFilters, {
        currency: "USD"
      }),
    []
  );
  const walletQuery = useQuery({
    ...usdWalletQueryOptions(userId),
    enabled: open
  });
  const exchangesQuery = useQuery({
    ...currencyExchangesQueryOptions(userId),
    enabled: open
  });
  const overviewQuery = useQuery({
    ...homeOverviewQueryOptions(userId),
    enabled: open
  });
  const transactionsQuery = useInfiniteQuery({
    ...transactionsQueryOptions(userId, transactionRequest),
    enabled: open
  });
  const transactions = useMemo(
    () =>
      transactionsQuery.data?.pages.flatMap((page) => page.transactions) ?? [],
    [transactionsQuery.data]
  );
  const wallet = walletQuery.data ?? null;
  const exchanges = exchangesQuery.data?.exchanges ?? [];
  const usdWalletMetrics = useMemo(() => {
    if (!wallet) {
      return null;
    }

    const exchangedInUsdMinor = decimalAmountToMinorUnits(
      wallet.summary.exchangedIn.usdAmount
    );
    const exchangedOutUsdMinor = decimalAmountToMinorUnits(
      wallet.summary.exchangedOut.usdAmount
    );
    const spentUsdMinor = decimalAmountToMinorUnits(wallet.summary.spent.usdAmount);
    const incomeUsdMinor = decimalAmountToMinorUnits(wallet.summary.income.usdAmount);
    const remainingFromExchanged = getRemainingFromExchangedUsd({
      exchangedInUsdMinor,
      exchangedOutUsdMinor,
      spentUsdMinor
    });
    const netWorthShare = getNetWorthShareValue(
      wallet.costBasisMinor,
      overviewQuery.data?.balance.currentNetWorth ?? null
    );
    const shouldShowNetWorthShare =
      overviewQuery.isPending || (netWorthShare !== null && netWorthShare > 0);
    const shouldShowRemainingFromExchanged =
      remainingFromExchanged.amountMinor !== null &&
      remainingFromExchanged.amountMinor > 0;

    return {
      hasVisibleDetails:
        shouldShowNetWorthShare ||
        spentUsdMinor > 0 ||
        incomeUsdMinor > 0 ||
        shouldShowRemainingFromExchanged,
      shouldShowNetWorthShare,
      shouldShowUsdExpenses: spentUsdMinor > 0,
      shouldShowUsdIncome: incomeUsdMinor > 0,
      shouldShowRemainingFromExchanged,
      netWorthShare: overviewQuery.isPending
        ? "Loading"
        : formatPercentageValue(netWorthShare),
      remainingFromExchangedAmount:
        remainingFromExchanged.amountMinor === null
          ? "No data"
          : formatMoneyAmount(
              minorUnitsToDecimalAmount(remainingFromExchanged.amountMinor),
              { currency: "USD" }
            ),
      remainingFromExchangedShare: formatPercentageValue(
        remainingFromExchanged.percentage
      )
    };
  }, [overviewQuery.data?.balance.currentNetWorth, overviewQuery.isPending, wallet]);
  const averageRatePair = formatAverageRatePair(
    wallet?.averageRateBasePerUsd ?? null
  );
  const activeHistoryFilterCount = Object.values(historyFilters).filter(
    Boolean
  ).length;
  const historyEntries = useMemo<UsdWalletHistoryEntry[]>(() => {
    const entries: UsdWalletHistoryEntry[] = [];

    if (historyFilters.exchange) {
      entries.push(
        ...exchanges.map((exchange) => ({
          kind: "exchange" as const,
          id: exchange.id,
          date: exchange.date,
          createdAt: exchange.createdAt,
          exchange
        }))
      );
    }

    entries.push(
      ...transactions
        .filter((transaction) =>
          transaction.type === "INCOME"
            ? historyFilters.income
            : historyFilters.expense
        )
        .map((transaction) => ({
          kind: "transaction" as const,
          id: transaction.id,
          date: transaction.date,
          createdAt: transaction.createdAt,
          transaction
        }))
    );

    return entries.sort(compareHistoryEntries);
  }, [exchanges, historyFilters, transactions]);
  const hasLoadedHistory = exchanges.length > 0 || transactions.length > 0;
  const canLoadMoreTransactions =
    transactionsQuery.hasNextPage &&
    (historyFilters.expense || historyFilters.income);
  const hasError =
    walletQuery.isError || exchangesQuery.isError || transactionsQuery.isError;
  const isLoading =
    !hasError &&
    (walletQuery.isPending ||
      exchangesQuery.isPending ||
      transactionsQuery.isPending);

  useEffect(() => {
    if (!open) {
      setSelectedExchange(null);
      return;
    }

    screenRef.current?.scrollTo({ top: 0, left: 0 });
  }, [open]);

  useEffect(() => {
    if (!selectedExchange) {
      return;
    }

    if (updatedExchange?.id === selectedExchange.id) {
      setSelectedExchange(updatedExchange);
      return;
    }

    const refreshedExchange = exchanges.find(
      (exchange) => exchange.id === selectedExchange.id
    );

    if (refreshedExchange) {
      setSelectedExchange(refreshedExchange);
    }
  }, [exchanges, selectedExchange, updatedExchange]);

  useEffect(() => {
    const errors = [
      walletQuery.error,
      exchangesQuery.error,
      overviewQuery.error,
      transactionsQuery.error
    ];
    const hasExpiredSession = errors.some(
      (error) =>
        (error instanceof CurrencyApiError ||
          error instanceof HomeApiError ||
          error instanceof TransactionApiError) &&
        error.status === 401
    );

    if (hasExpiredSession) {
      onSessionExpired();
    }
  }, [
    exchangesQuery.error,
    onSessionExpired,
    overviewQuery.error,
    transactionsQuery.error,
    walletQuery.error
  ]);

  function toggleHistoryFilter(filter: UsdWalletHistoryFilter) {
    setHistoryFilters((currentFilters) => {
      const isOnlyActiveFilter =
        currentFilters[filter] &&
        Object.values(currentFilters).filter(Boolean).length === 1;

      if (isOnlyActiveFilter) {
        return currentFilters;
      }

      return {
        ...currentFilters,
        [filter]: !currentFilters[filter]
      };
    });
  }

  return (
    <div
      className={`account-flow-layer usd-wallet-layer${
        open ? " is-open" : ""
      }`}
      aria-hidden={!open}
      inert={!open}
    >
      <section
        ref={screenRef}
        className="auth-screen auth-screen--login auth-screen--register usd-wallet-screen"
      >
        <ActionButton
          shape="icon"
          className="auth-back-button"
          type="button"
          onClick={onBack}
          aria-label="Go back"
        >
          <ChevronLeft aria-hidden="true" strokeWidth={1.8} />
        </ActionButton>

        <header className="usd-wallet-page-header">
          <span aria-hidden="true" />
          <h1 id="usd-wallet-title">USD wallet</h1>
          <span aria-hidden="true" />
        </header>

        <section
          className="auth-panel usd-wallet-panel"
          aria-labelledby="usd-wallet-title"
        >
          {isLoading ? <UsdWalletSkeleton /> : null}
          {hasError ? <UsdWalletError /> : null}

          {!isLoading && !hasError && wallet ? (
            <div className="usd-wallet-content">
              <section
                className="stats-money usd-wallet-money"
                aria-labelledby="usd-wallet-balance-title"
              >
                <header className="stats-overview-section__header">
                  <h2 id="usd-wallet-balance-title">USD balance</h2>
                  {typeof averageRatePair === "string" ? (
                    <span>{averageRatePair}</span>
                  ) : (
                    <span className="usd-wallet-average-rates">
                      <span>{averageRatePair.usdToEur}</span>
                      <span aria-hidden="true">|</span>
                      <span>{averageRatePair.eurToUsd}</span>
                    </span>
                  )}
                </header>

                <div className="stats-money__content usd-wallet-money__content">
                  <div className="stats-money__balance">
                    <span>
                      <DollarSign aria-hidden="true" />
                      Available
                    </span>
                    <strong className="stats-value--positive">
                      {formatMoneyAmount(wallet.balance, { currency: "USD" })}
                    </strong>
                    <p className="stats-money__saved-rate">
                      EUR basis:{" "}
                      <strong>{formatEuroAmount(wallet.costBasis)}</strong>
                    </p>
                  </div>

                  <div className="stats-money__breakdown">
                    <div>
                      <span>
                        <ArrowDownToLine aria-hidden="true" />
                        € to $
                      </span>
                      <strong className="usd-wallet-value--neutral">
                        {formatMoneyAmount(
                          wallet.summary.exchangedIn.usdAmount,
                          { currency: "USD" }
                        )}
                      </strong>
                    </div>
                    <div>
                      <span>
                        <ArrowUpFromLine aria-hidden="true" />
                        $ to €
                      </span>
                      <strong className="usd-wallet-value--neutral">
                        {formatMoneyAmount(
                          wallet.summary.exchangedOut.baseAmount,
                          { currency: "EUR" }
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              </section>

              {usdWalletMetrics?.hasVisibleDetails ? (
                <section
                  className="stats-overview-section usd-wallet-insights-section"
                  aria-labelledby="usd-wallet-details-title"
                >
                  <header className="stats-overview-section__header">
                    <h2 id="usd-wallet-details-title">USD details</h2>
                    <span>Overview</span>
                  </header>
                  <ul className="stats-insights__list usd-wallet-insights-list">
                    {usdWalletMetrics.shouldShowNetWorthShare ? (
                      <UsdWalletInsightRow
                        icon={Percent}
                        label="USD share"
                        detail="of net worth"
                        value={usdWalletMetrics.netWorthShare}
                        tone="neutral"
                      />
                    ) : null}
                    {usdWalletMetrics.shouldShowUsdExpenses ? (
                      <UsdWalletInsightRow
                        icon={ArrowDownRight}
                        label="USD expenses"
                        detail={formatEntryCount(wallet.summary.spent.count)}
                        value={formatMoneyAmount(wallet.summary.spent.usdAmount, {
                          currency: "USD"
                        })}
                        tone="negative"
                      />
                    ) : null}
                    {usdWalletMetrics.shouldShowUsdIncome ? (
                      <UsdWalletInsightRow
                        icon={ArrowUpRight}
                        label="USD income"
                        detail={formatEntryCount(wallet.summary.income.count)}
                        value={formatMoneyAmount(wallet.summary.income.usdAmount, {
                          currency: "USD"
                        })}
                        tone="positive"
                      />
                    ) : null}
                    {usdWalletMetrics.shouldShowRemainingFromExchanged ? (
                      <UsdWalletInsightRow
                        icon={Wallet}
                        label="Exchanged left"
                        detail={`${usdWalletMetrics.remainingFromExchangedShare} left`}
                        value={usdWalletMetrics.remainingFromExchangedAmount}
                        tone="neutral"
                      />
                    ) : null}
                  </ul>
                </section>
              ) : null}

              <section
                className="usd-wallet-history-section"
                aria-labelledby="usd-wallet-history-title"
              >
                <header className="stats-chart-section__header usd-wallet-history-header">
                  <div className="usd-wallet-history-heading">
                    <h2 id="usd-wallet-history-title">USD history</h2>
                  </div>
                  <div className="usd-wallet-history-actions">
                    <span className="usd-wallet-history-count">
                      {formatHistoryEntryCount(
                        historyEntries.length,
                        historyFilters
                      )}
                    </span>
                    <div
                      className="stats-cash-flow__metrics usd-wallet-history-filters"
                      role="group"
                      aria-label="Visible USD history entries"
                    >
                      {historyFilterOptions.map(({ key, label, icon: Icon }) => {
                        const isVisible = historyFilters[key];
                        const isOnlyVisible =
                          isVisible && activeHistoryFilterCount === 1;

                        return (
                          <button
                            className={`stats-cash-flow__metric usd-wallet-history-filter usd-wallet-history-filter--${key}`}
                            key={key}
                            type="button"
                            aria-label={`${
                              isVisible ? "Hide" : "Show"
                            } ${label.toLowerCase()} entries`}
                            aria-pressed={isVisible}
                            disabled={isOnlyVisible}
                            title={
                              isOnlyVisible
                                ? `${label} must remain visible`
                                : `${isVisible ? "Hide" : "Show"} ${label.toLowerCase()} entries`
                            }
                            onClick={() => toggleHistoryFilter(key)}
                          >
                            <Icon aria-hidden="true" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </header>

                {historyEntries.length > 0 ? (
                  <>
                    <ul className="moves-transaction-list usd-wallet-history-list">
                      {historyEntries.map((entry, index) => {
                        const previousEntry = historyEntries[index - 1];
                        const startsNewMonth =
                          !previousEntry ||
                          getMonthKey(previousEntry.date) !==
                            getMonthKey(entry.date);

                        return (
                          <Fragment key={`${entry.kind}:${entry.id}`}>
                            {startsNewMonth ? (
                              <li className="moves-month-divider">
                                <time dateTime={getMonthKey(entry.date)}>
                                  {formatMonthLabel(entry.date)}
                                </time>
                              </li>
                            ) : null}
                            {entry.kind === "exchange" ? (
                              <CurrencyExchangeRow
                                exchange={entry.exchange}
                                onSelect={() =>
                                  setSelectedExchange(entry.exchange)
                                }
                              />
                            ) : (
                              <UsdTransactionHistoryRow
                                transaction={entry.transaction}
                                onSelect={() =>
                                  onTransactionSelect(entry.transaction)
                                }
                              />
                            )}
                          </Fragment>
                        );
                      })}
                    </ul>
                    {canLoadMoreTransactions ? (
                      <ActionButton
                        className="usd-wallet-load-more"
                        type="button"
                        disabled={transactionsQuery.isFetchingNextPage}
                        onClick={() => void transactionsQuery.fetchNextPage()}
                      >
                        {transactionsQuery.isFetchingNextPage
                          ? "Loading movements"
                          : "Load more movements"}
                      </ActionButton>
                    ) : null}
                  </>
                ) : hasLoadedHistory ? (
                  <EmptyHistory
                    title="No matching movements"
                    description="Turn on another type to see more USD history"
                    onNewExchange={onNewExchange}
                    showActions
                  />
                ) : (
                  <EmptyHistory
                    title="No USD history yet"
                    description="Dollar movements will appear here when you add them"
                    onNewExchange={onNewExchange}
                    showActions
                  />
                )}
              </section>
            </div>
          ) : null}
        </section>
      </section>
      <CurrencyExchangeDetailSheet
        exchange={selectedExchange}
        exchanges={exchanges}
        suspended={
          editingExchangeId !== null &&
          selectedExchange?.id === editingExchangeId
        }
        onClose={() => setSelectedExchange(null)}
        onEdit={onExchangeEdit}
        onDeleted={() => {
          setSelectedExchange(null);
          onExchangeDeleted();
        }}
        onSessionExpired={onSessionExpired}
      />
    </div>
  );
}
