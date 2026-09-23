import Fastify from "fastify";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const authMocks = vi.hoisted(() => ({
  getAuthenticatedUserId: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  categoryFindUnique: vi.fn(),
  transactionGroupFindFirst: vi.fn(),
  transactionGroupCreate: vi.fn(),
  transactionGroupDelete: vi.fn(),
  transactionGroupUpdate: vi.fn(),
  transactionCreate: vi.fn(),
  transactionUpdate: vi.fn(),
  transactionDelete: vi.fn(),
  transactionFindMany: vi.fn(),
  transactionUpdateMany: vi.fn(),
  transactionFindManyLedger: vi.fn(),
  currencyExchangeFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../src/auth/authenticated-user.js", () => authMocks);
vi.mock("../src/db/client.js", () => ({
  db: {
    category: { findUnique: dbMocks.categoryFindUnique },
    transactionGroup: {
      findFirst: dbMocks.transactionGroupFindFirst,
      create: dbMocks.transactionGroupCreate,
      delete: dbMocks.transactionGroupDelete,
      update: dbMocks.transactionGroupUpdate,
    },
    transaction: {
      create: dbMocks.transactionCreate,
      update: dbMocks.transactionUpdate,
      delete: dbMocks.transactionDelete,
      findMany: dbMocks.transactionFindMany,
      updateMany: dbMocks.transactionUpdateMany,
    },
    currencyExchange: { findMany: dbMocks.currencyExchangeFindMany },
    $transaction: dbMocks.transaction,
  },
}));

import { getNetOperationSummary } from "../src/services/financial-operations.js";
import { transactionGroupRoutes } from "../src/routes/transaction-groups.js";

const category = { id: "cat-1", name: "Dining", type: "EXPENSE" as const };
const createdAt = new Date("2026-01-01T10:00:00.000Z");
const occurredOn = new Date("2026-01-10T00:00:00.000Z");

function createGroup(transactions: Array<{
  id: string;
  type: "INCOME" | "EXPENSE";
  amountCents: number;
  description?: string;
  groupOrder?: number;
}>) {
  return {
    id: "group-1",
    userId: "user-1",
    title: "Trip",
    categoryId: category.id,
    occurredOn,
    createdAt,
    updatedAt: createdAt,
    category,
    transactions: transactions.map((transaction, index) => ({
      id: transaction.id,
      userId: "user-1",
      groupId: "group-1",
      groupOrder: transaction.groupOrder ?? index,
      type: transaction.type,
      categoryId: category.id,
      amountCents: transaction.amountCents,
      currency: "EUR" as const,
      originalAmountMinor: null,
      exchangeRateBasePerUsd: null,
      description: transaction.description ?? transaction.id,
      occurredOn,
      createdAt,
      category,
    })),
  };
}

async function createApp() {
  const app = Fastify();
  await app.register(transactionGroupRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

describe("transaction groups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getAuthenticatedUserId.mockResolvedValue("user-1");
    dbMocks.categoryFindUnique.mockResolvedValue(category);
    dbMocks.currencyExchangeFindMany.mockResolvedValue([]);
    dbMocks.transactionFindMany.mockResolvedValue([]);
    dbMocks.transaction.mockImplementation((callback) => callback({
      category: { findUnique: dbMocks.categoryFindUnique },
      transactionGroup: {
        findFirst: dbMocks.transactionGroupFindFirst,
        create: dbMocks.transactionGroupCreate,
        delete: dbMocks.transactionGroupDelete,
        update: dbMocks.transactionGroupUpdate,
      },
      transaction: {
        create: dbMocks.transactionCreate,
        update: dbMocks.transactionUpdate,
        delete: dbMocks.transactionDelete,
        findMany: dbMocks.transactionFindMany,
        updateMany: dbMocks.transactionUpdateMany,
      },
      currencyExchange: { findMany: dbMocks.currencyExchangeFindMany },
    }));
  });

  afterEach(() => vi.restoreAllMocks());

  it("calculates negative, positive, zero, income-only, expense-only and mixed net totals", () => {
    expect(getNetOperationSummary([
      { type: "EXPENSE", amountCents: 100000 },
      { type: "INCOME", amountCents: 80000 },
    ])).toEqual({ netTotalCents: -20000, amountCents: 20000, type: "EXPENSE" });
    expect(getNetOperationSummary([
      { type: "EXPENSE", amountCents: 20000 },
      { type: "INCOME", amountCents: 80000 },
    ])).toEqual({ netTotalCents: 60000, amountCents: 60000, type: "INCOME" });
    expect(getNetOperationSummary([
      { type: "EXPENSE", amountCents: 5000 },
      { type: "INCOME", amountCents: 5000 },
    ])).toEqual({ netTotalCents: 0, amountCents: 0, type: null });
    expect(getNetOperationSummary([
      { type: "EXPENSE", amountCents: 100 },
      { type: "EXPENSE", amountCents: 200 },
    ])).toMatchObject({ netTotalCents: -300, type: "EXPENSE" });
    expect(getNetOperationSummary([
      { type: "INCOME", amountCents: 100 },
      { type: "INCOME", amountCents: 200 },
    ])).toMatchObject({ netTotalCents: 300, type: "INCOME" });
  });

  it("rejects invalid group sizes and zero amounts", async () => {
    const app = await createApp();
    const one = await app.inject({
      method: "POST",
      url: "/api/transaction-groups",
      payload: {
        title: "Trip",
        categoryId: "cat-1",
        transactions: [
          { title: "Hotel", type: "EXPENSE", amount: "10.00", currency: "EUR" },
        ],
      },
    });
    const zero = await app.inject({
      method: "POST",
      url: "/api/transaction-groups",
      payload: {
        title: "Trip",
        categoryId: "cat-1",
        transactions: [
          { title: "Hotel", type: "EXPENSE", amount: "0.00", currency: "EUR" },
          { title: "Friend", type: "INCOME", amount: "5.00", currency: "EUR" },
        ],
      },
    });
    const eleven = await app.inject({
      method: "POST",
      url: "/api/transaction-groups",
      payload: {
        title: "Trip",
        categoryId: "cat-1",
        transactions: Array.from({ length: 11 }, (_, index) => ({
          title: `Line ${index}`,
          type: "EXPENSE",
          amount: "1.00",
          currency: "EUR",
        })),
      },
    });

    expect(one.statusCode).toBe(400);
    expect(zero.statusCode).toBe(400);
    expect(eleven.statusCode).toBe(400);
    await app.close();
  });

  it("creates a valid group and preserves internal order", async () => {
    dbMocks.transactionGroupCreate.mockResolvedValue({ id: "group-1" });
    dbMocks.transactionGroupFindFirst.mockResolvedValue(createGroup([
      { id: "line-1", type: "EXPENSE", amountCents: 1000, groupOrder: 0 },
      { id: "line-2", type: "INCOME", amountCents: 400, groupOrder: 1 },
    ]));
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/transaction-groups",
      payload: {
        title: "Trip",
        categoryId: "cat-1",
        date: "2026-01-10",
        transactions: [
          { title: "Hotel", type: "EXPENSE", amount: "10.00", currency: "EUR" },
          { title: "Friend", type: "INCOME", amount: "4.00", currency: "EUR" },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().group.netTotal).toBe("-6.00");
    expect(dbMocks.transactionCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ groupOrder: 0, description: "Hotel" }),
    }));
    expect(dbMocks.transactionCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ groupOrder: 1, description: "Friend" }),
    }));
    await app.close();
  });

  it("converts grouped USD expenses to EUR basis before group totals are used", async () => {
    dbMocks.transactionGroupCreate.mockResolvedValue({ id: "group-1" });
    dbMocks.currencyExchangeFindMany.mockResolvedValue([
      {
        id: "exchange-1",
        fromCurrency: "EUR",
        toCurrency: "USD",
        fromAmountMinor: 5000,
        toAmountMinor: 10000,
        exchangeRateBasePerUsd: new Prisma.Decimal("0.5"),
        occurredOn: new Date("2026-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    dbMocks.transactionFindMany.mockResolvedValue([
      {
        id: "line-usd",
        groupId: "group-1",
        type: "EXPENSE",
        amountCents: 1,
        currency: "USD",
        originalAmountMinor: 5000,
        exchangeRateBasePerUsd: null,
        occurredOn,
        createdAt,
      },
    ]);
    dbMocks.transactionGroupFindFirst.mockResolvedValue(createGroup([
      { id: "line-eur", type: "EXPENSE", amountCents: 1000, groupOrder: 0 },
      { id: "line-usd", type: "EXPENSE", amountCents: 2500, groupOrder: 1 },
    ]));
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/transaction-groups",
      payload: {
        title: "Trip",
        categoryId: "cat-1",
        date: "2026-01-10",
        transactions: [
          { title: "Coffee", type: "EXPENSE", amount: "10.00", currency: "EUR" },
          { title: "Taxi", type: "EXPENSE", amount: "50.00", currency: "USD" },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().group.netTotal).toBe("-35.00");
    expect(dbMocks.transactionCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({
        amountCents: 1,
        currency: "USD",
        originalAmountMinor: 5000,
      }),
    }));
    expect(dbMocks.transactionUpdate).toHaveBeenCalledWith({
      where: { id: "line-usd" },
      data: expect.objectContaining({
        amountCents: 2500,
        originalAmountMinor: 5000,
      }),
    });
    await app.close();
  });

  it("converts grouped USD income with the historical rate before summing the group", async () => {
    dbMocks.transactionGroupCreate.mockResolvedValue({ id: "group-1" });
    dbMocks.currencyExchangeFindMany.mockResolvedValue([
      {
        id: "exchange-1",
        fromCurrency: "EUR",
        toCurrency: "USD",
        fromAmountMinor: 5000,
        toAmountMinor: 10000,
        exchangeRateBasePerUsd: new Prisma.Decimal("0.5"),
        occurredOn: new Date("2026-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    dbMocks.transactionFindMany.mockResolvedValue([
      {
        id: "line-usd",
        groupId: "group-1",
        type: "INCOME",
        amountCents: 1,
        currency: "USD",
        originalAmountMinor: 3300,
        exchangeRateBasePerUsd: null,
        occurredOn,
        createdAt,
      },
    ]);
    dbMocks.transactionGroupFindFirst.mockResolvedValue(createGroup([
      { id: "line-eur", type: "EXPENSE", amountCents: 300, groupOrder: 0 },
      { id: "line-usd", type: "INCOME", amountCents: 1650, groupOrder: 1 },
    ]));
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/transaction-groups",
      payload: {
        title: "Example with two transactions",
        categoryId: "cat-1",
        date: "2026-01-10",
        transactions: [
          { title: "Example expense", type: "EXPENSE", amount: "3.00", currency: "EUR" },
          { title: "Example income", type: "INCOME", amount: "33.00", currency: "USD" },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().group.netTotal).toBe("13.50");
    expect(dbMocks.transactionCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({
        amountCents: 1,
        currency: "USD",
        originalAmountMinor: 3300,
        exchangeRateBasePerUsd: null,
      }),
    }));
    expect(dbMocks.transactionUpdate).toHaveBeenCalledWith({
      where: { id: "line-usd" },
      data: expect.objectContaining({
        amountCents: 1650,
        originalAmountMinor: 3300,
      }),
    });
    await app.close();
  });

  it("reorders without changing net total", async () => {
    dbMocks.transactionGroupFindFirst
      .mockResolvedValueOnce({
        id: "group-1",
        userId: "user-1",
        transactions: [{ id: "line-1" }, { id: "line-2" }],
      })
      .mockResolvedValueOnce(createGroup([
        { id: "line-2", type: "INCOME", amountCents: 400, groupOrder: 0 },
        { id: "line-1", type: "EXPENSE", amountCents: 1000, groupOrder: 1 },
      ]));
    const app = await createApp();
    const response = await app.inject({
      method: "PATCH",
      url: "/api/transaction-groups/group-1/transactions/reorder",
      payload: { transactionIds: ["line-2", "line-1"] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().group.netTotal).toBe("-6.00");
    expect(dbMocks.transactionUpdate).toHaveBeenCalledWith({
      where: { id: "line-2" },
      data: { groupOrder: 0 },
    });
    await app.close();
  });

  it("converts a group with one remaining line back to an individual transaction", async () => {
    dbMocks.transactionGroupFindFirst.mockResolvedValue(createGroup([
      { id: "line-1", type: "EXPENSE", amountCents: 1000 },
      { id: "line-2", type: "INCOME", amountCents: 400 },
    ]));
    dbMocks.transactionFindMany.mockResolvedValue([
      { id: "line-2" },
    ]);
    const app = await createApp();
    const response = await app.inject({
      method: "DELETE",
      url: "/api/transaction-groups/group-1/transactions/line-1",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      message: "Transaction group dissolved",
      promotedTransactionId: "line-2",
    });
    expect(dbMocks.transactionUpdate).toHaveBeenCalledWith({
      where: { id: "line-2" },
      data: expect.objectContaining({
        groupId: null,
        groupOrder: null,
        categoryId: "cat-1",
      }),
    });
    await app.close();
  });
});
