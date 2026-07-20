import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

import {
  TransactionRow,
  type TransactionRowData
} from "./TransactionRow";

type MockTransaction = TransactionRowData & {
  id: string;
};

const PAGE_SIZE = 12;

const MOCK_TRANSACTIONS: readonly MockTransaction[] = [
  {
    id: "mock-01",
    type: "EXPENSE",
    categoryId: "expense-dining",
    categoryName: "Dining",
    amount: "8.60",
    description: "Coffee and breakfast",
    date: "2026-07-20"
  },
  {
    id: "mock-02",
    type: "INCOME",
    categoryId: "income-salary",
    categoryName: "Salary",
    amount: "2600.00",
    description: "July salary",
    date: "2026-07-20"
  },
  {
    id: "mock-03",
    type: "EXPENSE",
    categoryId: "expense-groceries",
    categoryName: "Groceries",
    amount: "74.35",
    description: "Weekly groceries",
    date: "2026-07-19"
  },
  {
    id: "mock-04",
    type: "EXPENSE",
    categoryId: "expense-housing",
    categoryName: "Housing",
    amount: "920.00",
    description: "Apartment rent",
    date: "2026-07-15"
  },
  {
    id: "mock-05",
    type: "INCOME",
    categoryId: "income-freelance",
    categoryName: "Freelance",
    amount: "480.00",
    description: "Freelance landing page",
    date: "2026-07-12"
  },
  {
    id: "mock-06",
    type: "EXPENSE",
    categoryId: "expense-transportation",
    categoryName: "Transportation",
    amount: "25.00",
    description: "Metro card",
    date: "2026-07-10"
  },
  {
    id: "mock-07",
    type: "EXPENSE",
    categoryId: "expense-sports",
    categoryName: "Sports",
    amount: "34.99",
    description: "Gym membership",
    date: "2026-07-08"
  },
  {
    id: "mock-08",
    type: "EXPENSE",
    categoryId: "expense-dining",
    categoryName: "Dining",
    amount: "62.40",
    description: "Dinner with friends",
    date: "2026-07-05"
  },
  {
    id: "mock-09",
    type: "EXPENSE",
    categoryId: "expense-subscriptions",
    categoryName: "Subscriptions",
    amount: "18.98",
    description: "Streaming services",
    date: "2026-07-03"
  },
  {
    id: "mock-10",
    type: "EXPENSE",
    categoryId: "expense-health",
    categoryName: "Health",
    amount: "13.25",
    description: "Pharmacy",
    date: "2026-06-28"
  },
  {
    id: "mock-11",
    type: "EXPENSE",
    categoryId: "expense-education",
    categoryName: "Education",
    amount: "89.00",
    description: "Online course",
    date: "2026-06-23"
  },
  {
    id: "mock-12",
    type: "INCOME",
    categoryId: "income-sales",
    categoryName: "Sales",
    amount: "145.00",
    description: "Sold old monitor",
    date: "2026-06-18"
  },
  {
    id: "mock-13",
    type: "EXPENSE",
    categoryId: "expense-gifts",
    categoryName: "Gifts",
    amount: "40.00",
    description: "Birthday present",
    date: "2026-06-14"
  },
  {
    id: "mock-14",
    type: "INCOME",
    categoryId: "income-benefits",
    categoryName: "Benefits",
    amount: "75.00",
    description: "Employee benefits",
    date: "2026-06-08"
  },
  {
    id: "mock-15",
    type: "EXPENSE",
    categoryId: "expense-shopping",
    categoryName: "Shopping",
    amount: "96.50",
    description: "Summer shoes",
    date: "2026-06-02"
  }
];

function getResultLabel(count: number, isSearching: boolean) {
  if (isSearching) {
    return `${count} ${count === 1 ? "result" : "results"}`;
  }

  return `${count} ${count === 1 ? "transaction" : "transactions"}`;
}

export function MovesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollContainer = useRef<HTMLElement>(null);
  const loadMoreSentinel = useRef<HTMLDivElement>(null);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredTransactions = useMemo(
    () =>
      normalizedQuery
        ? MOCK_TRANSACTIONS.filter((transaction) =>
            transaction.description.toLocaleLowerCase().includes(normalizedQuery)
          )
        : MOCK_TRANSACTIONS,
    [normalizedQuery]
  );
  const visibleTransactions = filteredTransactions.slice(0, visibleCount);
  const hasMore = visibleTransactions.length < filteredTransactions.length;

  useLayoutEffect(() => {
    const root = scrollContainer.current;

    if (root) {
      root.scrollTop = 0;
    }
  }, []);

  function updateSearchQuery(value: string) {
    setSearchQuery(value);
    setVisibleCount(PAGE_SIZE);
    scrollContainer.current?.scrollTo({ top: 0 });
  }

  useEffect(() => {
    const root = scrollContainer.current;
    const sentinel = loadMoreSentinel.current;

    if (!root || !sentinel || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisibleCount((current) =>
            Math.min(current + PAGE_SIZE, filteredTransactions.length)
          );
        }
      },
      {
        root,
        rootMargin: "0px 0px -80px"
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredTransactions.length, hasMore, visibleCount]);

  return (
    <section
      ref={scrollContainer}
      className="home-content home-content--moves"
      aria-labelledby="moves-page-title"
    >
      <div className="moves-page">
        <header className="moves-page__header">
          <h1 id="moves-page-title">Transactions</h1>
          <p aria-live="polite">
            {getResultLabel(filteredTransactions.length, normalizedQuery.length > 0)}
          </p>
        </header>

        <div className="moves-toolbar">
          <div className="moves-search">
            <label className="sr-only" htmlFor="moves-search-input">
              Search transaction names
            </label>
            <Search aria-hidden="true" />
            <input
              id="moves-search-input"
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              placeholder="Search by name"
              value={searchQuery}
              onChange={(event) => updateSearchQuery(event.target.value)}
            />
            {searchQuery ? (
              <button
                type="button"
                aria-label="Clear search"
                title="Clear search"
                onClick={() => updateSearchQuery("")}
              >
                <X aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <button
            className="moves-filter-button"
            type="button"
            disabled
            aria-label="Open transaction filters"
            title="Filters"
          >
            <SlidersHorizontal aria-hidden="true" />
          </button>
        </div>

        {visibleTransactions.length > 0 ? (
          <ul className="moves-transaction-list" aria-label="Transaction history">
            {visibleTransactions.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                type={transaction.type}
                categoryId={transaction.categoryId}
                categoryName={transaction.categoryName}
                amount={transaction.amount}
                description={transaction.description}
                date={transaction.date}
              />
            ))}
          </ul>
        ) : (
          <div className="moves-empty-state" role="status">
            <Search aria-hidden="true" />
            <h2>No transactions found</h2>
            <p>No descriptions match your search.</p>
          </div>
        )}

        {hasMore ? (
          <div
            ref={loadMoreSentinel}
            className="moves-load-sentinel"
            aria-hidden="true"
          />
        ) : null}
      </div>
    </section>
  );
}
