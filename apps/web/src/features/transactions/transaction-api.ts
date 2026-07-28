import { ExpiringMemoryCache } from "../../cache/expiring-memory-cache";
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

type TransactionsPage = {
  transactions: TransactionListItem[];
  pagination: {
    limit: number;
    offset: number;
    nextOffset: number | null;
  };
};

const TRANSACTIONS_CACHE_TTL_MS = 30_000;
const transactionsCache = new ExpiringMemoryCache<TransactionListItem[]>(
  TRANSACTIONS_CACHE_TTL_MS
);
const transactionDetailsCache = new ExpiringMemoryCache<TransactionDetail>(
  TRANSACTIONS_CACHE_TTL_MS
);

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

async function createTransactionApiError(
  response: Response,
  fallback = "Unable to add the transaction. Please try again."
) {
  let body: TransactionApiErrorBody = {};

  try {
    body = (await response.json()) as TransactionApiErrorBody;
  } catch {
    // The status-specific fallback below remains safe when no JSON body exists.
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

export async function getTransactions(
  ownerId: string,
  signal?: AbortSignal
) {
  const cached = transactionsCache.get(ownerId);

  if (cached !== null) {
    return cached;
  }

  const transactions: TransactionListItem[] = [];
  let offset = 0;

  while (true) {
    let response: Response;

    try {
      response = await fetch(`/api/transactions?limit=200&offset=${offset}`, {
        method: "GET",
        credentials: "include",
        signal
      });
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
      page.pagination.offset !== offset
    ) {
      throw new TransactionApiError("Invalid transactions response.", 500);
    }

    transactions.push(...page.transactions);

    if (page.pagination.nextOffset === null) {
      transactionsCache.set(ownerId, transactions);
      return transactions;
    }

    if (page.pagination.nextOffset <= offset) {
      throw new TransactionApiError("Invalid transactions pagination.", 500);
    }

    offset = page.pagination.nextOffset;
  }
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

  transactionsCache.clear();
  transactionDetailsCache.clear();
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

  transactionsCache.clear();
  transactionDetailsCache.clear();
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

  transactionsCache.clear();
  transactionDetailsCache.clear();
}

export async function getTransactionDetail(
  ownerId: string,
  transactionId: string,
  signal?: AbortSignal
) {
  const cacheKey = `${ownerId}:${transactionId}`;
  const cached = transactionDetailsCache.get(cacheKey);

  if (cached !== null) {
    return cached;
  }

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

  transactionDetailsCache.set(cacheKey, detail);
  return detail;
}

export function clearTransactionsCache() {
  transactionsCache.clear();
  transactionDetailsCache.clear();
}
