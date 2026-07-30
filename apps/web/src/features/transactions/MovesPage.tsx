import {
  Fragment,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  keepPreviousData,
  useInfiniteQuery
} from "@tanstack/react-query";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { SkeletonBlock } from "../../components/ui/SkeletonBlock";
import {
  cancelTransactionDetailPrefetches,
  scheduleTransactionDetailPrefetches
} from "../../cache/financial-prefetch";
import { prefetchScheduler } from "../../cache/prefetch-scheduler";
import {
  getTodayDateOnly,
  parseLocalDateOnly
} from "../../dates/date-only";
import { MovesActiveFilterTags } from "./MovesActiveFilterTags";
import { TransactionRow } from "./TransactionRow";
import {
  MovesFiltersPanel,
  type MovesFilterEditor
} from "./MovesFiltersPanel";
import {
  countActiveMovesFilters,
  createEmptyMovesFilters,
  type MovesFilters
} from "./moves-filters";
import {
  createTransactionListRequest,
  transactionsQueryOptions,
  TransactionApiError,
  type TransactionPreview
} from "./transaction-api";
import { FirstTransactionEmptyState } from "./FirstTransactionEmptyState";

const FILTER_PANEL_ID = "moves-filter-panel";

type MovesLoadingState = "loading" | "ready" | "error";

type MovesPageProps = {
  userId: string;
  initialState: MovesPageState;
  onStateChange: (state: MovesPageState) => void;
  onNewTransaction: () => void;
  onTransactionSelect: (transaction: TransactionPreview) => void;
  onSessionExpired: () => void;
};

export type MovesPageState = {
  searchQuery: string;
  filters: MovesFilters;
  scrollTop: number;
  isFilterPanelOpen: boolean;
};

