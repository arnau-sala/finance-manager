export type HomeMove = {
  id: string;
  type: "INCOME" | "EXPENSE";
  category: {
    id: string;
    name: string;
    type: "INCOME" | "EXPENSE";
  };
  amount: string;
  currency?: "EUR" | "USD";
  originalAmount?: string;
  baseAmount?: string;
  exchangeRateBasePerUsd?: string | null;
  description: string;
  date: string;
};

export type HomeOverview = {
  balance: {
    totalIncome: string;
    totalSpent: string;
    totalBalance: string;
    currentNetWorth: string | null;
  };
  latestMoves: HomeMove[];
  activity: {
    month: number;
    year: number;
    transactionCount: number;
    topExpenseCategory: { id: string; name: string } | null;
    topIncomeCategory: { id: string; name: string } | null;
  };
};

export class HomeApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HomeApiError";
    this.status = status;
  }
}

export async function getHomeOverview(signal?: AbortSignal) {
  const response = await fetch("/api/home", {
    method: "GET",
    credentials: "include",
    signal
  });

  if (!response.ok) {
    throw new HomeApiError("Unable to load your overview", response.status);
  }

  return (await response.json()) as HomeOverview;
}

export function homeOverviewQueryOptions(userId: string) {
  return queryOptions({
    queryKey: financialQueryKeys.home(userId),
    queryFn: ({ signal }) => getHomeOverview(signal),
    staleTime: FINANCIAL_DATA_STALE_TIME_MS,
    gcTime: FINANCIAL_DATA_GC_TIME_MS
  });
}
import { queryOptions } from "@tanstack/react-query";

import { financialQueryKeys } from "../../cache/financial-query-keys";
import {
  FINANCIAL_DATA_GC_TIME_MS,
  FINANCIAL_DATA_STALE_TIME_MS
} from "../../cache/query-client";
