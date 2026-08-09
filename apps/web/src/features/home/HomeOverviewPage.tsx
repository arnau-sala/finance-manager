import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronRight,
  Eye,
  EyeClosed,
  Plus,
  RefreshCw,
  Scale
} from "lucide-react";

import { prefetchScheduler } from "../../cache/prefetch-scheduler";
import { ActionButton } from "../../components/ui/ActionButton";
import { SkeletonBlock } from "../../components/ui/SkeletonBlock";
import { getTodayDateOnly } from "../../dates/date-only";
import { formatEuroAmount } from "../../money/format-euro";
import { scheduleHomePrefetches } from "../../cache/financial-prefetch";
import type { SessionUser } from "../auth/auth-api";
import type { TransactionPreview } from "../transactions/transaction-api";
import { TransactionRow } from "../transactions/TransactionRow";
import {
  homeOverviewQueryOptions,
  HomeApiError,
} from "./home-api";
import { getCategoryIcon } from "../transactions/category-catalog";
import {
  createEmptyMovesFilters,
  type MovesFilters,
  type MovesTypeFilter
} from "../transactions/moves-filters";

type HomeOverviewPageProps = {
  user: SessionUser;
  onSessionExpired: () => void;
  onInitialContentReady: () => void;
  onNewTransaction: () => void;
  onNavigateToMoves: (filters?: MovesFilters) => void;
  onTransactionSelect: (transaction: TransactionPreview) => void;
};

function getNetWorthVisibilityStorageKey(userId: string) {
  return `finance-manager:home-net-worth-hidden:${userId}`;
}

function readStoredNetWorthHidden(userId: string) {
  try {
    return (
      window.localStorage.getItem(getNetWorthVisibilityStorageKey(userId)) ===
      "true"
    );
  } catch {
    return false;
  }
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

function formatCurrentDate() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(new Date());
}

function formatMoveCount(count: number) {
  return `${count} ${count === 1 ? "move" : "moves"}`;
}

function createCurrentMonthFilters(
  month: number,
  year: number,
  type: MovesTypeFilter = "ALL",
  categoryId?: string
): MovesFilters {
  const filters = createEmptyMovesFilters();
  const paddedMonth = String(month).padStart(2, "0");

  return {
    ...filters,
    type,
    startDate: `${year}-${paddedMonth}-01`,
    endDate: getTodayDateOnly(),
    selectedCategoryIds: categoryId ? [categoryId] : []
  };
}

