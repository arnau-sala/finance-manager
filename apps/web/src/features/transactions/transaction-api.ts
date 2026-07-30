import {
  infiniteQueryOptions,
  queryOptions
} from "@tanstack/react-query";

import {
  financialQueryKeys,
  type TransactionListCacheKey
} from "../../cache/financial-query-keys";
import {
  FINANCIAL_DATA_GC_TIME_MS,
  FINANCIAL_DATA_STALE_TIME_MS,
  TRANSACTION_DETAIL_GC_TIME_MS
} from "../../cache/query-client";
import {
  getActiveCategoryIds,
  type MovesFilters
} from "./moves-filters";
import type { CreateTransactionInput } from "./transaction-validation";

type TransactionApiIssue = {
  field?: string;
  message?: string;
};

type TransactionApiErrorBody = {
  error?: string;
  message?: string;
  issues?: TransactionApiIssue[];
};

export type TransactionListItem = {
  id: string;
  type: "INCOME" | "EXPENSE";
  categoryId: string;
  category: {
    id: string;
    name: string;
    type: "INCOME" | "EXPENSE";
  };
  amount: string;
  description: string;
  date: string;
  createdAt: string;
};

export type TransactionPreview = Omit<TransactionListItem, "createdAt">;

export type TransactionDetailContext = {
  categoryRank: {
    position: number;
    total: number;
  };
  typeRank: {
    position: number;
    total: number;
  };
  periodImpactPercentage: number;
};

export type TransactionDetail = {
  transaction: TransactionListItem;
  trackedBalance: {
    before: string;
    after: string;
  };
  contexts: {
    month: TransactionDetailContext;
    year: TransactionDetailContext;
    all: TransactionDetailContext;
  };
};

export type TransactionsPage = {
  transactions: TransactionListItem[];
  pagination: {
    limit: number;
    offset: number;
    nextOffset: number | null;
    total: number;
  };
  metadata: {
    accountTransactionCount: number;
    minimumDate: string | null;
  } | null;
};

export const TRANSACTIONS_PAGE_SIZE = 20;
export const TRANSACTION_DETAILS_PREFETCH_GROUP =
  "transaction-details";

export class TransactionApiError extends Error {
  readonly status: number;
  readonly issues: readonly TransactionApiIssue[];

  constructor(
    message: string,
    status: number,
    issues: readonly TransactionApiIssue[] = []
  ) {
    super(message);
    this.name = "TransactionApiError";
    this.status = status;
    this.issues = issues;
  }
}

function parseAmountCents(value: string) {
  const amount = Number(value.trim().replace(",", "."));

  if (!Number.isFinite(amount)) {
    return null;
  }

  return Math.round(amount * 100);
}

export function createTransactionListRequest(
  search: string,
  filters: MovesFilters
): TransactionListCacheKey {
  const exactAmountCents =
    filters.amountMode === "EXACT" && filters.exactAmount
      ? parseAmountCents(filters.exactAmount)
      : null;
  const minimumAmountCents =
    filters.amountMode === "RANGE" && filters.minimumAmount
      ? parseAmountCents(filters.minimumAmount)
      : null;
  const maximumAmountCents =
    filters.amountMode === "RANGE" && filters.maximumAmount
      ? parseAmountCents(filters.maximumAmount)
      : null;

  return {
    search: search.trim().toLocaleLowerCase(),
    type: filters.type,
    categoryIds: [...getActiveCategoryIds(filters)].sort(),
    exactAmountCents,
    minimumAmountCents,
    maximumAmountCents,
    exactDate:
      filters.dateMode === "EXACT" && filters.exactDate
        ? filters.exactDate
        : null,
    startDate:
      filters.dateMode === "RANGE" && filters.startDate
        ? filters.startDate
        : null,
    endDate:
      filters.dateMode === "RANGE" && filters.endDate
        ? filters.endDate
        : null
  };
}

async function createTransactionApiError(
  response: Response,
  fallback = "Unable to add the transaction. Please try again."
) {
  let body: TransactionApiErrorBody = {};

  try {
    body = (await response.json()) as TransactionApiErrorBody;
  } catch {
    // The status-specific fallback remains safe without a JSON body.
  }

  if (response.status === 429) {
    return new TransactionApiError(
      "Too many attempts. Please wait a minute and try again.",
      response.status
    );
  }

  const message =
    body.issues?.find((issue) => issue.message)?.message ??
    body.error ??
    body.message ??
    fallback;

  return new TransactionApiError(message, response.status, body.issues);
}

function addOptionalQueryValue(
  query: URLSearchParams,
  key: string,
  value: string | number | null
) {
  if (value !== null && value !== "") {
    query.set(key, String(value));
  }
}

