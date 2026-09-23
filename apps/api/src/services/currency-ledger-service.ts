import {
  Prisma,
  type CurrencyCode,
  type Transaction,
} from "@prisma/client";

import { db } from "../db/client.js";

export const BASE_CURRENCY = "EUR";
export const USD_CURRENCY = "USD";

const RATE_SCALE = 20;

type CurrencyLedgerClient = Prisma.TransactionClient;

type LedgerTransaction = Pick<
  Transaction,
  | "id"
  | "groupId"
  | "type"
  | "amountCents"
  | "currency"
  | "originalAmountMinor"
  | "exchangeRateBasePerUsd"
  | "occurredOn"
  | "createdAt"
>;

type LedgerExchange = {
  id: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  fromAmountMinor: number;
  toAmountMinor: number;
  exchangeRateBasePerUsd: Prisma.Decimal;
  occurredOn: Date;
  createdAt: Date;
};

type LedgerEvent =
  | {
      kind: "exchange";
      priority: 0;
      id: string;
      occurredOn: Date;
      createdAt: Date;
      exchange: LedgerExchange;
    }
  | {
      kind: "transaction";
      priority: 1 | 2;
      id: string;
      occurredOn: Date;
      createdAt: Date;
      transaction: LedgerTransaction;
    };

export type UsdWalletSnapshot = {
  currency: typeof USD_CURRENCY;
  balanceMinor: number;
  costBasisMinor: number;
  averageRateBasePerUsd: string | null;
};

export type CurrencyLedgerErrorCode =
  | "UNSUPPORTED_CURRENCY_PAIR"
  | "INSUFFICIENT_USD_BALANCE"
  | "INVALID_USD_INCOME_BASIS"
  | "LEDGER_REBUILD_FAILED";

export class CurrencyLedgerError extends Error {
  constructor(
    public readonly code: CurrencyLedgerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CurrencyLedgerError";
  }
}

function toDecimal(value: number | string | Prisma.Decimal) {
  return new Prisma.Decimal(value);
}

function normalizeRate(rate: Prisma.Decimal) {
  return rate.toDecimalPlaces(RATE_SCALE);
}

export function roundDecimalToMinorUnits(amount: Prisma.Decimal) {
  return amount.toDecimalPlaces(0).toNumber();
}

export function getExchangeRateBasePerUsd(input: {
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  fromAmountMinor: number;
  toAmountMinor: number;
}) {
  if (input.fromCurrency === BASE_CURRENCY && input.toCurrency === USD_CURRENCY) {
    return normalizeRate(
      toDecimal(input.fromAmountMinor).div(input.toAmountMinor),
    );
  }

  if (input.fromCurrency === USD_CURRENCY && input.toCurrency === BASE_CURRENCY) {
    return normalizeRate(
      toDecimal(input.toAmountMinor).div(input.fromAmountMinor),
    );
  }

  throw new CurrencyLedgerError(
    "UNSUPPORTED_CURRENCY_PAIR",
    "Only EUR and USD exchanges are supported",
  );
}

export function getUsdIncomeRateBasePerUsd(input: {
  usdAmountMinor: number;
  baseAmountMinor: number;
}) {
  if (input.usdAmountMinor <= 0 || input.baseAmountMinor <= 0) {
    throw new CurrencyLedgerError(
      "INVALID_USD_INCOME_BASIS",
      "USD income requires a positive EUR basis",
    );
  }

  return normalizeRate(
    toDecimal(input.baseAmountMinor).div(input.usdAmountMinor),
  );
}

function getEventTime(value: Date) {
  return value.getTime();
}

function sortLedgerEvents(first: LedgerEvent, second: LedgerEvent) {
  return (
    getEventTime(first.occurredOn) - getEventTime(second.occurredOn) ||
    first.priority - second.priority ||
    getEventTime(first.createdAt) - getEventTime(second.createdAt) ||
    first.id.localeCompare(second.id)
  );
}

function getUsdTransactionOriginalAmount(transaction: LedgerTransaction) {
  return transaction.originalAmountMinor ?? transaction.amountCents;
}

async function loadUsdLedgerEvents(client: CurrencyLedgerClient, userId: string) {
  const [exchanges, transactions] = await Promise.all([
    client.currencyExchange.findMany({
      where: { userId },
      select: {
        id: true,
        fromCurrency: true,
        toCurrency: true,
        fromAmountMinor: true,
        toAmountMinor: true,
        exchangeRateBasePerUsd: true,
        occurredOn: true,
        createdAt: true,
      },
    }),
    client.transaction.findMany({
      where: { userId, currency: USD_CURRENCY },
      select: {
        id: true,
        groupId: true,
        type: true,
        amountCents: true,
        currency: true,
        originalAmountMinor: true,
        exchangeRateBasePerUsd: true,
        occurredOn: true,
        createdAt: true,
      },
    }),
  ]);

  return [
    ...exchanges.map<LedgerEvent>((exchange) => ({
      kind: "exchange",
      priority: 0,
      id: exchange.id,
      occurredOn: exchange.occurredOn,
      createdAt: exchange.createdAt,
      exchange,
    })),
    ...transactions.map<LedgerEvent>((transaction) => ({
      kind: "transaction",
      priority: transaction.type === "INCOME" ? 1 : 2,
      id: transaction.id,
      occurredOn: transaction.occurredOn,
      createdAt: transaction.createdAt,
      transaction,
    })),
  ].sort(sortLedgerEvents);
}

