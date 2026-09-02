import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { financialQueryKeys } from "../src/cache/financial-query-keys";
import { ActionButton } from "../src/components/ui/ActionButton";
import {
  FeedbackConfirmationContent,
  SuccessCheckIcon,
} from "../src/components/ui/FeedbackConfirmation";
import { SkeletonBlock } from "../src/components/ui/SkeletonBlock";
import { submitFeedback } from "../src/features/home/feedback-api";
import { getHomeOverview, homeOverviewQueryOptions } from "../src/features/home/home-api";
import {
  createTransaction,
  createTransactionListRequest,
  deleteTransaction,
  getTransactionDetail,
  TransactionApiError,
  transactionsQueryOptions,
  updateTransaction,
} from "../src/features/transactions/transaction-api";
import { createEmptyMovesFilters } from "../src/features/transactions/moves-filters";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("shared UI components", () => {
  it("renders action buttons with shape classes and forwards clicks", async () => {
    const onClick = vi.fn();
    render(<ActionButton shape="icon" onClick={onClick}>Add</ActionButton>);
    const button = screen.getByRole("button", { name: "Add" });
    expect(button).toHaveClass("button-control", "button-control--icon");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders feedback confirmation for identified and anonymous senders", () => {
    const { rerender } = render(
      <FeedbackConfirmationContent
        anonymousLabel="Anonymous"
        message="Add budgets"
        review="I will review it"
        sentLabel="Suggestion sent"
        sender="@arnau"
        email="arnau@example.com"
        summaryLabel="Sent suggestion"
        thanks="Thank you"
      />,
    );
    expect(screen.getByText("@arnau")).toBeInTheDocument();
    expect(screen.getByText("arnau@example.com")).toBeInTheDocument();

    rerender(
      <FeedbackConfirmationContent
        anonymousLabel="Anonymous"
        message="Add budgets"
        review="I will review it"
        sentLabel="Suggestion sent"
        sender={null}
        email={null}
        summaryLabel="Sent suggestion"
        thanks="Thank you"
      />,
    );
    expect(screen.getByText("Anonymous")).toBeInTheDocument();
  });

  it("renders non-interactive loading and success indicators", () => {
    render(<><SkeletonBlock width="4rem" height={12} radius={6} /><SuccessCheckIcon /></>);
    expect(document.querySelector(".skeleton-block")).toHaveStyle({ width: "4rem", height: "12px", borderRadius: "6px" });
    expect(document.querySelector(".success-check-icon")).toBeInTheDocument();
  });
});

describe("home and feedback API clients", () => {
  it("loads home data and exposes stable query options", async () => {
    const overview = { balance: {}, latestMoves: [], activity: {} };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(overview), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getHomeOverview()).resolves.toEqual(overview);
    expect(fetchMock).toHaveBeenCalledWith("/api/home", expect.objectContaining({ credentials: "include" }));
    expect(homeOverviewQueryOptions("user-1").queryKey).toEqual(financialQueryKeys.home("user-1"));
  });

  it("reports failed home and feedback requests", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("", { status: 503 })));
    await expect(getHomeOverview()).rejects.toMatchObject({ status: 503 });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: "Try later", retryAfter: "60" }), { status: 429 })));
    await expect(submitFeedback({ anonymous: false, message: "Hello", type: "general" })).rejects.toMatchObject({ message: "Try later", status: 429 });
  });

  it("submits feedback as JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await submitFeedback({ anonymous: true, message: "Useful", type: "landing" });
    expect(fetchMock).toHaveBeenCalledWith("/api/feedback", expect.objectContaining({ method: "POST", body: JSON.stringify({ anonymous: true, message: "Useful", type: "landing" }) }));
  });
});

describe("transaction API clients", () => {
  const validInput = {
    amount: "12.50",
    type: "EXPENSE" as const,
    description: "Lunch",
    categoryId: "expense-dining",
    date: "2026-08-12",
  };

  it("builds normalized list requests and paginated query URLs", async () => {
    const filters = {
      ...createEmptyMovesFilters(),
      type: "EXPENSE" as const,
      minimumAmount: "10,50",
      startDate: "2026-08-01",
      selectedCategoryIds: ["expense-health", "expense-dining"],
    };
    const request = createTransactionListRequest("  Lunch ", filters);
    expect(request).toMatchObject({
      search: "lunch",
      currency: "ALL",
      minimumAmountCents: 1050,
      categoryIds: ["expense-dining", "expense-health"],
    });

    const usdRequest = createTransactionListRequest("", filters, {
      currency: "USD",
    });

    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({
        transactions: [],
        pagination: { limit: 20, offset: 0, nextOffset: null, total: 0 },
        metadata: { accountTransactionCount: 0, minimumDate: null },
      }), { status: 200 }))
    );
    vi.stubGlobal("fetch", fetchMock);
    const options = transactionsQueryOptions("user-1", request);
    await options.queryFn?.({ pageParam: 0, signal: undefined } as never);
    expect(String(fetchMock.mock.calls[0][0])).toContain("minimumAmountCents=1050");
    expect(String(fetchMock.mock.calls[0][0])).toContain("categories=expense-dining%2Cexpense-health");

    const usdOptions = transactionsQueryOptions("user-1", usdRequest);
    await usdOptions.queryFn?.({ pageParam: 0, signal: undefined } as never);
    expect(String(fetchMock.mock.calls[1][0])).toContain("currency=USD");
  });

  it("creates, updates and deletes transactions with encoded identifiers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await createTransaction(validInput);
    await updateTransaction("tx/1", { description: "Dinner" });
    await deleteTransaction("tx/1");
    expect(fetchMock.mock.calls.map((call) => [call[0], call[1]?.method])).toEqual([
      ["/api/transactions", "POST"],
      ["/api/transactions/tx%2F1", "PATCH"],
      ["/api/transactions/tx%2F1", "DELETE"],
    ]);
  });

  it("validates transaction detail responses", async () => {
    const detail = {
      transaction: { id: "tx-1" },
      trackedBalance: { before: "10.00", after: "5.00" },
      contexts: { month: {}, year: {}, all: {} },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(detail), { status: 200 })));
    await expect(getTransactionDetail("user-1", "tx-1")).resolves.toEqual(detail);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ transaction: { id: "wrong" } }), { status: 200 })));
    await expect(getTransactionDetail("user-1", "tx-1")).rejects.toBeInstanceOf(TransactionApiError);
  });

  it("turns network and rate-limit failures into useful errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(createTransaction(validInput)).rejects.toMatchObject({ status: 0 });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Ignored" }), { status: 429 })));
    await expect(deleteTransaction("tx-1")).rejects.toMatchObject({ status: 429, message: expect.stringContaining("Too many attempts") });
  });
});
