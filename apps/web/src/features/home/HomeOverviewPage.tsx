import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeEuro,
  BanknoteArrowUp,
  Bitcoin,
  Briefcase,
  CalendarDays,
  Car,
  ChevronRight,
  Dumbbell,
  Gift,
  Globe,
  GraduationCap,
  House,
  HandCoins,
  Map,
  PartyPopper,
  Plus,
  ShoppingBasket,
  ShoppingCart,
  Stethoscope,
  Utensils,
  WalletCards
} from "lucide-react";

import { formatEuroAmount } from "../../money/format-euro";
import type { SessionUser } from "../auth/auth-api";
import {
  getHomeOverview,
  HomeApiError,
  type HomeMove,
  type HomeOverview
} from "./home-api";

type HomeOverviewPageProps = {
  user: SessionUser;
  onSessionExpired: () => void;
};

type LoadingState = "loading" | "ready" | "error";

const categoryIcons: Record<string, LucideIcon> = {
  "expense-bars-restaurants": Utensils,
  "expense-education": GraduationCap,
  "expense-gifts": Gift,
  "expense-groceries": ShoppingBasket,
  "expense-health": Stethoscope,
  "expense-housing": House,
  "expense-other": ArrowDownRight,
  "expense-parties": PartyPopper,
  "expense-shopping": ShoppingCart,
  "expense-sports": Dumbbell,
  "expense-subscriptions": Globe,
  "expense-transportation": Car,
  "expense-travel": Map,
  "income-allowance": HandCoins,
  "income-freelance": BanknoteArrowUp,
  "income-gifts": Gift,
  "income-investments": Bitcoin,
  "income-other": ArrowUpRight,
  "income-salary": Briefcase,
  "income-sales": BadgeEuro
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

function formatMoveAmount(move: HomeMove) {
  const amount = Number(move.amount);

  if (!Number.isFinite(amount)) {
    return "--";
  }

  const signedAmount =
    move.type === "INCOME" ? Math.abs(amount) : -Math.abs(amount);

  return formatEuroAmount(signedAmount, { showSign: true });
}

function formatMoveDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (isToday) {
    const time = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);

    return `Today, ${time}`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric"
  }).format(date);
}

function getCategoryIcon(
  categoryId: string | undefined,
  type: HomeMove["type"]
) {
  return (
    (categoryId ? categoryIcons[categoryId] : undefined) ??
    (type === "INCOME" ? ArrowUpRight : ArrowDownRight)
  );
}

function getMoveIcon(move: HomeMove) {
  return getCategoryIcon(move.category.id, move.type);
}

function formatMoveCount(count: number) {
  return `${count} ${count === 1 ? "move" : "moves"}`;
}

export function HomeOverviewPage({
  user,
  onSessionExpired
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
  }, [onSessionExpired]);

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
            <WalletCards aria-hidden="true" />
            <h2 id="home-balance-title">Current balance</h2>
          </div>
          <p className="home-balance__amount">
            {isReady
              ? formatEuroAmount(overview.balance.totalBalance)
              : "--"}
          </p>
        </section>

        <button className="home-new-transaction" type="button">
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
            <button type="button">
              See all
              <ChevronRight aria-hidden="true" />
            </button>
          </div>

          <ul className="home-move-list" aria-busy={loadingState === "loading"}>
            {latestMoves.map((move) => {
              const Icon = getMoveIcon(move);
              const moveType = move.type.toLowerCase();

              return (
                <li key={move.id} className="home-move">
                  <span className="home-move__icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="home-move__details">
                    <strong>{move.description}</strong>
                    <span>
                      {move.category.name} &middot; {formatMoveDate(move.date)}
                    </span>
                  </span>
                  <span
                    className={`home-move__amount home-move__amount--${moveType}`}
                  >
                    {formatMoveAmount(move)}
                  </span>
                </li>
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