async function applyTransactionAccountingUpdate(
  client: CurrencyLedgerClient,
  transaction: LedgerTransaction,
  data: {
    amountCents: number;
    originalAmountMinor: number;
    exchangeRateBasePerUsd: Prisma.Decimal;
  },
) {
  const currentRate = transaction.exchangeRateBasePerUsd?.toFixed(RATE_SCALE);
  const nextRate = data.exchangeRateBasePerUsd.toFixed(RATE_SCALE);

  if (
    transaction.amountCents === data.amountCents &&
    transaction.originalAmountMinor === data.originalAmountMinor &&
    currentRate === nextRate
  ) {
    return;
  }

  await client.transaction.update({
    where: { id: transaction.id },
    data,
  });
}

export async function rebuildUsdLedger(
  userId: string,
  client: CurrencyLedgerClient = db,
  options: { persistTransactionAllocations?: boolean } = {
    persistTransactionAllocations: true,
  },
): Promise<UsdWalletSnapshot> {
  const persistTransactionAllocations =
    options.persistTransactionAllocations ?? true;
  let usdBalanceMinor = 0;
  let eurCostBasisMinor = toDecimal(0);
  let lastKnownRateBasePerUsd: Prisma.Decimal | null = null;
  const events = await loadUsdLedgerEvents(client, userId);

  for (const event of events) {
    if (event.kind === "exchange") {
      const { exchange } = event;

      if (
        exchange.fromCurrency === BASE_CURRENCY &&
        exchange.toCurrency === USD_CURRENCY
      ) {
        usdBalanceMinor += exchange.toAmountMinor;
        eurCostBasisMinor = eurCostBasisMinor.add(exchange.fromAmountMinor);
        lastKnownRateBasePerUsd = exchange.exchangeRateBasePerUsd;
        continue;
      }

      if (
        exchange.fromCurrency === USD_CURRENCY &&
        exchange.toCurrency === BASE_CURRENCY
      ) {
        if (exchange.fromAmountMinor > usdBalanceMinor) {
          throw new CurrencyLedgerError(
            "INSUFFICIENT_USD_BALANCE",
            "This exchange uses more USD than the wallet had available",
          );
        }

        if (usdBalanceMinor === 0) {
          continue;
        }

        const costBasisRemoved = eurCostBasisMinor
          .mul(exchange.fromAmountMinor)
          .div(usdBalanceMinor);
        usdBalanceMinor -= exchange.fromAmountMinor;
        eurCostBasisMinor = eurCostBasisMinor.minus(costBasisRemoved);
        lastKnownRateBasePerUsd = exchange.exchangeRateBasePerUsd;
        continue;
      }

      throw new CurrencyLedgerError(
        "UNSUPPORTED_CURRENCY_PAIR",
        "Only EUR and USD exchanges are supported",
      );
    }

    const { transaction } = event;
    const usdAmountMinor = getUsdTransactionOriginalAmount(transaction);
    const transactionGroupId = (transaction as { groupId?: string | null }).groupId;
    const isStandaloneTransaction =
      transactionGroupId === null || transactionGroupId === undefined;

    if (transaction.type === "INCOME") {
      if (!isStandaloneTransaction) {
        const fallbackRate =
          lastKnownRateBasePerUsd ??
          transaction.exchangeRateBasePerUsd ??
          toDecimal(1);
        const baseAmountMinor = roundDecimalToMinorUnits(
          toDecimal(usdAmountMinor).mul(fallbackRate),
        );
        const exchangeRateBasePerUsd = normalizeRate(
          toDecimal(baseAmountMinor).div(usdAmountMinor),
        );

        usdBalanceMinor += usdAmountMinor;
        eurCostBasisMinor = eurCostBasisMinor.add(baseAmountMinor);
        lastKnownRateBasePerUsd = exchangeRateBasePerUsd;
        if (persistTransactionAllocations) {
          await applyTransactionAccountingUpdate(client, transaction, {
            amountCents: baseAmountMinor,
            originalAmountMinor: usdAmountMinor,
            exchangeRateBasePerUsd,
          });
        }
        continue;
      }

      const exchangeRateBasePerUsd = getUsdIncomeRateBasePerUsd({
        usdAmountMinor,
        baseAmountMinor: transaction.amountCents,
      });

      usdBalanceMinor += usdAmountMinor;
      eurCostBasisMinor = eurCostBasisMinor.add(transaction.amountCents);
      lastKnownRateBasePerUsd = exchangeRateBasePerUsd;
      if (persistTransactionAllocations) {
        await applyTransactionAccountingUpdate(client, transaction, {
          amountCents: transaction.amountCents,
          originalAmountMinor: usdAmountMinor,
          exchangeRateBasePerUsd,
        });
      }
      continue;
    }

    if (usdAmountMinor > usdBalanceMinor && isStandaloneTransaction) {
      throw new CurrencyLedgerError(
        "INSUFFICIENT_USD_BALANCE",
        "This transaction uses more USD than the wallet had available",
      );
    }

    if (usdBalanceMinor === 0 && isStandaloneTransaction) {
      throw new CurrencyLedgerError(
        "INSUFFICIENT_USD_BALANCE",
        "This transaction requires a funded USD wallet",
      );
    }

    const fallbackRate =
      lastKnownRateBasePerUsd ??
      transaction.exchangeRateBasePerUsd ??
      toDecimal(1);
    const costBasisRemoved =
      usdBalanceMinor > 0 && usdAmountMinor <= usdBalanceMinor
        ? eurCostBasisMinor.mul(usdAmountMinor).div(usdBalanceMinor)
        : toDecimal(usdAmountMinor).mul(fallbackRate);
    const amountCents = roundDecimalToMinorUnits(costBasisRemoved);
    const exchangeRateBasePerUsd = normalizeRate(
      costBasisRemoved.div(usdAmountMinor),
    );

    usdBalanceMinor -= usdAmountMinor;
    eurCostBasisMinor = eurCostBasisMinor.minus(costBasisRemoved);
    lastKnownRateBasePerUsd = exchangeRateBasePerUsd;
    if (persistTransactionAllocations) {
      await applyTransactionAccountingUpdate(client, transaction, {
        amountCents,
        originalAmountMinor: usdAmountMinor,
        exchangeRateBasePerUsd,
      });
    }
  }

  const costBasisMinor = roundDecimalToMinorUnits(eurCostBasisMinor);

  return {
    currency: USD_CURRENCY,
    balanceMinor: usdBalanceMinor,
    costBasisMinor,
    averageRateBasePerUsd:
      usdBalanceMinor > 0
        ? normalizeRate(eurCostBasisMinor.div(usdBalanceMinor)).toFixed(
            RATE_SCALE,
          )
        : null,
  };
}