function HomeOverviewSkeleton() {
  return (
    <section
      className="home-content home-content--overview"
      aria-label="Home overview"
    >
      <div
        className="home-overview home-overview--skeleton"
        role="status"
        aria-busy="true"
      >
        <span className="sr-only">Loading your financial overview</span>

        <header className="home-overview__header">
          <SkeletonBlock width={118} height={14} />
          <SkeletonBlock width="68%" height={31} radius={6} />
        </header>

        <section className="home-balance" aria-hidden="true">
          <div className="home-balance__label">
            <SkeletonBlock width={17} height={17} radius="50%" />
            <SkeletonBlock width={76} height={14} />
          </div>
          <SkeletonBlock
            className="home-overview-skeleton__balance"
            width={164}
            height={39}
            radius={6}
          />
        </section>

        <SkeletonBlock
          className="home-overview-skeleton__new-transaction"
          width="100%"
          height={52}
          radius={8}
        />

        <section className="home-recent-moves" aria-hidden="true">
          <div className="home-section-heading">
            <SkeletonBlock width={102} height={18} />
            <SkeletonBlock width={52} height={14} />
          </div>

          <ul className="home-move-list">
            {Array.from({ length: 3 }, (_, index) => (
              <li className="transaction-row" key={index}>
                <div className="transaction-row__content">
                  <SkeletonBlock width={36} height={36} radius="50%" />
                  <span className="home-overview-skeleton__move-details">
                    <SkeletonBlock width="72%" height={14} />
                    <SkeletonBlock width="52%" height={11} />
                  </span>
                  <SkeletonBlock width={58} height={14} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="home-activity" aria-hidden="true">
          <div className="home-activity__heading">
            <SkeletonBlock width={64} height={18} />
            <SkeletonBlock width={58} height={12} />
          </div>
          <div className="home-activity__items">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="home-overview-skeleton__activity-item" key={index}>
                <SkeletonBlock width={20} height={20} radius={4} />
                <span>
                  <SkeletonBlock width="70%" height={9} />
                  <SkeletonBlock width="84%" height={11} />
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

export function HomeOverviewPage({
  user,
  onSessionExpired,
  onInitialContentReady,
  onNewTransaction,
  onNavigateToMoves,
  onTransactionSelect
}: HomeOverviewPageProps) {
  const overviewQuery = useQuery(homeOverviewQueryOptions(user.id));
  const overview = overviewQuery.data ?? null;
  const [isNetWorthHidden, setIsNetWorthHidden] = useState(() =>
    readStoredNetWorthHidden(user.id)
  );

  useEffect(() => {
    setIsNetWorthHidden(readStoredNetWorthHidden(user.id));
  }, [user.id]);

  useEffect(() => {
    if (
      overviewQuery.error instanceof HomeApiError &&
      overviewQuery.error.status === 401
    ) {
      onSessionExpired();
    }
  }, [onSessionExpired, overviewQuery.error]);

  useEffect(() => {
    if (!overviewQuery.isPending) {
      onInitialContentReady();
    }
  }, [onInitialContentReady, overviewQuery.isPending]);

  useEffect(() => {
    if (overview) {
      scheduleHomePrefetches(user.id);
    }
  }, [overview, user.id]);

  const loadingState = overviewQuery.isPending
    ? "loading"
    : overviewQuery.isError
      ? "error"
      : "ready";

  if (loadingState === "loading") {
    return <HomeOverviewSkeleton />;
  }

  if (loadingState === "error" || !overview) {
    return (
      <section
        className="home-content home-content--overview"
        aria-labelledby="home-overview-title"
      >
        <div className="home-overview home-overview--error">
          <header className="home-overview__header">
            <p>{formatCurrentDate()}</p>
            <h1 id="home-overview-title">
              {getGreeting()}, {getFirstName(user.name)}
            </h1>
          </header>

          <div className="home-overview-error" role="alert">
            <h2>We couldn't load your overview</h2>
            <p>Check your connection and try again</p>
            <ActionButton
              type="button"
              onClick={() => {
                prefetchScheduler.prioritizeUserRequest();
                void overviewQuery.refetch();
              }}
            >
              <RefreshCw aria-hidden="true" />
              Try again
            </ActionButton>
          </div>
        </div>
      </section>
    );
  }

  const latestMoves = overview.latestMoves;
  const hasStartingNetWorth = overview.balance.currentNetWorth !== null;
  const balanceLabel = hasStartingNetWorth ? "Net worth" : "Tracked balance";
  const TopExpenseIcon = getCategoryIcon(
    overview.activity.topExpenseCategory?.id,
    "EXPENSE"
  );
  const TopIncomeIcon = getCategoryIcon(
    overview.activity.topIncomeCategory?.id,
    "INCOME"
  );

  return (
    <section
      className="home-content home-content--overview"
      aria-labelledby="home-overview-title"
    >
      <div className="home-overview">
        <header className="home-overview__header">
          <p>{formatCurrentDate()}</p>
          <h1 id="home-overview-title">
            {getGreeting()}, {getFirstName(user.name)}
          </h1>
        </header>

        <section className="home-balance" aria-labelledby="home-balance-title">
          <div className="home-balance__label">
            <Scale aria-hidden="true" />
            <h2 id="home-balance-title">
              {balanceLabel}
            </h2>
            <button
              className="home-balance__visibility-toggle"
              type="button"
              aria-label={
                isNetWorthHidden ? `Show ${balanceLabel}` : `Hide ${balanceLabel}`
              }
              aria-pressed={isNetWorthHidden}
              onClick={() => {
                setIsNetWorthHidden((currentValue) => {
                  const nextValue = !currentValue;

                  try {
                    window.localStorage.setItem(
                      getNetWorthVisibilityStorageKey(user.id),
                      String(nextValue)
                    );
                  } catch {
                    // Ignore storage failures; the current session still updates.
                  }

                  return nextValue;
                });
              }}
            >
              {isNetWorthHidden ? (
                <Eye aria-hidden="true" />
              ) : (
                <EyeClosed aria-hidden="true" />
              )}
            </button>
          </div>
          <p
            className="home-balance__amount"
            aria-hidden={isNetWorthHidden}
          >
            {isNetWorthHidden
              ? "\u00a0"
              : formatEuroAmount(
                  overview.balance.currentNetWorth ??
                    overview.balance.totalBalance
                )}
          </p>
        </section>

        <ActionButton
          className="home-new-transaction"
          type="button"
          onClick={onNewTransaction}
        >
          <span className="home-new-transaction__icon" aria-hidden="true">
            <Plus />
          </span>
          <span>New transaction</span>
          <ChevronRight aria-hidden="true" />
        </ActionButton>

        <section
          className="home-recent-moves"
          aria-labelledby="home-recent-moves-title"
        >
          <div className="home-section-heading">
            <h2 id="home-recent-moves-title">Latest moves</h2>
            <button type="button" onClick={() => onNavigateToMoves()}>
              See all
              <ChevronRight aria-hidden="true" />
            </button>
          </div>

          <ul className="home-move-list">
            {latestMoves.map((move) => {
              return (
                <TransactionRow
                  key={move.id}
                  type={move.type}
                  categoryId={move.category.id}
                  categoryName={move.category.name}
                  amount={move.amount}
                  description={move.description}
                  date={move.date}
                  onSelect={() =>
                    onTransactionSelect({
                      id: move.id,
                      type: move.type,
                      categoryId: move.category.id,
                      category: move.category,
                      amount: move.amount,
                      description: move.description,
                      date: move.date
                    })
                  }
                />
              );
            })}
            {latestMoves.length === 0 ? (
              <li className="home-move-list__status">No movements yet.</li>
            ) : null}
          </ul>
        </section>

        <section className="home-activity" aria-labelledby="home-activity-title">
          <div className="home-activity__heading">
            <h2 id="home-activity-title">Activity</h2>
            <span>This month</span>
          </div>
          <div className="home-activity__items">
            <button
              className="home-activity__item"
              type="button"
              onClick={() => {
                onNavigateToMoves(
                  createCurrentMonthFilters(
                    overview.activity.month,
                    overview.activity.year
                  )
                );
              }}
            >
              <CalendarDays aria-hidden="true" />
              <span>
                <small>Transactions</small>
                <strong>
                  {formatMoveCount(overview.activity.transactionCount)}
                </strong>
              </span>
            </button>
            <button
              className="home-activity__item home-activity__item--expense"
              type="button"
              disabled={!overview.activity.topExpenseCategory}
              onClick={() => {
                if (!overview.activity.topExpenseCategory) {
                  return;
                }

                onNavigateToMoves(
                  createCurrentMonthFilters(
                    overview.activity.month,
                    overview.activity.year,
                    "EXPENSE",
                    overview.activity.topExpenseCategory.id
                  )
                );
              }}
            >
              <TopExpenseIcon aria-hidden="true" />
              <span>
                <small>Top expense</small>
                <strong>
                  {overview.activity.topExpenseCategory?.name ?? "No expenses"}
                </strong>
              </span>
            </button>
            <button
              className="home-activity__item home-activity__item--income"
              type="button"
              disabled={!overview.activity.topIncomeCategory}
              onClick={() => {
                if (!overview.activity.topIncomeCategory) {
                  return;
                }

                onNavigateToMoves(
                  createCurrentMonthFilters(
                    overview.activity.month,
                    overview.activity.year,
                    "INCOME",
                    overview.activity.topIncomeCategory.id
                  )
                );
              }}
            >
              <TopIncomeIcon aria-hidden="true" />
              <span>
                <small>Top income</small>
                <strong>
                  {overview.activity.topIncomeCategory?.name ?? "No income"}
                </strong>
              </span>
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
