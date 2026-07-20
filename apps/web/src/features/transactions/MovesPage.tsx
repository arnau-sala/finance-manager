import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { parseLocalDateOnly } from "../../dates/date-only";
import {
  TransactionRow,
  type TransactionRowData
} from "./TransactionRow";
import { MovesFiltersPanel } from "./MovesFiltersPanel";

type MockTransaction = TransactionRowData & {
  id: string;
};

type MockTransactionTemplate = Omit<MockTransaction, "id" | "date">;

const PAGE_SIZE = 12;
const FILTER_PANEL_ID = "moves-filter-panel";
const MOCK_TRANSACTION_COUNT = 200;
const MOCK_TRANSACTION_DAY_INTERVAL = 2;

const MOCK_TRANSACTION_TEMPLATES: readonly MockTransactionTemplate[] = [
  {
    type: "EXPENSE",
    categoryId: "expense-dining",
    categoryName: "Dining",
    amount: "8.60",
    description: "Coffee and breakfast"
  },
  {
    type: "INCOME",
    categoryId: "income-salary",
    categoryName: "Salary",
    amount: "2600.00",
    description: "Monthly salary"
  },
  {
    type: "EXPENSE",
    categoryId: "expense-groceries",
    categoryName: "Groceries",
    amount: "74.35",
    description: "Weekly groceries"
  },
  {
    type: "EXPENSE",
    categoryId: "expense-housing",
    categoryName: "Housing",
    amount: "920.00",
    description: "Apartment rent"
  },
  {
    type: "INCOME",
    categoryId: "income-freelance",
    categoryName: "Freelance",
    amount: "480.00",
    description: "Freelance design project"
  },
  {
    type: "EXPENSE",
    categoryId: "expense-transportation",
    categoryName: "Transportation",
    amount: "25.00",
    description: "Metro card"
  },
  {
    type: "EXPENSE",
    categoryId: "expense-sports",
    categoryName: "Sports",
    amount: "34.99",
    description: "Gym membership"
  },
  {
    type: "EXPENSE",
    categoryId: "expense-subscriptions",
    categoryName: "Subscriptions",
    amount: "18.98",
    description: "Streaming services"
  },
  {
    type: "EXPENSE",
    categoryId: "expense-health",
    categoryName: "Health",
    amount: "13.25",
    description: "Pharmacy"
  },
  {
    type: "EXPENSE",
    categoryId: "expense-education",
    categoryName: "Education",
    amount: "89.00",
    description: "Online course"
  },
  {
    type: "INCOME",
    categoryId: "income-sales",
    categoryName: "Sales",
    amount: "145.00",
    description: "Sold old monitor"
  },
  {
    type: "EXPENSE",
    categoryId: "expense-gifts",
    categoryName: "Gifts",
    amount: "40.00",
    description: "Birthday present"
  },
  {
    type: "INCOME",
    categoryId: "income-benefits",
    categoryName: "Benefits",
    amount: "75.00",
    description: "Employee benefit"
  },
  {
    type: "EXPENSE",
    categoryId: "expense-shopping",
    categoryName: "Shopping",
    amount: "96.50",
    description: "Running shoes"
  },
  {
    type: "EXPENSE",
    categoryId: "expense-parties",
    categoryName: "Parties",
    amount: "32.00",
    description: "Concert tickets"
  },
  {
    type: "EXPENSE",
    categoryId: "expense-other",
    categoryName: "Other",
    amount: "21.40",
    description: "Household supplies"
  },
  {
    type: "INCOME",
    categoryId: "income-allowance",
    categoryName: "Allowance",
    amount: "50.00",
    description: "Family allowance"
  },
  {
    type: "INCOME",
    categoryId: "income-gifts",
    categoryName: "Gifts",
    amount: "80.00",
    description: "Birthday gift"
  },
  {
    type: "INCOME",
    categoryId: "income-investments",
    categoryName: "Investments",
    amount: "36.75",
    description: "Dividend payment"
  },
  {
    type: "INCOME",
    categoryId: "income-other",
    categoryName: "Other",
    amount: "12.30",
    description: "Cashback reward"
  }
];

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

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

function createMockTransactions(): MockTransaction[] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  return Array.from({ length: MOCK_TRANSACTION_COUNT }, (_, index) => {
    const template =
      MOCK_TRANSACTION_TEMPLATES[index % MOCK_TRANSACTION_TEMPLATES.length];
    const date = new Date(today);
    date.setDate(today.getDate() - index * MOCK_TRANSACTION_DAY_INTERVAL);

    return {
      ...template,
      id: `mock-${String(index + 1).padStart(3, "0")}`,
      date: formatLocalDate(date)
    };
  });
}

const MOCK_TRANSACTIONS: readonly MockTransaction[] = createMockTransactions();

function getResultLabel(count: number, isSearching: boolean) {
  if (isSearching) {
    return `${count} ${count === 1 ? "result" : "results"}`;
  }

  return `${count} ${count === 1 ? "transaction" : "transactions"}`;
}

export function MovesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [activeFilterCount, setActiveFilterCount] = useState(0);
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

  function toggleFilterPanel() {
    if (isFilterPanelOpen && activeFilterCount > 0) {
      return;
    }

    setIsFilterPanelOpen((current) => !current);
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
            className={`moves-filter-button${
              isFilterPanelOpen ? " is-active" : ""
            }`}
            type="button"
            aria-label="Transaction filters"
            aria-controls={FILTER_PANEL_ID}
            aria-expanded={isFilterPanelOpen}
            title="Filters"
            onClick={toggleFilterPanel}
          >
            <SlidersHorizontal aria-hidden="true" />
            {activeFilterCount > 0 ? (
              <span className="moves-filter-button__count" aria-hidden="true">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </div>

        {isFilterPanelOpen ? (
          <MovesFiltersPanel
            id={FILTER_PANEL_ID}
            onActiveFilterCountChange={setActiveFilterCount}
          />
        ) : null}

        {visibleTransactions.length > 0 ? (
          <ul className="moves-transaction-list" aria-label="Transaction history">
            {visibleTransactions.map((transaction, index) => {
              const previousTransaction = visibleTransactions[index - 1];
              const startsNewMonth =
                !previousTransaction ||
                getMonthKey(previousTransaction.date) !==
                  getMonthKey(transaction.date);

              return (
                <Fragment key={transaction.id}>
                  {startsNewMonth ? (
                    <li className="moves-month-divider">
                      <time dateTime={getMonthKey(transaction.date)}>
                        {formatMonthLabel(transaction.date)}
                      </time>
                    </li>
                  ) : null}
                  <TransactionRow
                    type={transaction.type}
                    categoryId={transaction.categoryId}
                    categoryName={transaction.categoryName}
                    amount={transaction.amount}
                    description={transaction.description}
                    date={transaction.date}
                  />
                </Fragment>
              );
            })}
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
