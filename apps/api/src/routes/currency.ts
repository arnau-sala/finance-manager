import type { CurrencyCode } from "@prisma/client";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";

import { getAuthenticatedUserId } from "../auth/authenticated-user.js";
import {
  formatDateOnly,
  getTodayDateOnly,
  parseDateOnly,
} from "../dates/date-only.js";
import { db } from "../db/client.js";
import { centsToDecimal } from "../money/cents.js";
import { getPaginationQuerySchema } from "../pagination.js";
import {
  createCurrencyExchange,
  CurrencyLedgerError,
  deleteCurrencyExchange,
  getUsdWalletSnapshot,
  updateCurrencyExchange,
} from "../services/currency-ledger-service.js";
import {
  financialReadRateLimit,
  financialWriteRateLimit,
} from "../security/rate-limit.js";

const MAX_AMOUNT_CENTS = 2_147_483_647n;
const MAX_AMOUNT_CENTS_NUMBER = Number(MAX_AMOUNT_CENTS);
const DECIMAL_AMOUNT_PATTERN = /^\d+(?:\.\d{1,2})?$/;

function decimalToCents(amount: string) {
  const [wholePart, decimalPart = ""] = amount.split(".");
  return BigInt(wholePart) * 100n + BigInt(decimalPart.padEnd(2, "0"));
}

const amountSchema = z
  .union([z.string(), z.number().finite()])
  .transform((amount) =>
    typeof amount === "number" ? amount.toString() : amount.trim(),
  )
  .pipe(
    z.string().regex(
      DECIMAL_AMOUNT_PATTERN,
      "Amount must be a positive decimal with at most two decimal places",
    ),
  )
  .superRefine((amount, context) => {
    const amountCents = decimalToCents(amount);

    if (amountCents <= 0n) {
      context.addIssue({
        code: "custom",
        message: "Amount must be greater than zero",
      });
    }

    if (amountCents > MAX_AMOUNT_CENTS) {
      context.addIssue({
        code: "custom",
        message: "Amount is too large",
      });
    }
  })
  .transform((amount) => Number(decimalToCents(amount)));

const currencyCodeSchema = z.enum(["EUR", "USD"]);
const exchangeParamsSchema = z.object({ id: z.string().trim().min(1) }).strict();
const exchangePaginationQuerySchema = getPaginationQuerySchema({
  defaultLimit: 50,
  maxLimit: 200,
});

const createCurrencyExchangeBodySchema = z
  .object({
    fromCurrency: currencyCodeSchema,
    toCurrency: currencyCodeSchema,
    fromAmount: amountSchema,
    toAmount: amountSchema,
    date: z.iso.date().transform(parseDateOnly).optional(),
  })
  .strict()
  .superRefine((exchange, context) => {
    if (exchange.fromCurrency === exchange.toCurrency) {
      context.addIssue({
        code: "custom",
        path: ["toCurrency"],
        message: "Choose two different currencies",
      });
    }
  });

const updateCurrencyExchangeBodySchema = z
  .object({
    fromCurrency: currencyCodeSchema.optional(),
    toCurrency: currencyCodeSchema.optional(),
    fromAmount: amountSchema.optional(),
    toAmount: amountSchema.optional(),
    date: z.iso.date().transform(parseDateOnly).optional(),
  })
  .strict()
  .refine((exchange) => Object.keys(exchange).length > 0, {
    message: "Provide at least one exchange field to update",
  });

function toCurrencyExchangeResponse(exchange: {
  id: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  fromAmountMinor: number;
  toAmountMinor: number;
  exchangeRateBasePerUsd: { toString(): string };
  occurredOn: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: exchange.id,
    fromCurrency: exchange.fromCurrency,
    toCurrency: exchange.toCurrency,
    fromAmount: centsToDecimal(exchange.fromAmountMinor),
    toAmount: centsToDecimal(exchange.toAmountMinor),
    exchangeRateBasePerUsd: exchange.exchangeRateBasePerUsd.toString(),
    date: formatDateOnly(exchange.occurredOn),
    createdAt: exchange.createdAt.toISOString(),
    updatedAt: exchange.updatedAt.toISOString(),
  };
}

async function getUsdWalletSummary(userId: string) {
  const [receivedExchanges, sentExchanges, incomeTransactions, expenseTransactions] =
    await Promise.all([
      db.currencyExchange.aggregate({
        where: { userId, toCurrency: "USD" },
        _sum: { fromAmountMinor: true, toAmountMinor: true },
        _count: { _all: true },
      }),
      db.currencyExchange.aggregate({
        where: { userId, fromCurrency: "USD" },
        _sum: { fromAmountMinor: true, toAmountMinor: true },
        _count: { _all: true },
      }),
      db.transaction.aggregate({
        where: { userId, currency: "USD", type: "INCOME" },
        _sum: { originalAmountMinor: true, amountCents: true },
        _count: { _all: true },
      }),
      db.transaction.aggregate({
        where: { userId, currency: "USD", type: "EXPENSE" },
        _sum: { originalAmountMinor: true, amountCents: true },
        _count: { _all: true },
      }),
    ]);
  const receivedUsdMinor =
    (receivedExchanges._sum.toAmountMinor ?? 0) +
    (incomeTransactions._sum.originalAmountMinor ?? 0);
  const receivedBaseMinor =
    (receivedExchanges._sum.fromAmountMinor ?? 0) +
    (incomeTransactions._sum.amountCents ?? 0);
  const spentUsdMinor = expenseTransactions._sum.originalAmountMinor ?? 0;
  const spentBaseMinor = expenseTransactions._sum.amountCents ?? 0;
  const exchangedOutUsdMinor = sentExchanges._sum.fromAmountMinor ?? 0;
  const exchangedOutBaseMinor = sentExchanges._sum.toAmountMinor ?? 0;

  return {
    received: {
      usdAmount: centsToDecimal(receivedUsdMinor),
      baseAmount: centsToDecimal(receivedBaseMinor),
      count:
        receivedExchanges._count._all + incomeTransactions._count._all,
    },
    spent: {
      usdAmount: centsToDecimal(spentUsdMinor),
      baseAmount: centsToDecimal(spentBaseMinor),
      count: expenseTransactions._count._all,
    },
    exchangedOut: {
      usdAmount: centsToDecimal(exchangedOutUsdMinor),
      baseAmount: centsToDecimal(exchangedOutBaseMinor),
      count: sentExchanges._count._all,
    },
  };
}

