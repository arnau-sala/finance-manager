import { queryOptions } from "@tanstack/react-query";

import { financialQueryKeys } from "../../cache/financial-query-keys";
import {
  FINANCIAL_DATA_GC_TIME_MS,
  FINANCIAL_DATA_STALE_TIME_MS
} from "../../cache/query-client";
import type { TransactionListItem } from "./transaction-api";
import type { TransactionCurrencyCode } from "./transaction-validation";

type ApiIssue = { field?: string; message?: string };
type ApiErrorBody = { error?: string; message?: string; issues?: ApiIssue[] };

export type TransactionGroupLineInput = {
  type: "INCOME" | "EXPENSE";
  title: string;
  amount: string;
  currency: TransactionCurrencyCode;
  baseAmount?: string;
};

export type TransactionGroupInput = {
  title: string;
  categoryId: string;
  date: string;
  transactions: TransactionGroupLineInput[];
};

export type TransactionGroupListItem = {
  id: string;
  title: string;
  categoryId: string;
  category: {
    id: string;
    name: string;
    type: "INCOME" | "EXPENSE";
  };
  date: string;
  netTotal: string;
  netTotalCents: number;
  transactions: TransactionListItem[];
  createdAt: string;
  updatedAt: string;
};

export type TransactionGroupsPage = {
  groups: TransactionGroupListItem[];
  pagination: {
    limit: number;
    offset: number;
    nextOffset: number | null;
    total: number;
  };
};

export class TransactionGroupApiError extends Error {
  readonly status: number;
  readonly issues: readonly ApiIssue[];

  constructor(message: string, status: number, issues: readonly ApiIssue[] = []) {
    super(message);
    this.name = "TransactionGroupApiError";
    this.status = status;
    this.issues = issues;
  }
}

async function createTransactionGroupApiError(
  response: Response,
  fallback = "Unable to save the transaction group\nPlease try again"
) {
  let body: ApiErrorBody = {};

  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // Keep fallback.
  }

  const message =
    body.issues?.find((issue) => issue.message)?.message ??
    body.error ??
    body.message ??
    fallback;

  return new TransactionGroupApiError(message, response.status, body.issues);
}

async function sendGroupRequest<T>(
  path: string,
  options: RequestInit,
  fallback?: string
) {
  let response: Response;

  try {
    response = await fetch(path, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers
      }
    });
  } catch {
    throw new TransactionGroupApiError(
      "Unable to connect\nCheck your connection and try again",
      0
    );
  }

  if (!response.ok) {
    throw await createTransactionGroupApiError(response, fallback);
  }

  return (await response.json()) as T;
}

export async function getTransactionGroups(signal?: AbortSignal) {
  return sendGroupRequest<TransactionGroupsPage>(
    "/api/transaction-groups?limit=200",
    { method: "GET", signal },
    "Unable to load transaction groups\nPlease try again"
  );
}

export function transactionGroupsQueryOptions(userId: string) {
  return queryOptions({
    queryKey: financialQueryKeys.transactionGroups(userId),
    queryFn: ({ signal }) => getTransactionGroups(signal),
    staleTime: FINANCIAL_DATA_STALE_TIME_MS,
    gcTime: FINANCIAL_DATA_GC_TIME_MS
  });
}

export async function createTransactionGroup(input: TransactionGroupInput) {
  return sendGroupRequest<{ group: TransactionGroupListItem }>(
    "/api/transaction-groups",
    { method: "POST", body: JSON.stringify(input) }
  );
}

export async function createTransactionGroupFromTransaction(
  transactionId: string,
  input: TransactionGroupInput
) {
  return sendGroupRequest<{ group: TransactionGroupListItem }>(
    `/api/transaction-groups/from-transaction/${encodeURIComponent(transactionId)}`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export async function updateTransactionGroup(
  groupId: string,
  input: Partial<Pick<TransactionGroupInput, "title" | "categoryId" | "date">>
) {
  return sendGroupRequest<{ group: TransactionGroupListItem }>(
    `/api/transaction-groups/${encodeURIComponent(groupId)}`,
    { method: "PATCH", body: JSON.stringify(input) },
    "Unable to update the transaction group\nPlease try again"
  );
}

export async function deleteTransactionGroup(groupId: string) {
  return sendGroupRequest<{ message: string }>(
    `/api/transaction-groups/${encodeURIComponent(groupId)}`,
    { method: "DELETE" },
    "Unable to delete the transaction group\nPlease try again"
  );
}

export async function addGroupTransaction(
  groupId: string,
  input: TransactionGroupLineInput
) {
  return sendGroupRequest<{ group: TransactionGroupListItem }>(
    `/api/transaction-groups/${encodeURIComponent(groupId)}/transactions`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export async function updateGroupTransaction(
  groupId: string,
  transactionId: string,
  input: Partial<TransactionGroupLineInput>
) {
  return sendGroupRequest<{ group: TransactionGroupListItem }>(
    `/api/transaction-groups/${encodeURIComponent(groupId)}/transactions/${encodeURIComponent(transactionId)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
}

export async function deleteGroupTransaction(
  groupId: string,
  transactionId: string
) {
  return sendGroupRequest<
    { group: TransactionGroupListItem } | { message: string; promotedTransactionId?: string | null }
  >(
    `/api/transaction-groups/${encodeURIComponent(groupId)}/transactions/${encodeURIComponent(transactionId)}`,
    { method: "DELETE" },
    "Unable to delete the group transaction\nPlease try again"
  );
}

export async function reorderGroupTransactions(
  groupId: string,
  transactionIds: string[]
) {
  return sendGroupRequest<{ group: TransactionGroupListItem }>(
    `/api/transaction-groups/${encodeURIComponent(groupId)}/transactions/reorder`,
    { method: "PATCH", body: JSON.stringify({ transactionIds }) }
  );
}
