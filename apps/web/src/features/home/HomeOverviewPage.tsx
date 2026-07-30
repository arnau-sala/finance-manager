import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronRight,
  Plus,
  Scale
} from "lucide-react";

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
  const isReady = loadingState === "ready" && overview !== null;
  const latestMoves = isReady ? overview.latestMoves : [];
  const hasStartingNetWorth =
    isReady && overview.balance.currentNetWorth !== null;
  const TopExpenseIcon = getCategoryIcon(
    isReady ? overview.activity.topExpenseCategory?.id : undefined,
    "EXPENSE"
  );
  const TopIncomeIcon = getCategoryIcon(
    isReady ? overview.activity.topIncomeCategory?.id : undefined,
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
              {hasStartingNetWorth ? "Net worth" : "Tracked balance"}
            </h2>
          </div>
          <p className="home-balance__amount">
            {isReady
              ? formatEuroAmount(
                  overview.balance.currentNetWorth ??
                    overview.balance.totalBalance
                )
              : "--"}
          </p>
        </section>

        <button
          className="home-new-transaction"
          type="button"
          onClick={onNewTransaction}
        >
          <span className="home-new-transaction__icon" aria-hidden="true">
            <Plus />
          </span>
          <span>New transaction</span>
          <ChevronRight aria-hidden="true" />
        </button>

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

          <ul className="home-move-list" aria-busy={loadingState === "loading"}>
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
            {loadingState === "loading" ? (
              <li className="home-move-list__status" role="status">
                Loading movements...
              </li>
            ) : null}
            {loadingState === "error" ? (
              <li className="home-move-list__status" role="status">
                Unable to load movements.
              </li>
            ) : null}
            {isReady && latestMoves.length === 0 ? (
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
              disabled={!isReady}
              onClick={() => {
                if (!isReady) {
                  return;
                }

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
                  {isReady
                    ? formatMoveCount(overview.activity.transactionCount)
                    : "--"}
                </strong>
              </span>
            </button>
            <button
              className="home-activity__item home-activity__item--expense"
              type="button"
              disabled={!isReady || !overview.activity.topExpenseCategory}
              onClick={() => {
                if (!isReady || !overview.activity.topExpenseCategory) {
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
                  {isReady
                    ? (overview.activity.topExpenseCategory?.name ??
                      "No expenses")
                    : "--"}
                </strong>
              </span>
            </button>
            <button
              className="home-activity__item home-activity__item--income"
              type="button"
              disabled={!isReady || !overview.activity.topIncomeCategory}
              onClick={() => {
                if (!isReady || !overview.activity.topIncomeCategory) {
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
                  {isReady
                    ? (overview.activity.topIncomeCategory?.name ?? "No income")
                    : "--"}
                </strong>
              </span>
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