function toUsdWalletResponse(wallet: {
  balanceMinor: number;
  costBasisMinor: number;
  averageRateBasePerUsd: string | null;
}, summary: Awaited<ReturnType<typeof getUsdWalletSummary>>) {
  return {
    currency: "USD",
    balance: centsToDecimal(wallet.balanceMinor),
    balanceMinor: wallet.balanceMinor,
    costBasis: centsToDecimal(wallet.costBasisMinor),
    costBasisMinor: wallet.costBasisMinor,
    averageRateBasePerUsd: wallet.averageRateBasePerUsd,
    summary,
  };
}

function sendCurrencyLedgerError(reply: FastifyReply, error: unknown) {
  if (!(error instanceof CurrencyLedgerError)) {
    throw error;
  }

  const statusCode =
    error.code === "UNSUPPORTED_CURRENCY_PAIR" ||
    error.code === "INVALID_USD_INCOME_BASIS"
      ? 400
      : 409;

  return reply.code(statusCode).send({ error: error.message });
}

export const currencyRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/currency/wallets/usd",
    { config: { rateLimit: financialReadRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      try {
        const [wallet, summary] = await Promise.all([
          getUsdWalletSnapshot(userId),
          getUsdWalletSummary(userId),
        ]);
        return reply.send({ wallet: toUsdWalletResponse(wallet, summary) });
      } catch (error) {
        return sendCurrencyLedgerError(reply, error);
      }
    },
  );

  app.get(
    "/currency/exchanges",
    { config: { rateLimit: financialReadRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const parsedQuery = exchangePaginationQuerySchema.safeParse(
        request.query,
      );

      if (!parsedQuery.success) {
        return reply.code(400).send({ error: "Invalid pagination query" });
      }

      const { limit, offset } = parsedQuery.data;
      const [exchanges, total] = await Promise.all([
        db.currencyExchange.findMany({
          where: { userId },
          orderBy: [
            { occurredOn: "desc" },
            { createdAt: "desc" },
            { id: "desc" },
          ],
          take: limit + 1,
          skip: offset,
        }),
        db.currencyExchange.count({ where: { userId } }),
      ]);
      const items = exchanges.slice(0, limit);
      const nextOffset =
        exchanges.length > limit ? offset + items.length : null;

      return reply.send({
        exchanges: items.map(toCurrencyExchangeResponse),
        pagination: {
          limit,
          offset,
          nextOffset,
          total,
        },
      });
    },
  );

  app.post(
    "/currency/exchanges",
    { config: { rateLimit: financialWriteRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const parsedBody = createCurrencyExchangeBodySchema.safeParse(
        request.body,
      );

      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "Invalid currency exchange data",
          issues: parsedBody.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      try {
        const exchange = await createCurrencyExchange({
          userId,
          fromCurrency: parsedBody.data.fromCurrency,
          toCurrency: parsedBody.data.toCurrency,
          fromAmountMinor: parsedBody.data.fromAmount,
          toAmountMinor: parsedBody.data.toAmount,
          occurredOn:
            parsedBody.data.date ?? parseDateOnly(getTodayDateOnly()),
        });

        return reply
          .code(201)
          .send({ exchange: toCurrencyExchangeResponse(exchange) });
      } catch (error) {
        return sendCurrencyLedgerError(reply, error);
      }
    },
  );

  app.patch(
    "/currency/exchanges/:id",
    { config: { rateLimit: financialWriteRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const parsedParams = exchangeParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.code(400).send({ error: "Invalid currency exchange id" });
      }

      const parsedBody = updateCurrencyExchangeBodySchema.safeParse(
        request.body ?? {},
      );

      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "Invalid currency exchange data",
          issues: parsedBody.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      try {
        const exchange = await updateCurrencyExchange({
          userId,
          exchangeId: parsedParams.data.id,
          fromCurrency: parsedBody.data.fromCurrency,
          toCurrency: parsedBody.data.toCurrency,
          fromAmountMinor: parsedBody.data.fromAmount,
          toAmountMinor: parsedBody.data.toAmount,
          occurredOn: parsedBody.data.date,
        });

        if (!exchange) {
          return reply.code(404).send({ error: "Currency exchange not found" });
        }

        return reply.send({ exchange: toCurrencyExchangeResponse(exchange) });
      } catch (error) {
        return sendCurrencyLedgerError(reply, error);
      }
    },
  );

  app.delete(
    "/currency/exchanges/:id",
    { config: { rateLimit: financialWriteRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const parsedParams = exchangeParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.code(400).send({ error: "Invalid currency exchange id" });
      }

      try {
        const deleted = await deleteCurrencyExchange({
          userId,
          exchangeId: parsedParams.data.id,
        });

        if (!deleted) {
          return reply.code(404).send({ error: "Currency exchange not found" });
        }

        return reply.send({ message: "Currency exchange deleted" });
      } catch (error) {
        return sendCurrencyLedgerError(reply, error);
      }
    },
  );
};
