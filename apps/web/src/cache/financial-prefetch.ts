import type {
  FetchQueryOptions,
  QueryKey
} from "@tanstack/react-query";

import {
  statisticsAvailabilityQueryOptions,
  statisticsChartsQueryOptions,
  statisticsOverviewQueryOptions,
  type StatisticsPeriodRequest
} from "../features/statistics/statistics-api";
import {
  createTransactionListRequest,
  transactionDetailQueryOptions,
  TRANSACTION_DETAILS_PREFETCH_GROUP,
  transactionsQueryOptions
} from "../features/transactions/transaction-api";
import {
  createEmptyMovesFilters,
  type MovesFilters
} from "../features/transactions/moves-filters";
import { prefetchScheduler } from "./prefetch-scheduler";
import { queryClient } from "./query-client";

const HOME_PREFETCH_GROUP = "home-follow-up";
const STATS_PREFETCH_GROUP = "statistics-follow-up";
const STATS_CODE_PREFETCH_GROUP = "statistics-code";

function getTaskId(kind: string, queryKey: QueryKey) {
  return `${kind}:${JSON.stringify(queryKey)}`;
}

function scheduleQueryPrefetch<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends QueryKey
>(
  group: string,
  priority: number,
  options: FetchQueryOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryKey
  >
) {
  prefetchScheduler.schedule({
    id: getTaskId("query", options.queryKey),
    group,
    priority,
    run: () => queryClient.prefetchQuery(options),
    cancel: () =>
      queryClient.cancelQueries({
        queryKey: options.queryKey,
        exact: true
      })
  });
}

function scheduleTransactionsPrefetch(
  userId: string,
  filters: MovesFilters,
  priority: number
) {
  const request = createTransactionListRequest("", filters);
  const options = transactionsQueryOptions(userId, request);

  prefetchScheduler.schedule({
    id: getTaskId("infinite-query", options.queryKey),
    group: HOME_PREFETCH_GROUP,
    priority,
    run: () => queryClient.prefetchInfiniteQuery(options),
    cancel: () =>
      queryClient.cancelQueries({
        queryKey: options.queryKey,
        exact: true
      })
  });
}

function getCurrentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

function getPreviousMonthKey(currentMonth: string) {
  const [year, month] = currentMonth.split("-").map(Number);
  const date = new Date(year, month - 2, 1);

  return getCurrentMonthKey(date);
}

export function scheduleHomePrefetches(userId: string) {
  const currentMonth = getCurrentMonthKey();

  scheduleTransactionsPrefetch(
    userId,
    createEmptyMovesFilters(),
    10
  );
  scheduleQueryPrefetch(
    HOME_PREFETCH_GROUP,
    20,
    statisticsAvailabilityQueryOptions(userId)
  );
  scheduleQueryPrefetch(
    HOME_PREFETCH_GROUP,
    30,
    statisticsOverviewQueryOptions(userId, {
      mode: "MONTH",
      month: currentMonth
    })
  );
}

export function scheduleStatisticsPrefetches(
  userId: string,
  loadChartsModule: () => Promise<unknown>
) {
  const currentMonth = getCurrentMonthKey();
  const currentYear = Number(currentMonth.slice(0, 4));
  const previousMonth = getPreviousMonthKey(currentMonth);
  const currentMonthPeriod: StatisticsPeriodRequest = {
    mode: "MONTH",
    month: currentMonth
  };
  const currentYearPeriod: StatisticsPeriodRequest = {
    mode: "YEAR",
    year: currentYear
  };
  const previousMonthPeriod: StatisticsPeriodRequest = {
    mode: "MONTH",
    month: previousMonth
  };
  const allPeriod: StatisticsPeriodRequest = { mode: "ALL" };

  prefetchScheduler.schedule({
    id: "statistics:charts-module",
    group: STATS_CODE_PREFETCH_GROUP,
    priority: 5,
    run: loadChartsModule
  });
  scheduleQueryPrefetch(
    STATS_PREFETCH_GROUP,
    10,
    statisticsChartsQueryOptions(userId, currentMonthPeriod)
  );
  scheduleQueryPrefetch(
    STATS_PREFETCH_GROUP,
    20,
    statisticsOverviewQueryOptions(userId, currentYearPeriod)
  );
  scheduleQueryPrefetch(
    STATS_PREFETCH_GROUP,
    30,
    statisticsOverviewQueryOptions(userId, previousMonthPeriod)
  );
  scheduleQueryPrefetch(
    STATS_PREFETCH_GROUP,
    40,
    statisticsChartsQueryOptions(userId, currentYearPeriod)
  );
  scheduleQueryPrefetch(
    STATS_PREFETCH_GROUP,
    50,
    statisticsOverviewQueryOptions(userId, allPeriod)
  );
  scheduleQueryPrefetch(
    STATS_PREFETCH_GROUP,
    60,
    statisticsChartsQueryOptions(userId, allPeriod)
  );
}

export function scheduleTransactionDetailPrefetches(
  userId: string,
  transactionIds: readonly string[]
) {
  transactionIds.forEach((transactionId, index) => {
    scheduleQueryPrefetch(
      TRANSACTION_DETAILS_PREFETCH_GROUP,
      10 + index,
      transactionDetailQueryOptions(userId, transactionId)
    );
  });
}

export function cancelTransactionDetailPrefetches() {
  prefetchScheduler.cancelGroup(TRANSACTION_DETAILS_PREFETCH_GROUP);
}
