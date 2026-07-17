import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  ChevronRight,
  Lightbulb,
  Plus,
  ShoppingBasket,
  Utensils,
  WalletCards
} from "lucide-react";

import type { SessionUser } from "../auth/auth-api";

type HomeOverviewPageProps = {
  user: SessionUser;
};

type PreviewMove = {
  id: string;
  description: string;
  category: string;
  date: string;
  amount: string;
  type: "income" | "expense";
  icon: LucideIcon;
};

const previewMoves: PreviewMove[] = [
  {
    id: "groceries",
    description: "Weekly groceries",
    category: "Groceries",
    date: "Today, 18:42",
    amount: "-€42.80",
    type: "expense",
    icon: ShoppingBasket
  },
  {
    id: "salary",
    description: "Monthly salary",
    category: "Salary",
    date: "Jul 15",
    amount: "+€2,350.00",
    type: "income",
    icon: Briefcase
  },
  {
    id: "restaurant",
    description: "Dinner with friends",
    category: "Bars & Restaurants",
    date: "Jul 14",
    amount: "-€28.50",
    type: "expense",
    icon: Utensils
  }
];

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

export function HomeOverviewPage({ user }: HomeOverviewPageProps) {
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
          <p className="home-balance__amount">€2,486.40</p>
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

          <ul className="home-move-list">
            {previewMoves.map((move) => {
              const Icon = move.icon;

              return (
                <li key={move.id} className="home-move">
                  <span className="home-move__icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="home-move__details">
                    <strong>{move.description}</strong>
                    <span>
                      {move.category} · {move.date}
                    </span>
                  </span>
                  <span
                    className={`home-move__amount home-move__amount--${move.type}`}
                  >
                    {move.amount}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="home-insight" aria-labelledby="home-insight-title">
          <span className="home-insight__icon" aria-hidden="true">
            <Lightbulb />
          </span>
          <div>
            <h2 id="home-insight-title">Quick insight</h2>
            <p>Dining out appears most often in your expenses this month.</p>
          </div>
        </section>
      </div>
    </section>
  );
}
