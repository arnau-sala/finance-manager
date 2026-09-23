import {
  type CurrencyCode,
  Prisma,
  type TransactionType,
} from "@prisma/client";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";

import { getAuthenticatedUserId } from "../auth/authenticated-user.js";
import {
  formatDateOnly,
  getTodayDateOnly,
  parseDateOnly,
} from "../dates/date-only.js";
import { db } from "../db/client.js";
import {
  getPaginatedResponse,
  getPaginationQuerySchema,
} from "../pagination.js";
import {
  financialReadRateLimit,
  financialWriteRateLimit,
} from "../security/rate-limit.js";
import {
  getUsdIncomeRateBasePerUsd,
  rebuildUsdLedger,
  BASE_CURRENCY,
  USD_CURRENCY,
  CurrencyLedgerError,
} from "../services/currency-ledger-service.js";
import {
  getTransactionDetail,
  toTransactionResponse,
} from "../services/transaction-service.js";

type TransactionWithCategoryRow = {
  id: string;
  userId: string;
  type: TransactionType;
  categoryId: string;
  amountCents: number;
  currency: CurrencyCode;
  originalAmountMinor: number | null;
  exchangeRateBasePerUsd: Prisma.Decimal | null;
  description: string;
  occurredOn: Date;
  createdAt: Date;
  categoryName: string;
  categoryType: TransactionType;
  totalCount?: bigint;
};

const transactionsPaginationQuerySchema = getPaginationQuerySchema({
  defaultLimit: 100,
  maxLimit: 200,
});

const MAX_AMOUNT_CENTS = 2_147_483_647n;
const MAX_AMOUNT_CENTS_NUMBER = Number(MAX_AMOUNT_CENTS);
const DECIMAL_AMOUNT_PATTERN = /^\d+(?:\.\d{1,2})?$/;

const optionalSearchQuerySchema = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.string().trim().min(1).max(50).optional(),
);
const optionalTypeQuerySchema = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.enum(["INCOME", "EXPENSE"]).optional(),
);
const optionalCurrencyQuerySchema = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.enum(["EUR", "USD"]).optional(),
);
const optionalCategoryIdsQuerySchema = z.preprocess(
  (value) => {
    if (value === "" || value === undefined) {
      return undefined;
    }

    return typeof value === "string"
      ? [...new Set(value.split(",").map((item) => item.trim()))]
      : value;
  },
  z.array(z.string().min(1)).min(1).max(20).optional(),
);
const optionalAmountCentsQuerySchema = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_AMOUNT_CENTS_NUMBER)
    .optional(),
);
const optionalDateQuerySchema = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.iso.date().optional(),
);

const transactionListQuerySchema = getPaginationQuerySchema({
  defaultLimit: 20,
  maxLimit: 200,
})
  .extend({
    search: optionalSearchQuerySchema,
    type: optionalTypeQuerySchema,
    currency: optionalCurrencyQuerySchema,
    categories: optionalCategoryIdsQuerySchema,
    exactAmountCents: optionalAmountCentsQuerySchema,
    minimumAmountCents: optionalAmountCentsQuerySchema,
    maximumAmountCents: optionalAmountCentsQuerySchema,
    exactDate: optionalDateQuerySchema,
    startDate: optionalDateQuerySchema,
    endDate: optionalDateQuerySchema,
  })
  .superRefine((query, context) => {
    if (
      query.minimumAmountCents !== undefined &&
      query.maximumAmountCents !== undefined &&
      query.minimumAmountCents > query.maximumAmountCents
    ) {
      context.addIssue({
        code: "custom",
        path: ["maximumAmountCents"],
        message: "Maximum amount must not be lower than minimum amount",
      });
    }

    if (
      query.startDate !== undefined &&
      query.endDate !== undefined &&
      query.startDate > query.endDate
    ) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must not be earlier than start date",
      });
    }
  });

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
    z
      .string()
      .regex(
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

const transactionTypeSchema = z.enum(["INCOME", "EXPENSE"]);
const currencyCodeSchema = z.enum(["EUR", "USD"]);
const transactionDescriptionSchema = z.string().trim().min(1).max(50);
const transactionDateSchema = z.iso.date().transform(parseDateOnly);

const createTransactionBodySchema = z
  .object({
    type: transactionTypeSchema,
    categoryId: z.string().trim().min(1),
    description: transactionDescriptionSchema,
    date: transactionDateSchema.optional(),
    amount: amountSchema,
    currency: currencyCodeSchema.default("EUR"),
    baseAmount: amountSchema.optional(),
  })
  .strict()
  .superRefine((transaction, context) => {
    if (transaction.currency === "EUR" && transaction.baseAmount !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["baseAmount"],
        message: "EUR transactions do not need a base amount",
      });
    }

    if (
      transaction.currency === "USD" &&
      transaction.type === "EXPENSE" &&
      transaction.baseAmount !== undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["baseAmount"],
        message: "USD expenses use the wallet cost basis",
      });
    }

    if (
      transaction.currency === "USD" &&
      transaction.type === "INCOME" &&
      transaction.baseAmount === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["baseAmount"],
        message: "USD income requires a EUR base amount",
      });
    }
  });