export async function getUsdWalletSnapshot(userId: string) {
  return rebuildUsdLedger(userId, db, {
    persistTransactionAllocations: false,
  });
}

export async function createCurrencyExchange(input: {
  userId: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  fromAmountMinor: number;
  toAmountMinor: number;
  occurredOn: Date;
}) {
  const exchangeRateBasePerUsd = getExchangeRateBasePerUsd(input);

  return db.$transaction(async (transaction) => {
    const exchange = await transaction.currencyExchange.create({
      data: {
        userId: input.userId,
        fromCurrency: input.fromCurrency,
        toCurrency: input.toCurrency,
        fromAmountMinor: input.fromAmountMinor,
        toAmountMinor: input.toAmountMinor,
        exchangeRateBasePerUsd,
        occurredOn: input.occurredOn,
      },
    });

    await rebuildUsdLedger(input.userId, transaction);
    return exchange;
  });
}

export async function updateCurrencyExchange(input: {
  userId: string;
  exchangeId: string;
  fromCurrency?: CurrencyCode;
  toCurrency?: CurrencyCode;
  fromAmountMinor?: number;
  toAmountMinor?: number;
  occurredOn?: Date;
}) {
  return db.$transaction(async (transaction) => {
    const existing = await transaction.currencyExchange.findFirst({
      where: { id: input.exchangeId, userId: input.userId },
    });

    if (!existing) {
      return null;
    }

    const next = {
      fromCurrency: input.fromCurrency ?? existing.fromCurrency,
      toCurrency: input.toCurrency ?? existing.toCurrency,
      fromAmountMinor: input.fromAmountMinor ?? existing.fromAmountMinor,
      toAmountMinor: input.toAmountMinor ?? existing.toAmountMinor,
    };
    const exchangeRateBasePerUsd = getExchangeRateBasePerUsd(next);
    const exchange = await transaction.currencyExchange.update({
      where: { id: existing.id },
      data: {
        ...next,
        exchangeRateBasePerUsd,
        occurredOn: input.occurredOn,
      },
    });

    await rebuildUsdLedger(input.userId, transaction);
    return exchange;
  });
}

export async function deleteCurrencyExchange(input: {
  userId: string;
  exchangeId: string;
}) {
  return db.$transaction(async (transaction) => {
    const deletion = await transaction.currencyExchange.deleteMany({
      where: { id: input.exchangeId, userId: input.userId },
    });

    if (deletion.count === 0) {
      return false;
    }

    await rebuildUsdLedger(input.userId, transaction);
    return true;
  });
}
