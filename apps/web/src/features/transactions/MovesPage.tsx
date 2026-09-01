import {
  Fragment,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery
} from "@tanstack/react-query";
import { Plus, Search, SlidersHorizontal, X } from "lucide-react";

import { ActionButton } from "../../components/ui/ActionButton";
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
import {
  currencyExchangesQueryOptions,
  CurrencyApiError,
  type CurrencyExchangeListItem
} from "../currency/currency-api";
import { CurrencyExchangeRow } from "./CurrencyExchangeRow";
import { MovesActiveFilterTags } from "./MovesActiveFilterTags";
import { TransactionRow } from "./TransactionRow";
import {
  MovesFiltersPanel,
  type MovesFilterEditor
} from "./MovesFiltersPanel";
import {
  countActiveMovesFilters,
  createEmptyMovesFilters,
  getActiveCategoryIds,
  type MovesFilters
} from "./moves-filters";
import {
  createTransactionListRequest,
  transactionsQueryOptions,
  TransactionApiError,
  type TransactionPreview
} from "./transaction-api";
import { FirstTransactionEmptyState } from "./FirstTransactionEmptyState";
import { TRANSACTION_NAME_MAX_LENGTH } from "./transaction-validation";

const FILTER_PANEL_ID = "moves-filter-panel";

type MovesLoadingState = "loading" | "ready" | "error";

type MovesPageProps = {
  userId: string;
  initialState: MovesPageState;
  onStateChange: (state: MovesPageState) => void;
  onNewTransaction: () => void;
  onTransactionSelect: (
    transaction: TransactionPreview,
    viewportOffset: number | null
  ) => void;
  scrollTarget: MovesScrollTarget | null;
  onScrollTargetHandled: () => void;
  scrollToTopSignal: number;
  onSessionExpired: () => void;
};