const updateTransactionBodySchema = z
  .object({
    type: transactionTypeSchema.optional(),
    categoryId: z.string().trim().min(1).optional(),
    description: transactionDescriptionSchema.optional(),
    date: transactionDateSchema.optional(),
    amount: amountSchema.optional(),
    currency: currencyCodeSchema.optional(),
    baseAmount: amountSchema.optional(),
  })
  .strict();

const transactionParamsSchema = z
  .object({
    id: z.string().trim().min(1),
  })
  .strict();

const transactionCategoryParamsSchema = z
  .object({
    category: z.string().trim().min(1),
  })
  .strict();

function toTransactionWithCategory(row: TransactionWithCategoryRow) {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    categoryId: row.categoryId,
    amountCents: row.amountCents,
    currency: row.currency,
    originalAmountMinor: row.originalAmountMinor,
    exchangeRateBasePerUsd: row.exchangeRateBasePerUsd,
    description: row.description,
    occurredOn: row.occurredOn,
    createdAt: row.createdAt,
    category: {
      id: row.categoryId,
      name: row.categoryName,
      type: row.categoryType,
    },
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

function getUsdIncomeBaseAmountCents(input: {
  usdAmountCents: number;
  baseAmountCents: number;
}) {
  getUsdIncomeRateBasePerUsd({
    usdAmountMinor: input.usdAmountCents,
    baseAmountMinor: input.baseAmountCents,
  });

  return input.baseAmountCents;
}

function getTransactionListWhere(
  userId: string,
  query: z.infer<typeof transactionListQuerySchema>,
) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`t."userId" = ${userId}`,
    Prisma.sql`t."groupId" IS NULL`,
  ];

  if (query.search !== undefined) {
    conditions.push(
      Prisma.sql`POSITION(LOWER(${query.search}) IN LOWER(t."description")) > 0`,
    );
  }

  if (query.type !== undefined) {
    conditions.push(Prisma.sql`t."type" = ${query.type}::"TransactionType"`);
  }

  if (query.currency !== undefined) {
    conditions.push(Prisma.sql`t."currency" = ${query.currency}::"CurrencyCode"`);
  }

  if (query.categories !== undefined) {
    conditions.push(
      Prisma.sql`t."categoryId" IN (${Prisma.join(query.categories)})`,
    );
  }

  if (query.exactAmountCents !== undefined) {
    conditions.push(
      Prisma.sql`t."amountCents" = ${query.exactAmountCents}`,
    );
  } else {
    if (query.minimumAmountCents !== undefined) {
      conditions.push(
        Prisma.sql`t."amountCents" >= ${query.minimumAmountCents}`,
      );
    }

    if (query.maximumAmountCents !== undefined) {
      conditions.push(
        Prisma.sql`t."amountCents" <= ${query.maximumAmountCents}`,
      );
    }
  }

  if (query.exactDate !== undefined) {
    conditions.push(
      Prisma.sql`t."occurredOn" = ${query.exactDate}::date`,
    );
  } else {
    if (query.startDate !== undefined) {
      conditions.push(
        Prisma.sql`t."occurredOn" >= ${query.startDate}::date`,
      );
    }

    if (query.endDate !== undefined) {
      conditions.push(
        Prisma.sql`t."occurredOn" <= ${query.endDate}::date`,
      );
    }
  }

  return Prisma.join(conditions, " AND ");
}

