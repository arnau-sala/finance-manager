import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  CurrencyLedgerError,
  getExchangeRateBasePerUsd,
  rebuildUsdLedger,
} from "../src/services/currency-ledger-service.js";

function createLedgerClientMock(input: {
  exchanges?: unknown[];
  transactions?: unknown[];
}) {
  return {
    currencyExchange: {
      findMany: vi.fn().mockResolvedValue(input.exchanges ?? []),
    },
    transaction: {
      findMany: vi.fn().mockResolvedValue(input.transactions ?? []),
      update: vi.fn().mockResolvedValue({}),
    },
  } as unknown as Prisma.TransactionClient;
}

describe("currency ledger", () => {
  it("calculates the exact EUR cost per USD from exchanged amounts", () => {
    const rate = getExchangeRateBasePerUsd({
      fromCurrency: "EUR",
      toCurrency: "USD",
      fromAmountMinor: 50001,
      toAmountMinor: 57682,
    });

    expect(rate.toFixed(20)).toBe("0.86683887521237127700");
  });

  it("allocates USD expenses with the weighted average cost basis", async () => {
    const client = createLedgerClientMock({
      exchanges: [
        {
          id: "exchange-1",
          fromCurrency: "EUR",
          toCurrency: "USD",
          fromAmountMinor: 50001,
          toAmountMinor: 57682,
          exchangeRateBasePerUsd: new Prisma.Decimal(
            "0.86683887521237127700",
          ),
          occurredOn: new Date("2026-01-01T00:00:00.000Z"),
          createdAt: new Date("2026-01-01T10:00:00.000Z"),
        },
      ],
      transactions: [
        {
          id: "transaction-1",
          type: "EXPENSE",
          amountCents: 1,
          currency: "USD",
          originalAmountMinor: 500,
          exchangeRateBasePerUsd: null,
          occurredOn: new Date("2026-01-02T00:00:00.000Z"),
          createdAt: new Date("2026-01-02T10:00:00.000Z"),
        },
      ],
    });

    const wallet = await rebuildUsdLedger("user-1", client);

    expect(wallet).toEqual({
      currency: "USD",
      balanceMinor: 57182,
      costBasisMinor: 49568,
      averageRateBasePerUsd: "0.86683887521237127701",
    });
    expect(client.transaction.update).toHaveBeenCalledWith({
      where: { id: "transaction-1" },
      data: expect.objectContaining({
        amountCents: 433,
        originalAmountMinor: 500,
      }),
    });
  });

  it("uses a weighted average after multiple USD purchases", async () => {
    const client = createLedgerClientMock({
      exchanges: [
        {
          id: "exchange-1",
          fromCurrency: "EUR",
          toCurrency: "USD",
          fromAmountMinor: 10000,
          toAmountMinor: 10000,
          exchangeRateBasePerUsd: new Prisma.Decimal("1"),
          occurredOn: new Date("2026-01-01T00:00:00.000Z"),
          createdAt: new Date("2026-01-01T10:00:00.000Z"),
        },
        {
          id: "exchange-2",
          fromCurrency: "EUR",
          toCurrency: "USD",
          fromAmountMinor: 10000,
          toAmountMinor: 20000,
          exchangeRateBasePerUsd: new Prisma.Decimal("0.5"),
          occurredOn: new Date("2026-01-02T00:00:00.000Z"),
          createdAt: new Date("2026-01-02T10:00:00.000Z"),
        },
      ],
      transactions: [
        {
          id: "transaction-1",
          type: "EXPENSE",
          amountCents: 1,
          currency: "USD",
          originalAmountMinor: 300,
          exchangeRateBasePerUsd: null,
          occurredOn: new Date("2026-01-03T00:00:00.000Z"),
          createdAt: new Date("2026-01-03T10:00:00.000Z"),
        },
      ],
    });

    await rebuildUsdLedger("user-1", client);

    expect(client.transaction.update).toHaveBeenCalledWith({
      where: { id: "transaction-1" },
      data: expect.objectContaining({
        amountCents: 200,
        originalAmountMinor: 300,
      }),
    });
  });

  it("rejects USD spending without enough wallet balance", async () => {
    const client = createLedgerClientMock({
      transactions: [
        {
          id: "transaction-1",
          type: "EXPENSE",
          amountCents: 1,
          currency: "USD",
          originalAmountMinor: 100,
          exchangeRateBasePerUsd: null,
          occurredOn: new Date("2026-01-02T00:00:00.000Z"),
          createdAt: new Date("2026-01-02T10:00:00.000Z"),
        },
      ],
    });

    await expect(rebuildUsdLedger("user-1", client)).rejects.toMatchObject({
      code: "INSUFFICIENT_USD_BALANCE",
    } satisfies Partial<CurrencyLedgerError>);
  });
});
