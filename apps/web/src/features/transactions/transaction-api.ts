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

async function createTransactionApiError(response: Response) {
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
    "Unable to add the transaction. Please try again.";

  return new TransactionApiError(message, response.status, body.issues);
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