export function createInitialMovesPageState(
  filters = createEmptyMovesFilters()
): MovesPageState {
  return {
    searchQuery: "",
    filters: {
      ...filters,
      selectedCategoryIds: [...filters.selectedCategoryIds]
    },
    scrollTop: 0,
    isFilterPanelOpen: countActiveMovesFilters(filters) > 0
  };
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

function getResultLabel(count: number, isSearching: boolean) {
  if (isSearching) {
    return `${count} ${count === 1 ? "result" : "results"}`;
  }

  return `${count} ${count === 1 ? "transaction" : "transactions"}`;
}

function TransactionRowSkeleton() {
  return (
    <li className="transaction-row transaction-row--skeleton" aria-hidden="true">
      <div className="transaction-row__content">
        <SkeletonBlock width={36} height={36} radius="50%" />
        <span className="transaction-row-skeleton__details">
          <SkeletonBlock width="72%" height={14} />
          <SkeletonBlock width="54%" height={11} />
        </span>
        <SkeletonBlock width={62} height={14} />
      </div>
    </li>
  );
}

function MovesPageSkeleton({
  scrollContainer
}: {
  scrollContainer: RefObject<HTMLElement | null>;
}) {
  return (
    <section
      ref={scrollContainer}
      className="home-content home-content--moves"
      aria-labelledby="moves-page-title"
    >
      <div className="moves-page moves-page--skeleton" role="status" aria-busy="true">
        <span className="sr-only">Loading transactions</span>

        <header className="moves-page__header">
          <h1 id="moves-page-title">Transactions</h1>
          <SkeletonBlock width={82} height={12} />
        </header>

        <div className="moves-toolbar" aria-hidden="true">
          <SkeletonBlock width="100%" height={42} radius={14} />
          <SkeletonBlock width={42} height={42} radius={14} />
        </div>

        <ul className="moves-transaction-list" aria-hidden="true">
          <li className="moves-month-divider">
            <SkeletonBlock width={78} height={14} />
          </li>
          {Array.from({ length: 6 }, (_, index) => (
            <TransactionRowSkeleton key={index} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function TransactionResultsSkeleton() {
  return (
    <div
      className="moves-results-skeleton"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Loading transaction results</span>
      <ul className="moves-transaction-list" aria-hidden="true">
        <li className="moves-month-divider">
          <SkeletonBlock width={78} height={14} />
        </li>
        {Array.from({ length: 6 }, (_, index) => (
          <TransactionRowSkeleton key={index} />
        ))}
      </ul>
    </div>
  );
}

export function MovesPage({
  userId,
  initialState,
  onStateChange,
  onNewTransaction,
  onTransactionSelect,
  onSessionExpired
}: MovesPageProps) {
  const [searchQuery, setSearchQuery] = useState(
    initialState.searchQuery
  );
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(
    initialState.searchQuery
  );
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(
    initialState.isFilterPanelOpen
  );
  const [initialFilterEditor, setInitialFilterEditor] =
    useState<MovesFilterEditor | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<MovesFilters>(
    () => ({
      ...initialState.filters,
      selectedCategoryIds: [...initialState.filters.selectedCategoryIds]
    })
  );
  const scrollContainer = useRef<HTMLElement>(null);
  const loadMoreSentinel = useRef<HTMLDivElement>(null);
  const persistedState = useRef(initialState);
  const activeFilterCount = countActiveMovesFilters(appliedFilters);
  const transactionRequest = useMemo(
    () =>
      createTransactionListRequest(
        debouncedSearchQuery,
        appliedFilters
      ),
    [appliedFilters, debouncedSearchQuery]
  );
  const transactionsQuery = useInfiniteQuery({
    ...transactionsQueryOptions(userId, transactionRequest),
    placeholderData: keepPreviousData
  });
  const transactions = useMemo(
    () =>
      transactionsQuery.data?.pages.flatMap(
        (page) => page.transactions
      ) ?? [],
    [transactionsQuery.data]
  );
  const firstPage = transactionsQuery.data?.pages[0];
  const lastPage =
    transactionsQuery.data?.pages[
      transactionsQuery.data.pages.length - 1
    ];
  const totalResults = firstPage?.pagination.total ?? 0;
  const accountTransactionCount =
    firstPage?.metadata?.accountTransactionCount ?? 0;
  const minimumTransactionDate =
    firstPage?.metadata?.minimumDate ?? getTodayDateOnly();
  const loadingState: MovesLoadingState = transactionsQuery.isPending
    ? "loading"
    : transactionsQuery.isError
      ? "error"
      : "ready";
  const normalizedQuery = debouncedSearchQuery
    .trim()
    .toLocaleLowerCase();
  const normalizedSearchInput = searchQuery
    .trim()
    .toLocaleLowerCase();
  const isSearchDebouncing = normalizedSearchInput !== normalizedQuery;
  const isLoadingFilteredResults =
    isSearchDebouncing ||
    (transactionsQuery.isPlaceholderData && transactionsQuery.isFetching);
  const hasMore = transactionsQuery.hasNextPage;

  persistedState.current = {
    searchQuery,
    filters: {
      ...appliedFilters,
      selectedCategoryIds: [...appliedFilters.selectedCategoryIds]
    },
    scrollTop: scrollContainer.current?.scrollTop ?? initialState.scrollTop,
    isFilterPanelOpen
  };

  useLayoutEffect(() => {
    const root = scrollContainer.current;

    if (root) {
      root.scrollTop = initialState.scrollTop;
    }
  }, [initialState.scrollTop]);

  useEffect(
    () => () => {
      onStateChange({
        ...persistedState.current,
        scrollTop:
          scrollContainer.current?.scrollTop ??
          persistedState.current.scrollTop
      });
    },
    [onStateChange]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      prefetchScheduler.prioritizeUserRequest();
      setDebouncedSearchQuery(searchQuery);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (
      transactionsQuery.error instanceof TransactionApiError &&
      transactionsQuery.error.status === 401
    ) {
      onSessionExpired();
    }
  }, [onSessionExpired, transactionsQuery.error]);

  useEffect(() => {
    cancelTransactionDetailPrefetches();

    return cancelTransactionDetailPrefetches;
  }, [transactionRequest, userId]);

  useEffect(() => {
    if (!firstPage) {
      return;
    }

    const detailCandidates = [
      ...firstPage.transactions.slice(0, 3),
      ...(lastPage === firstPage
        ? []
        : (lastPage?.transactions.slice(0, 2) ?? []))
    ];
    const transactionIds = [
      ...new Set(detailCandidates.map((transaction) => transaction.id))
    ].slice(0, 5);

    scheduleTransactionDetailPrefetches(userId, transactionIds);
  }, [firstPage, lastPage, userId]);

  function updateSearchQuery(value: string) {
    setSearchQuery(value);
    scrollContainer.current?.scrollTo({ top: 0 });
  }

  function applyFilters(filters: MovesFilters) {
    prefetchScheduler.prioritizeUserRequest();
    cancelTransactionDetailPrefetches();
    setAppliedFilters(filters);
    setIsFilterPanelOpen(false);
    setInitialFilterEditor(null);
    scrollContainer.current?.scrollTo({ top: 0 });
  }

  function clearFilters() {
    prefetchScheduler.prioritizeUserRequest();
    cancelTransactionDetailPrefetches();
    setAppliedFilters(createEmptyMovesFilters());
    scrollContainer.current?.scrollTo({ top: 0 });
  }

  function toggleFilterPanel() {
    setInitialFilterEditor(null);
    setIsFilterPanelOpen((current) => !current);
  }

  function openFilterEditor(
    filter: "type" | "amount" | "date" | "categories"
  ) {
    setInitialFilterEditor(filter === "type" ? null : filter);
    setIsFilterPanelOpen(true);
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
          if (!transactionsQuery.isFetching) {
            prefetchScheduler.prioritizeUserRequest();
            void transactionsQuery.fetchNextPage();
          }
        }
      },
      {
        root,
        rootMargin: "0px 0px -80px"
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    hasMore,
    transactions.length,
    transactionsQuery.fetchNextPage,
    transactionsQuery.isFetching
  ]);

  if (loadingState === "loading") {
    return <MovesPageSkeleton scrollContainer={scrollContainer} />;
  }

  if (loadingState === "ready" && accountTransactionCount === 0) {
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
          {isLoadingFilteredResults ? (
            <SkeletonBlock
              className="moves-results-skeleton__count"
              width={82}
              height={12}
            />
          ) : (
            <p aria-live="polite">
              {getResultLabel(
                totalResults,
                normalizedQuery.length > 0 || activeFilterCount > 0
              )}
            </p>
          )}
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
            minimumDate={minimumTransactionDate}
            initialEditor={initialFilterEditor}
            onApply={applyFilters}
            onClear={clearFilters}
          />
        ) : null}

        {!isFilterPanelOpen && activeFilterCount > 0 ? (
          <MovesActiveFilterTags
            filters={appliedFilters}
            onFilterSelect={openFilterEditor}
          />
        ) : null}

        {isLoadingFilteredResults ? (
          <TransactionResultsSkeleton />
        ) : loadingState === "ready" && transactions.length > 0 ? (
          <ul className="moves-transaction-list" aria-label="Transaction history">
            {transactions.map((transaction, index) => {
              const previousTransaction = transactions[index - 1];
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
                    onSelect={() => onTransactionSelect(transaction)}
                  />
                </Fragment>
              );
            })}
            {transactionsQuery.isFetchingNextPage
              ? Array.from({ length: 3 }, (_, index) => (
                  <TransactionRowSkeleton key={`loading-${index}`} />
                ))
              : null}
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