export const transactionRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/transactions",
    { config: { rateLimit: financialReadRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const parsedQuery = transactionListQuerySchema.safeParse(
        request.query,
      );

      if (!parsedQuery.success) {
        return reply.code(400).send({
          error: "Invalid transaction filters",
          issues: parsedQuery.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const query = parsedQuery.data;
      const { limit, offset } = query;
      const where = getTransactionListWhere(userId, query);
      const [transactions, accountMetadata] = await Promise.all([
        db.$queryRaw<TransactionWithCategoryRow[]>(
          Prisma.sql`
            SELECT
              t."id" AS "id",
              t."userId" AS "userId",
              t."type" AS "type",
              t."categoryId" AS "categoryId",
              t."amountCents" AS "amountCents",
              t."currency" AS "currency",
              t."originalAmountMinor" AS "originalAmountMinor",
              t."exchangeRateBasePerUsd" AS "exchangeRateBasePerUsd",
              t."description" AS "description",
              t."occurredOn" AS "occurredOn",
              t."createdAt" AS "createdAt",
              c."name" AS "categoryName",
              c."type" AS "categoryType",
              COUNT(*) OVER()::bigint AS "totalCount"
            FROM "Transaction" t
            INNER JOIN "Category" c ON c."id" = t."categoryId"
            WHERE ${where}
            ORDER BY t."occurredOn" DESC, t."createdAt" DESC, t."id" DESC
            LIMIT ${limit}
            OFFSET ${offset}
          `,
        ),
        offset === 0
          ? db.transaction.aggregate({
              where: { userId },
              _count: { _all: true },
              _min: { occurredOn: true },
            })
          : Promise.resolve(null),
      ]);
      const total = Number(transactions[0]?.totalCount ?? 0n);
      const nextOffset =
        offset + transactions.length < total
          ? offset + transactions.length
          : null;

      return reply.send({
        transactions: transactions
          .map(toTransactionWithCategory)
          .map(toTransactionResponse),
        pagination: {
          limit,
          offset,
          nextOffset,
          total,
        },
        metadata: accountMetadata
          ? {
              accountTransactionCount: accountMetadata._count._all,
              minimumDate: accountMetadata._min.occurredOn
                ? formatDateOnly(accountMetadata._min.occurredOn)
                : null,
            }
          : null,
      });
    },
  );

  app.get(
    "/transactions/categories/:category",
    { config: { rateLimit: financialReadRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const parsedParams = transactionCategoryParamsSchema.safeParse(
        request.params,
      );

      if (!parsedParams.success) {
        return reply.code(400).send({ error: "Invalid category id" });
      }

      const parsedQuery = transactionsPaginationQuerySchema.safeParse(
        request.query,
      );

      if (!parsedQuery.success) {
        return reply.code(400).send({ error: "Invalid pagination query" });
      }

      const { limit, offset } = parsedQuery.data;
      const transactions = await db.$queryRaw<TransactionWithCategoryRow[]>(
        Prisma.sql`
        SELECT
          t."id" AS "id",
          t."userId" AS "userId",
          t."type" AS "type",
          t."categoryId" AS "categoryId",
          t."amountCents" AS "amountCents",
          t."currency" AS "currency",
          t."originalAmountMinor" AS "originalAmountMinor",
          t."exchangeRateBasePerUsd" AS "exchangeRateBasePerUsd",
          t."description" AS "description",
          t."occurredOn" AS "occurredOn",
          t."createdAt" AS "createdAt",
          c."name" AS "categoryName",
          c."type" AS "categoryType"
        FROM "Transaction" t
        INNER JOIN "Category" c ON c."id" = t."categoryId"
        WHERE t."userId" = ${userId}
          AND t."groupId" IS NULL
          AND t."categoryId" = ${parsedParams.data.category}
        ORDER BY t."occurredOn" DESC, t."createdAt" DESC, t."id" DESC
        LIMIT ${limit + 1}
        OFFSET ${offset}
      `,
      );
      const paginatedTransactions = getPaginatedResponse(
        transactions,
        limit,
        offset,
      );

      return reply.send({
        transactions: paginatedTransactions.items
          .map(toTransactionWithCategory)
          .map(toTransactionResponse),
        pagination: paginatedTransactions.pagination,
      });
    },
  );

  app.get(
    "/transactions/:id",
    { config: { rateLimit: financialReadRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const parsedParams = transactionParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.code(400).send({ error: "Invalid transaction id" });
      }

      const detail = await getTransactionDetail(
        userId,
        parsedParams.data.id,
      );

      if (!detail) {
        return reply.code(404).send({ error: "Transaction not found" });
      }

      return reply.send(detail);
    },
  );

  app.post(
    "/transactions",
    { config: { rateLimit: financialWriteRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const parsedBody = createTransactionBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "Invalid transaction data",
          issues: parsedBody.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const category = await db.category.findFirst({
        where: {
          id: parsedBody.data.categoryId,
          type: parsedBody.data.type,
        },
        select: {
          id: true,
          name: true,
          type: true,
        },
      });

      if (!category) {
        return reply
          .code(400)
          .send({ error: "Invalid category for transaction type" });
      }

      const occurredOn =
        parsedBody.data.date ?? parseDateOnly(getTodayDateOnly());

      if (parsedBody.data.currency === "USD") {
        try {
          const transaction = await db.$transaction(async (client) => {
            const baseAmountCents =
              parsedBody.data.type === "INCOME"
                ? getUsdIncomeBaseAmountCents({
                    usdAmountCents: parsedBody.data.amount,
                    baseAmountCents: parsedBody.data.baseAmount ?? 0,
                  })
                : 1;
            const exchangeRateBasePerUsd =
              parsedBody.data.type === "INCOME"
                ? getUsdIncomeRateBasePerUsd({
                    usdAmountMinor: parsedBody.data.amount,
                    baseAmountMinor: baseAmountCents,
                  })
                : null;
            const createdTransaction = await client.transaction.create({
              data: {
                userId,
                type: parsedBody.data.type,
                categoryId: category.id,
                amountCents: baseAmountCents,
                currency: USD_CURRENCY,
                originalAmountMinor: parsedBody.data.amount,
                exchangeRateBasePerUsd,
                description: parsedBody.data.description,
                occurredOn,
              },
            });

            await rebuildUsdLedger(userId, client);

            return client.transaction.findUniqueOrThrow({
              where: { id: createdTransaction.id },
              include: { category: true },
            });
          });

          return reply.code(201).send({
            transaction: toTransactionResponse(transaction),
          });
        } catch (error) {
          return sendCurrencyLedgerError(reply, error);
        }
      }

      const transaction = await db.transaction.create({
        data: {
          userId,
          type: parsedBody.data.type,
          categoryId: category.id,
          amountCents: parsedBody.data.amount,
          currency: BASE_CURRENCY,
          description: parsedBody.data.description,
          occurredOn,
        },
      });

      return reply.code(201).send({
        transaction: toTransactionResponse({
          ...transaction,
          category,
        }),
      });
    },
  );

  app.delete(
    "/transactions/:id",
    { config: { rateLimit: financialWriteRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const parsedParams = transactionParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.code(400).send({ error: "Invalid transaction id" });
      }

      const transaction = await db.transaction.findFirst({
        where: {
          id: parsedParams.data.id,
          userId,
          groupId: null,
        },
        select: { id: true, currency: true },
      });

      if (!transaction) {
        return reply.code(404).send({ error: "Transaction not found" });
      }

      try {
        await db.$transaction(async (client) => {
          await client.transaction.delete({
            where: { id: transaction.id },
          });

          if (transaction.currency === USD_CURRENCY) {
            await rebuildUsdLedger(userId, client);
          }
        });

        return reply.send({ message: "Transaction deleted" });
      } catch (error) {
        return sendCurrencyLedgerError(reply, error);
      }
    },
  );

  app.patch(
    "/transactions/:id",
    { config: { rateLimit: financialWriteRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const parsedParams = transactionParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.code(400).send({ error: "Invalid transaction id" });
      }

      const parsedBody = updateTransactionBodySchema.safeParse(
        request.body ?? {},
      );

      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "Invalid transaction data",
          issues: parsedBody.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const transaction = await db.transaction.findFirst({
        where: {
          id: parsedParams.data.id,
          userId,
          groupId: null,
        },
        select: {
          id: true,
          type: true,
          categoryId: true,
          amountCents: true,
          currency: true,
          originalAmountMinor: true,
        },
      });

      if (!transaction) {
        return reply.code(404).send({ error: "Transaction not found" });
      }

      if (Object.keys(parsedBody.data).length === 0) {
        return reply.send({ message: "Transaction updated" });
      }

      const {
        type,
        categoryId,
        description,
        date,
        amount,
        currency,
        baseAmount,
      } = parsedBody.data;
      const resultingType = type ?? transaction.type;
      const resultingCategoryId = categoryId ?? transaction.categoryId;
      const resultingCurrency = currency ?? transaction.currency;
      const category = await db.category.findFirst({
        where: {
          id: resultingCategoryId,
          type: resultingType,
        },
        select: { id: true },
      });

      if (!category) {
        return reply
          .code(400)
          .send({ error: "Invalid category for transaction type" });
      }

      if (resultingCurrency === BASE_CURRENCY && baseAmount !== undefined) {
        return reply
          .code(400)
          .send({ error: "EUR transactions do not need a base amount" });
      }

      if (
        resultingCurrency === USD_CURRENCY &&
        resultingType === "EXPENSE" &&
        baseAmount !== undefined
      ) {
        return reply
          .code(400)
          .send({ error: "USD expenses use the wallet cost basis" });
      }

      const existingOriginalAmount =
        transaction.currency === USD_CURRENCY
          ? transaction.originalAmountMinor ?? transaction.amountCents
          : transaction.amountCents;
      const resultingOriginalAmount = amount ?? existingOriginalAmount;
      const updateData: Prisma.TransactionUncheckedUpdateManyInput = {
        type,
        categoryId,
        description,
        occurredOn: date,
      };

      if (resultingCurrency === USD_CURRENCY) {
        updateData.currency = USD_CURRENCY;
        updateData.originalAmountMinor = resultingOriginalAmount;

        if (resultingType === "INCOME") {
          const resultingBaseAmount =
            baseAmount ??
            (transaction.currency === USD_CURRENCY
              ? transaction.amountCents
              : transaction.amountCents);
          updateData.amountCents = resultingBaseAmount;
          updateData.exchangeRateBasePerUsd = getUsdIncomeRateBasePerUsd({
            usdAmountMinor: resultingOriginalAmount,
            baseAmountMinor: resultingBaseAmount,
          });
        } else {
          updateData.amountCents = 1;
          updateData.exchangeRateBasePerUsd = null;
        }
      } else {
        updateData.currency = BASE_CURRENCY;
        updateData.originalAmountMinor = null;
        updateData.exchangeRateBasePerUsd = null;
        updateData.amountCents = amount ?? resultingOriginalAmount;
      }

      try {
        const update = await db.$transaction(async (client) => {
          const result = await client.transaction.updateMany({
            where: {
              id: parsedParams.data.id,
              userId,
              groupId: null,
            },
            data: updateData,
          });

          if (
            transaction.currency === USD_CURRENCY ||
            resultingCurrency === USD_CURRENCY
          ) {
            await rebuildUsdLedger(userId, client);
          }

          return result;
        });

        if (update.count === 0) {
          return reply.code(404).send({ error: "Transaction not found" });
        }

        return reply.send({ message: "Transaction updated" });
      } catch (error) {
        return sendCurrencyLedgerError(reply, error);
      }
    },
  );
};