export type MovesScrollTarget = {
  transactionId: string;
  viewportOffset: number | null;
  isReady: boolean;
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
    isFilterPanelOpen: false
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

type MoveListEntry =
  | {
      kind: "transaction";
      id: string;
      date: string;
      createdAt: string;
      transaction: TransactionPreview & { createdAt: string };
    }
  | {
      kind: "exchange";
      id: string;
      date: string;
      createdAt: string;
      exchange: CurrencyExchangeListItem;
    };

function hasAmountFilter(filters: MovesFilters) {
  return filters.amountMode === "EXACT"
    ? filters.exactAmount.length > 0
    : filters.minimumAmount.length > 0 ||
        filters.maximumAmount.length > 0;
}

function hasDateFilter(filters: MovesFilters) {
  return filters.dateMode === "EXACT"
    ? filters.exactDate.length > 0
    : filters.startDate.length > 0 || filters.endDate.length > 0;
}

function canShowCurrencyExchanges(
  filters: MovesFilters,
  normalizedSearch: string
) {
  return (
    normalizedSearch.length === 0 &&
    filters.type === "ALL" &&
    !hasAmountFilter(filters) &&
    getActiveCategoryIds(filters).length === 0
  );
}

function isExchangeInDateFilter(
  exchange: CurrencyExchangeListItem,
  filters: MovesFilters
) {
  if (filters.dateMode === "EXACT") {
    return filters.exactDate.length === 0 || exchange.date === filters.exactDate;
  }

  if (filters.startDate && exchange.date < filters.startDate) {
    return false;
  }

  if (filters.endDate && exchange.date > filters.endDate) {
    return false;
  }

  return true;
}

function compareMoveListEntries(left: MoveListEntry, right: MoveListEntry) {
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

function getMovementResultLabel(
  count: number,
  isSearching: boolean,
  hasExchanges: boolean
) {
  if (!hasExchanges) {
    return getResultLabel(count, isSearching);
  }

  if (isSearching) {
    return `${count} ${count === 1 ? "result" : "results"}`;
  }

  return `${count} ${count === 1 ? "move" : "moves"}`;
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
  scrollTarget,
  onScrollTargetHandled,
  scrollToTopSignal,
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
  const transactionRows = useRef(new Map<string, HTMLLIElement>());
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
    firstPage?.metadata?.minimumDate ?? null;
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
  const canShowExchangeRows = canShowCurrencyExchanges(
    appliedFilters,
    normalizedSearchInput
  );
  const currencyExchangesQuery = useQuery({
    ...currencyExchangesQueryOptions(userId),
    enabled: canShowExchangeRows
  });
  const isSearchDebouncing = normalizedSearchInput !== normalizedQuery;
  const isLoadingFilteredResults =
    isSearchDebouncing ||
    (transactionsQuery.isPlaceholderData && transactionsQuery.isFetching);
  const isLoadingExchangeRows =
    canShowExchangeRows && currencyExchangesQuery.isPending;
  const isRestoringEditedTransaction = scrollTarget !== null;
  const isPreparingResults =
    isLoadingFilteredResults ||
    isLoadingExchangeRows ||
    isRestoringEditedTransaction;
  const hasMore = transactionsQuery.hasNextPage;
  const dateFilteredExchanges = useMemo(() => {
    if (!canShowExchangeRows || !currencyExchangesQuery.data) {
      return [];
    }

    return currencyExchangesQuery.data.exchanges.filter((exchange) =>
      isExchangeInDateFilter(exchange, appliedFilters)
    );
  }, [appliedFilters, canShowExchangeRows, currencyExchangesQuery.data]);
  const exchangeResultCount = canShowExchangeRows
    ? hasDateFilter(appliedFilters)
      ? dateFilteredExchanges.length
      : currencyExchangesQuery.data?.pagination.total ??
        dateFilteredExchanges.length
    : 0;
  const oldestLoadedTransactionDate =
    transactions[transactions.length - 1]?.date ?? null;
  const minimumExchangeDate =
    canShowExchangeRows && currencyExchangesQuery.data?.exchanges.length
      ? currencyExchangesQuery.data.exchanges[
          currencyExchangesQuery.data.exchanges.length - 1
        ].date
      : null;
  const minimumMoveDate =
    [minimumTransactionDate, minimumExchangeDate]
      .filter((value): value is string => value !== null)
      .sort()[0] ?? getTodayDateOnly();
  const visibleExchanges = useMemo(() => {
    if (!canShowExchangeRows) {
      return [];
    }

    if (
      transactions.length === 0 ||
      !transactionsQuery.hasNextPage ||
      !oldestLoadedTransactionDate
    ) {
      return dateFilteredExchanges;
    }

    return dateFilteredExchanges.filter(
      (exchange) => exchange.date >= oldestLoadedTransactionDate
    );
  }, [
    canShowExchangeRows,
    dateFilteredExchanges,
    oldestLoadedTransactionDate,
    transactions.length,
    transactionsQuery.hasNextPage
  ]);
  const movementEntries = useMemo<MoveListEntry[]>(
    () =>
      [
        ...transactions.map((transaction) => ({
          kind: "transaction" as const,
          id: transaction.id,
          date: transaction.date,
          createdAt: transaction.createdAt,
          transaction
        })),
        ...visibleExchanges.map((exchange) => ({
          kind: "exchange" as const,
          id: exchange.id,
          date: exchange.date,
          createdAt: exchange.createdAt,
          exchange
        }))
      ].sort(compareMoveListEntries),
    [transactions, visibleExchanges]
  );
  const displayedResultCount = totalResults + exchangeResultCount;
  const hasDisplayedExchanges = exchangeResultCount > 0;
  const accountExchangeCount =
    canShowExchangeRows && !currencyExchangesQuery.isError
      ? currencyExchangesQuery.data?.pagination.total ??
        currencyExchangesQuery.data?.exchanges.length ??
        0
      : 0;

  const registerTransactionRow = useCallback(
    (transactionId: string) => (node: HTMLLIElement | null) => {
      if (node) {
        transactionRows.current.set(transactionId, node);
        return;
      }

      transactionRows.current.delete(transactionId);
    },
    []
  );

  function syncPersistedScrollTop() {
    const root = scrollContainer.current;

    if (!root) {
      return;
    }

    persistedState.current = {
      ...persistedState.current,
      scrollTop: root.scrollTop
    };
  }

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

  useEffect(() => {
    if (scrollToTopSignal > 0 && !scrollTarget) {
      scrollContainer.current?.scrollTo({
        top: 0,
        behavior: "smooth"
      });
      syncPersistedScrollTop();
    }
  }, [scrollTarget, scrollToTopSignal]);

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
    if (
      currencyExchangesQuery.error instanceof CurrencyApiError &&
      currencyExchangesQuery.error.status === 401
    ) {
      onSessionExpired();
    }
  }, [currencyExchangesQuery.error, onSessionExpired]);

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

  useLayoutEffect(() => {
    if (
      !scrollTarget ||
      !scrollTarget.isReady ||
      loadingState !== "ready" ||
      isLoadingFilteredResults ||
      isLoadingExchangeRows
    ) {
      return;
    }

    const targetRow = transactionRows.current.get(
      scrollTarget.transactionId
    );

    if (targetRow) {
      const root = scrollContainer.current;

      if (root) {
        const rootRect = root.getBoundingClientRect();
        const rowRect = targetRow.getBoundingClientRect();
        const currentViewportOffset = rowRect.top - rootRect.top;
        const desiredViewportOffset =
          scrollTarget.viewportOffset ?? currentViewportOffset;
        const targetScrollTop =
          root.scrollTop +
          currentViewportOffset -
          desiredViewportOffset;

        root.scrollTop = Math.max(0, targetScrollTop);
      }

      window.requestAnimationFrame(() => {
        onScrollTargetHandled();
      });
      return;
    }

    if (
      transactionsQuery.hasNextPage &&
      !transactionsQuery.isFetching &&
      !transactionsQuery.isFetchingNextPage
    ) {
      prefetchScheduler.prioritizeUserRequest();
      void transactionsQuery.fetchNextPage();
      return;
    }

    if (
      !transactionsQuery.hasNextPage &&
      !transactionsQuery.isFetching
    ) {
      onScrollTargetHandled();
    }
  }, [
    isLoadingFilteredResults,
    isLoadingExchangeRows,
    loadingState,
    onScrollTargetHandled,
    scrollTarget,
    transactions.length,
    transactionsQuery.fetchNextPage,
    transactionsQuery.hasNextPage,
    transactionsQuery.isFetching,
    transactionsQuery.isFetchingNextPage
  ]);

  function updateSearchQuery(value: string) {
    setSearchQuery(value);
    scrollContainer.current?.scrollTo({ top: 0 });
  }

  function selectTransaction(transaction: TransactionPreview) {
    const root = scrollContainer.current;
    const row = transactionRows.current.get(transaction.id);
    const viewportOffset =
      root && row
        ? row.getBoundingClientRect().top -
          root.getBoundingClientRect().top
        : null;

    onTransactionSelect(transaction, viewportOffset);
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

  if (
    loadingState === "ready" &&
    accountTransactionCount === 0 &&
    !isLoadingExchangeRows &&
    accountExchangeCount === 0
  ) {
    return (
      <section
        ref={scrollContainer}
        className="home-content home-content--moves"
        aria-labelledby="moves-page-title"
        onScroll={syncPersistedScrollTop}
      >
        <div className="moves-page moves-page--empty">
          <header className="moves-page__header">
            <h1 id="moves-page-title">Transactions</h1>
            <div className="moves-page__header-actions">
              <ActionButton
                shape="icon"
                className="moves-new-transaction-button"
                type="button"
                aria-label="New transaction"
                title="New transaction"
                onClick={onNewTransaction}
              >
                <Plus aria-hidden="true" />
              </ActionButton>
            </div>
          </header>

          <FirstTransactionEmptyState
            headingId="moves-empty-title"
            description="Add your first transaction to start building your financial history"
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
      onScroll={syncPersistedScrollTop}
    >
      <div className="moves-page">
        <header className="moves-page__header">
          <h1 id="moves-page-title">Transactions</h1>
          <div className="moves-page__header-actions">
            <ActionButton
              shape="icon"
              className="moves-new-transaction-button"
              type="button"
              aria-label="New transaction"
              title="New transaction"
              onClick={onNewTransaction}
            >
              <Plus aria-hidden="true" />
            </ActionButton>
          </div>
        </header>

        <div className="moves-toolbar">
          <div className="moves-search text-field-shell text-field--search">
            <label className="sr-only" htmlFor="moves-search-input">
              Search transaction names
            </label>
            <Search aria-hidden="true" />
            <input
              id="moves-search-input"
              className="text-field-shell__input"
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              placeholder="Search by name"
              maxLength={TRANSACTION_NAME_MAX_LENGTH}
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

          <ActionButton
            shape="icon"
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
          </ActionButton>
        </div>

        {isFilterPanelOpen ? (
          <MovesFiltersPanel
            id={FILTER_PANEL_ID}
            appliedFilters={appliedFilters}
            minimumDate={minimumMoveDate}
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

        <div
          className={`moves-results-count${
            isFilterPanelOpen ? " moves-results-count--after-filter-panel" : ""
          }`}
        >
          {isPreparingResults ? (
            <SkeletonBlock
              className="moves-results-skeleton__count"
              width={82}
              height={12}
            />
          ) : (
            <p aria-live="polite">
              {getMovementResultLabel(
                displayedResultCount,
                normalizedQuery.length > 0 || activeFilterCount > 0,
                hasDisplayedExchanges
              )}
            </p>
          )}
        </div>

        {isPreparingResults ||
        (loadingState === "ready" && movementEntries.length > 0) ? (
          <div className="moves-results-separator" aria-hidden="true" />
        ) : null}

        {isLoadingFilteredResults || isLoadingExchangeRows ? (
          <TransactionResultsSkeleton />
        ) : loadingState === "ready" && movementEntries.length > 0 ? (
          <div className="moves-results-stage">
            {isRestoringEditedTransaction ? (
              <div className="moves-results-restoring" aria-hidden="true">
                <TransactionResultsSkeleton />
              </div>
            ) : null}
            <ul
              className={`moves-transaction-list${
                isRestoringEditedTransaction
                  ? " moves-transaction-list--restoring"
                  : ""
              }`}
              aria-label="Financial history"
              aria-hidden={isRestoringEditedTransaction}
            >
              {movementEntries.map((entry, index) => {
                const previousEntry = movementEntries[index - 1];
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
                    {entry.kind === "transaction" ? (
                      <TransactionRow
                        ref={registerTransactionRow(entry.transaction.id)}
                        type={entry.transaction.type}
                        categoryId={entry.transaction.categoryId}
                        categoryName={entry.transaction.category.name}
                        amount={entry.transaction.amount}
                        currency={entry.transaction.currency}
                        originalAmount={entry.transaction.originalAmount}
                        description={entry.transaction.description}
                        date={entry.transaction.date}
                        onSelect={() => selectTransaction(entry.transaction)}
                      />
                    ) : (
                      <CurrencyExchangeRow exchange={entry.exchange} />
                    )}
                  </Fragment>
                );
              })}
              {transactionsQuery.isFetchingNextPage
                ? Array.from({ length: 3 }, (_, index) => (
                    <TransactionRowSkeleton key={`loading-${index}`} />
                  ))
                : null}
            </ul>
          </div>
        ) : loadingState === "error" ? (
          <div className="moves-empty-state" role="alert">
            <Search aria-hidden="true" />
            <h2>Unable to load transactions</h2>
            <p>Please try again later</p>
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
                  ? "Try adjusting your search or filters"
                  : "Your movements will appear here once you add one"}
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