function createTransactionsQuery(
  request: TransactionListCacheKey,
  offset: number
) {
  const query = new URLSearchParams({
    limit: String(TRANSACTIONS_PAGE_SIZE),
    offset: String(offset)
  });

  addOptionalQueryValue(query, "search", request.search);
  addOptionalQueryValue(
    query,
    "type",
    request.type === "ALL" ? null : request.type
  );
  addOptionalQueryValue(
    query,
    "categories",
    request.categoryIds.length > 0
      ? request.categoryIds.join(",")
      : null
  );
  addOptionalQueryValue(
    query,
    "exactAmountCents",
    request.exactAmountCents
  );
  addOptionalQueryValue(
    query,
    "minimumAmountCents",
    request.minimumAmountCents
  );
  addOptionalQueryValue(
    query,
    "maximumAmountCents",
    request.maximumAmountCents
  );
  addOptionalQueryValue(query, "exactDate", request.exactDate);
  addOptionalQueryValue(query, "startDate", request.startDate);
  addOptionalQueryValue(query, "endDate", request.endDate);

  return query;
}

async function getTransactionsPage(
  request: TransactionListCacheKey,
  offset: number,
  signal?: AbortSignal
) {
  let response: Response;

  try {
    response = await fetch(
      `/api/transactions?${createTransactionsQuery(request, offset)}`,
      {
        method: "GET",
        credentials: "include",
        signal
      }
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    throw new TransactionApiError(
      "Unable to connect. Check your connection and try again.",
      0
    );
  }

  if (!response.ok) {
    throw await createTransactionApiError(
      response,
      "Unable to load transactions. Please try again."
    );
  }

  const page = (await response.json()) as TransactionsPage;

  if (
    !Array.isArray(page.transactions) ||
    !page.pagination ||
    page.pagination.offset !== offset ||
    (offset === 0 && !page.metadata)
  ) {
    throw new TransactionApiError("Invalid transactions response.", 500);
  }

  return page;
}

export function transactionsQueryOptions(
  ownerId: string,
  request: TransactionListCacheKey
) {
  return infiniteQueryOptions({
    queryKey: financialQueryKeys.transactionList(ownerId, request),
    queryFn: ({ pageParam, signal }) =>
      getTransactionsPage(request, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.nextOffset ?? undefined,
    staleTime: FINANCIAL_DATA_STALE_TIME_MS,
    gcTime: FINANCIAL_DATA_GC_TIME_MS
  });
}

export function transactionDetailQueryOptions(
  ownerId: string,
  transactionId: string
) {
  return queryOptions({
    queryKey: financialQueryKeys.transactionDetail(
      ownerId,
      transactionId
    ),
    queryFn: ({ signal }) =>
      getTransactionDetail(ownerId, transactionId, signal),
    staleTime: FINANCIAL_DATA_STALE_TIME_MS,
    gcTime: TRANSACTION_DETAIL_GC_TIME_MS
  });
}

export async function createTransaction(input: CreateTransactionInput) {
  let response: Response;

  try {
    response = await fetch("/api/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify(input)
    });
  } catch {
    throw new TransactionApiError(
      "Unable to connect. Check your connection and try again.",
      0
    );
  }

  if (!response.ok) {
    throw await createTransactionApiError(response);
  }
}

export async function updateTransaction(
  transactionId: string,
  input: Partial<CreateTransactionInput>
) {
  let response: Response;

  try {
    response = await fetch(
      `/api/transactions/${encodeURIComponent(transactionId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(input)
      }
    );
  } catch {
    throw new TransactionApiError(
      "Unable to connect. Check your connection and try again.",
      0
    );
  }

  if (!response.ok) {
    throw await createTransactionApiError(
      response,
      "Unable to update the transaction. Please try again."
    );
  }
}

export async function deleteTransaction(transactionId: string) {
  let response: Response;

  try {
    response = await fetch(
      `/api/transactions/${encodeURIComponent(transactionId)}`,
      {
        method: "DELETE",
        credentials: "include"
      }
    );
  } catch {
    throw new TransactionApiError(
      "Unable to connect. Check your connection and try again.",
      0
    );
  }

  if (!response.ok) {
    throw await createTransactionApiError(
      response,
      "Unable to delete the transaction. Please try again."
    );
  }
}

export async function getTransactionDetail(
  _ownerId: string,
  transactionId: string,
  signal?: AbortSignal
) {
  let response: Response;

  try {
    response = await fetch(
      `/api/transactions/${encodeURIComponent(transactionId)}`,
      {
        method: "GET",
        credentials: "include",
        signal
      }
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    throw new TransactionApiError(
      "Unable to connect. Check your connection and try again.",
      0
    );
  }

  if (!response.ok) {
    throw await createTransactionApiError(
      response,
      "Unable to load the transaction details. Please try again."
    );
  }

  const detail = (await response.json()) as TransactionDetail;

  if (
    detail.transaction?.id !== transactionId ||
    !detail.trackedBalance ||
    !detail.contexts?.month ||
    !detail.contexts?.year ||
    !detail.contexts?.all
  ) {
    throw new TransactionApiError(
      "Invalid transaction detail response.",
      500
    );
  }

  return detail;
}
