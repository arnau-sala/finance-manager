export type StatisticsPeriodCacheKey =
  | { mode: "MONTH"; month: string }
  | { mode: "YEAR"; year: number }
  | { mode: "ALL" };

export type TransactionListCacheKey = {
  search: string;
  type: "ALL" | "INCOME" | "EXPENSE";
  categoryIds: readonly string[];
  exactAmountCents: number | null;
  minimumAmountCents: number | null;
  maximumAmountCents: number | null;
  exactDate: string | null;
  startDate: string | null;
  endDate: string | null;
};

export const financialQueryKeys = {
  root: ["financial-data"] as const,
  user: (userId: string) =>
    [...financialQueryKeys.root, userId] as const,
  home: (userId: string) =>
    [...financialQueryKeys.user(userId), "home"] as const,
  transactions: (userId: string) =>
    [...financialQueryKeys.user(userId), "transactions"] as const,
  transactionLists: (userId: string) =>
    [...financialQueryKeys.transactions(userId), "list"] as const,
  transactionList: (
    userId: string,
    filters: TransactionListCacheKey
  ) =>
    [...financialQueryKeys.transactionLists(userId), filters] as const,
  transactionDetails: (userId: string) =>
    [...financialQueryKeys.transactions(userId), "detail"] as const,
  transactionDetail: (userId: string, transactionId: string) =>
    [
      ...financialQueryKeys.transactionDetails(userId),
      transactionId
    ] as const,
  statistics: (userId: string) =>
    [...financialQueryKeys.user(userId), "statistics"] as const,
  statisticsAvailability: (userId: string) =>
    [...financialQueryKeys.statistics(userId), "availability"] as const,
  statisticsOverviews: (userId: string) =>
    [...financialQueryKeys.statistics(userId), "overview"] as const,
  statisticsOverview: (
    userId: string,
    period: StatisticsPeriodCacheKey
  ) =>
    [
      ...financialQueryKeys.statisticsOverviews(userId),
      period
    ] as const,
  statisticsCharts: (userId: string) =>
    [...financialQueryKeys.statistics(userId), "charts"] as const,
  statisticsChart: (
    userId: string,
    period: StatisticsPeriodCacheKey
  ) =>
    [...financialQueryKeys.statisticsCharts(userId), period] as const
};
