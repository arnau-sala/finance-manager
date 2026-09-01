import { queryOptions } from "@tanstack/react-query";

import { financialQueryKeys } from "../../cache/financial-query-keys";
import {
  FINANCIAL_DATA_GC_TIME_MS,
  FINANCIAL_DATA_STALE_TIME_MS
} from "../../cache/query-client";

export type CurrencyCode = "EUR" | "USD";

type CurrencyApiIssue = {
  field?: string;
  message?: string;
};

type CurrencyApiErrorBody = {
  error?: string;
  message?: string;
  issues?: CurrencyApiIssue[];
};

export type CurrencyExchangeListItem = {
  id: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  fromAmount: string;
  toAmount: string;
  exchangeRateBasePerUsd: string;
  date: string;
  createdAt: string;
  updatedAt: string;
};

export type CurrencyExchangesPage = {
  exchanges: CurrencyExchangeListItem[];
  pagination: {
    limit: number;
    offset: number;
    nextOffset: number | null;
    total?: number;
  };
};

export type CreateCurrencyExchangeInput = {
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  fromAmount: string;
  toAmount: string;
  date: string;
};

export class CurrencyApiError extends Error {
  readonly status: number;
  readonly issues: readonly CurrencyApiIssue[];

  constructor(
    message: string,
    status: number,
    issues: readonly CurrencyApiIssue[] = []
  ) {
    super(message);
    this.name = "CurrencyApiError";
    this.status = status;
    this.issues = issues;
  }
}

async function createCurrencyApiError(
  response: Response,
  fallback = "Unable to save the exchange\nPlease try again"
) {
  let body: CurrencyApiErrorBody = {};

  try {
    body = (await response.json()) as CurrencyApiErrorBody;
  } catch {
    // The fallback remains clearer than exposing a low-level parse error.
  }

  if (response.status === 429) {
    return new CurrencyApiError(
      "Too many attempts\nPlease wait a minute and try again",
      response.status
    );
  }

  const message =
    body.issues?.find((issue) => issue.message)?.message ??
    body.error ??
    body.message ??
    fallback;

  return new CurrencyApiError(message, response.status, body.issues);
}

async function getCurrencyExchangesPage(
  _ownerId: string,
  signal?: AbortSignal
) {
  let response: Response;

  try {
    response = await fetch("/api/currency/exchanges?limit=200", {
      method: "GET",
      credentials: "include",
      signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    throw new CurrencyApiError(
      "Unable to connect\nCheck your connection and try again",
      0
    );
  }

  if (!response.ok) {
    throw await createCurrencyApiError(
      response,
      "Unable to load exchanges\nPlease try again"
    );
  }

  const page = (await response.json()) as CurrencyExchangesPage;

  if (!Array.isArray(page.exchanges) || !page.pagination) {
    throw new CurrencyApiError("Invalid exchanges response", 500);
  }

  return page;
}

export function currencyExchangesQueryOptions(ownerId: string) {
  return queryOptions({
    queryKey: financialQueryKeys.currencyExchanges(ownerId),
    queryFn: ({ signal }) => getCurrencyExchangesPage(ownerId, signal),
    staleTime: FINANCIAL_DATA_STALE_TIME_MS,
    gcTime: FINANCIAL_DATA_GC_TIME_MS
  });
}

export async function createCurrencyExchange(
  input: CreateCurrencyExchangeInput
) {
  let response: Response;

  try {
    response = await fetch("/api/currency/exchanges", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify(input)
    });
  } catch {
    throw new CurrencyApiError(
      "Unable to connect\nCheck your connection and try again",
      0
    );
  }

  if (!response.ok) {
    throw await createCurrencyApiError(response);
  }

  const body = (await response.json()) as {
    exchange?: CurrencyExchangeListItem;
  };

  if (!body.exchange?.id) {
    throw new CurrencyApiError("Invalid exchange response", 500);
  }

  return body.exchange;
}
