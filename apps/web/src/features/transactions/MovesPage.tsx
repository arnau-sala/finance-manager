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
import { TransactionRow } from "./TransactionRow";
import { MovesFiltersPanel } from "./MovesFiltersPanel";
import {
  countActiveMovesFilters,
  createEmptyMovesFilters,
  getActiveCategoryIds,
  type MovesFilters
} from "./moves-filters";
import {
  getTransactions,
  TransactionApiError,
  type TransactionListItem
} from "./transaction-api";
import { FirstTransactionEmptyState } from "./FirstTransactionEmptyState";

const PAGE_SIZE = 12;
const FILTER_PANEL_ID = "moves-filter-panel";

type MovesLoadingState = "loading" | "ready" | "error";

type MovesPageProps = {
  refreshKey: number;
  onNewTransaction: () => void;
  onSessionExpired: () => void;
};

function getMonthKey(value: string) {
  return value.slice(0, 7);
}

function parseAmountCents(value: string | number) {
  const amount =
    typeof value === "number" ? value : Number(value.replace(",", "."));

  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
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

function getResultLabel(count: number, isSearching: boolean) {
  if (isSearching) {
    return `${count} ${count === 1 ? "result" : "results"}`;
  }

  return `${count} ${count === 1 ? "transaction" : "transactions"}`;
}

export function MovesPage({
  refreshKey,
  onNewTransaction,
  onSessionExpired
}: MovesPageProps) {
  const [transactions, setTransactions] = useState<TransactionListItem[]>([]);
  const [loadingState, setLoadingState] =
    useState<MovesLoadingState>("loading");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<MovesFilters>(
    createEmptyMovesFilters
  );
  const scrollContainer = useRef<HTMLElement>(null);
  const loadMoreSentinel = useRef<HTMLDivElement>(null);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const activeFilterCount = countActiveMovesFilters(appliedFilters);
  const filteredTransactions = useMemo(() => {
    const categoryIds = new Set(getActiveCategoryIds(appliedFilters));
    const exactAmountCents = parseAmountCents(appliedFilters.exactAmount);
    const minimumAmountCents = parseAmountCents(appliedFilters.minimumAmount);
    const maximumAmountCents = parseAmountCents(appliedFilters.maximumAmount);

    return transactions.filter((transaction) => {
      if (
        normalizedQuery &&
        !transaction.description.toLocaleLowerCase().includes(normalizedQuery)
      ) {
        return false;
      }

      if (
        appliedFilters.type !== "ALL" &&
        transaction.type !== appliedFilters.type
      ) {
        return false;
      }

      if (categoryIds.size > 0 && !categoryIds.has(transaction.categoryId)) {
        return false;
      }

      const transactionAmountCents = parseAmountCents(transaction.amount);

      if (transactionAmountCents === null) {
        return false;
      }

      if (
        appliedFilters.amountMode === "EXACT" &&
        appliedFilters.exactAmount.length > 0 &&
        transactionAmountCents !== exactAmountCents
      ) {
        return false;
      }

      if (appliedFilters.amountMode === "RANGE") {
        if (
          appliedFilters.minimumAmount.length > 0 &&
          minimumAmountCents !== null &&
          transactionAmountCents < minimumAmountCents
        ) {
          return false;
        }

        if (
          appliedFilters.maximumAmount.length > 0 &&
          maximumAmountCents !== null &&
          transactionAmountCents > maximumAmountCents
        ) {
          return false;
        }
      }

      if (
        appliedFilters.dateMode === "EXACT" &&
        appliedFilters.exactDate &&
        transaction.date !== appliedFilters.exactDate
      ) {
        return false;
      }

      if (appliedFilters.dateMode === "RANGE") {
        if (
          appliedFilters.startDate &&
          transaction.date < appliedFilters.startDate
        ) {
          return false;
        }

        if (
          appliedFilters.endDate &&
          transaction.date > appliedFilters.endDate
        ) {
          return false;
        }
      }

      return true;
    });
  }, [appliedFilters, normalizedQuery, transactions]);
  const visibleTransactions = filteredTransactions.slice(0, visibleCount);
  const hasMore = visibleTransactions.length < filteredTransactions.length;

  useLayoutEffect(() => {
    const root = scrollContainer.current;

    if (root) {
      root.scrollTop = 0;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingState("loading");

    getTransactions(controller.signal)
      .then((loadedTransactions) => {
        setTransactions(loadedTransactions);
        setLoadingState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setLoadingState("error");

        if (error instanceof TransactionApiError && error.status === 401) {
          onSessionExpired();
        }
      });

    return () => controller.abort();
  }, [onSessionExpired, refreshKey]);

  function updateSearchQuery(value: string) {
    setSearchQuery(value);
    setVisibleCount(PAGE_SIZE);
    scrollContainer.current?.scrollTo({ top: 0 });
  }

  function applyFilters(filters: MovesFilters) {
    setAppliedFilters(filters);
    setVisibleCount(PAGE_SIZE);
    scrollContainer.current?.scrollTo({ top: 0 });
  }

  function toggleFilterPanel() {
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

  if (loadingState === "loading") {
    return (
      <section
        ref={scrollContainer}
        className="home-content home-content--moves"
        aria-labelledby="moves-page-title"
      >
        <div className="moves-page">
          <header className="moves-page__header">
            <h1 id="moves-page-title">Transactions</h1>
          </header>
        </div>
      </section>
    );
  }

  if (loadingState === "ready" && transactions.length === 0) {
    return (
      <section
        ref={scrollContainer}
        className="home-content home-content--moves"
        aria-labelledby="moves-page-title"
      >
        <div className="moves-page moves-page--empty">
          <header className="moves-page__header">
            <h1 id="moves-page-title">Transactions</h1>
          </header>

          <FirstTransactionEmptyState
            headingId="moves-empty-title"
            onNewTransaction={onNewTransaction}
          />
        </div>
      </section>
    );
  }

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
            {getResultLabel(
              filteredTransactions.length,
              normalizedQuery.length > 0 || activeFilterCount > 0
            )}
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
            appliedFilters={appliedFilters}
            onApply={applyFilters}
          />
        ) : null}

        {loadingState === "ready" && visibleTransactions.length > 0 ? (
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
                    categoryName={transaction.category.name}
                    amount={transaction.amount}
                    description={transaction.description}
                    date={transaction.date}
                  />
                </Fragment>
              );
            })}
          </ul>
        ) : loadingState === "error" ? (
          <div className="moves-empty-state" role="alert">
            <Search aria-hidden="true" />
            <h2>Unable to load transactions</h2>
            <p>Please try again later.</p>
          </div>
        ) : (
          <div className="moves-empty-state" role="status">
            <Search aria-hidden="true" />
            <h2>
              {normalizedQuery || activeFilterCount > 0
                ? "No transactions found"
                : "No transactions yet"}
            </h2>
            <p>
              {normalizedQuery || activeFilterCount > 0
                ? "Try adjusting your search or filters."
                : "Your movements will appear here once you add one."}
            </p>
          </div>
        )}

        {loadingState === "ready" && hasMore ? (
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
