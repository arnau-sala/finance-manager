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

type TransactionsPage = {
  transactions: TransactionListItem[];
  pagination: {
    limit: number;
    offset: number;
    nextOffset: number | null;
  };
};

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

export async function getTransactions(signal?: AbortSignal) {
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
}
