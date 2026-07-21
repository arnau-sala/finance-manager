import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Plus,
  Scale
} from "lucide-react";

import { formatEuroAmount } from "../../money/format-euro";
import type { SessionUser } from "../auth/auth-api";
import { TransactionRow } from "../transactions/TransactionRow";
import {
  getHomeOverview,
  HomeApiError,
  type HomeOverview
} from "./home-api";
import { getCategoryIcon } from "../transactions/category-catalog";

type HomeOverviewPageProps = {
  user: SessionUser;
  onSessionExpired: () => void;
  onNewTransaction: () => void;
  onSeeAllMoves: () => void;
  refreshKey: number;
};

type LoadingState = "loading" | "ready" | "error";

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

export function HomeOverviewPage({
  user,
  onSessionExpired,
  onNewTransaction,
  onSeeAllMoves,
  refreshKey
}: HomeOverviewPageProps) {
  const [overview, setOverview] = useState<HomeOverview | null>(null);
  const [loadingState, setLoadingState] =
    useState<LoadingState>("loading");

  useEffect(() => {
    const controller = new AbortController();

    getHomeOverview(controller.signal)
      .then((homeOverview) => {
        setOverview(homeOverview);
        setLoadingState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setLoadingState("error");

        if (error instanceof HomeApiError && error.status === 401) {
          onSessionExpired();
        }
      });

    return () => controller.abort();
  }, [onSessionExpired, refreshKey]);

  const isReady = loadingState === "ready" && overview !== null;
  const latestMoves = isReady ? overview.latestMoves : [];
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
            <h2 id="home-balance-title">Current balance</h2>
          </div>
          <p className="home-balance__amount">
            {isReady
              ? formatEuroAmount(overview.balance.totalBalance)
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
            <button type="button" onClick={onSeeAllMoves}>
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
            <div className="home-activity__item">
              <CalendarDays aria-hidden="true" />
              <span>
                <small>Transactions</small>
                <strong>
                  {isReady
                    ? formatMoveCount(overview.activity.transactionCount)
                    : "--"}
                </strong>
              </span>
            </div>
            <div className="home-activity__item home-activity__item--expense">
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
            </div>
            <div className="home-activity__item home-activity__item--income">
              <TopIncomeIcon aria-hidden="true" />
              <span>
                <small>Top income</small>
                <strong>
                  {isReady
                    ? (overview.activity.topIncomeCategory?.name ?? "No income")
                    : "--"}
                </strong>
              </span>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
