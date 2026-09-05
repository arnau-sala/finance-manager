import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TransactionComposer } from "../src/features/transactions/TransactionComposer";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });
}

function renderWithQueryClient(children: ReactNode) {
  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

async function fillRequiredExpenseFields() {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText("Amount"), "12,50");
  await user.type(screen.getByLabelText("Name"), "Coffee");
  await user.click(screen.getByRole("button", { name: "Dining" }));

  return user;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn()
  });
});

describe("TransactionComposer currency selection", () => {
  it("normalizes an invalid initial currency before rendering and submitting", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(
      <TransactionComposer
        userId="user-1"
        open
        transaction={null}
        initialCurrency={{ nativeEvent: "click" } as never}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        onUpdated={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    expect(screen.getByRole("radio", { name: "\u20ac" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("radio", { name: "$" })).toHaveAttribute(
      "aria-checked",
      "false"
    );

    const user = await fillRequiredExpenseFields();
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      amount: "12.50",
      currency: "EUR"
    });
  });

  it("keeps the selector value and submitted currency synchronized after switching", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(
      <TransactionComposer
        userId="user-1"
        open
        transaction={null}
        initialCurrency="EUR"
        onClose={vi.fn()}
        onCreated={vi.fn()}
        onUpdated={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "$" }));

    expect(screen.getByRole("radio", { name: "\u20ac" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByRole("radio", { name: "$" })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    await user.type(screen.getByLabelText("Amount"), "12,50");
    await user.type(screen.getByLabelText("Name"), "Coffee");
    await user.click(screen.getByRole("button", { name: "Dining" }));
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      amount: "12.50",
      currency: "USD"
    });
  });
});
