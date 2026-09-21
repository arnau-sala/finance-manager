import {
  Prisma,
  type CurrencyCode,
  type Transaction,
  type TransactionGroup,
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
import { centsToDecimal } from "../money/cents.js";
import {
  financialReadRateLimit,
  financialWriteRateLimit,
} from "../security/rate-limit.js";
import {
  BASE_CURRENCY,
  CurrencyLedgerError,
  getUsdIncomeRateBasePerUsd,
  rebuildUsdLedger,
  USD_CURRENCY,
} from "../services/currency-ledger-service.js";
import { toTransactionResponse } from "../services/transaction-service.js";

const MIN_GROUP_TRANSACTIONS = 2;
const MAX_GROUP_TRANSACTIONS = 10;
const MAX_AMOUNT_CENTS = 2_147_483_647n;
const DECIMAL_AMOUNT_PATTERN = /^\d+(?:\.\d{1,2})?$/;

type TransactionGroupClient = Prisma.TransactionClient;

type GroupCategory = {
  id: string;
  name: string;
  type: TransactionType;
};

type GroupTransaction = Transaction & {
  category: GroupCategory;
};

type TransactionGroupWithDetails = TransactionGroup & {
  category: GroupCategory;
  transactions: GroupTransaction[];
};

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

const transactionTypeSchema = z.enum(["INCOME", "EXPENSE"]);
const currencyCodeSchema = z.enum(["EUR", "USD"]);
const groupTitleSchema = z.string().trim().min(1).max(100);
const groupTransactionTitleSchema = z.string().trim().min(1).max(50);
const transactionGroupDateSchema = z.iso.date().transform(parseDateOnly);
const groupParamsSchema = z.object({ id: z.string().trim().min(1) }).strict();
const groupTransactionParamsSchema = z
  .object({
    id: z.string().trim().min(1),
    transactionId: z.string().trim().min(1),
  })
  .strict();

const groupTransactionInputSchema = z
  .object({
    type: transactionTypeSchema,
    title: groupTransactionTitleSchema,
    amount: amountSchema,
    currency: currencyCodeSchema.default("EUR"),
    baseAmount: amountSchema.optional(),
  })
  .strict()
  .superRefine((transaction, context) => {
    if (transaction.currency === BASE_CURRENCY && transaction.baseAmount !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["baseAmount"],
        message: "EUR transactions do not need a base amount",
      });
    }

    if (
      transaction.currency === USD_CURRENCY &&
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
      transaction.currency === USD_CURRENCY &&
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

const updateGroupTransactionInputSchema = z
  .object({
    type: transactionTypeSchema.optional(),
    title: groupTransactionTitleSchema.optional(),
    amount: amountSchema.optional(),
    currency: currencyCodeSchema.optional(),
    baseAmount: amountSchema.optional(),
  })
  .strict()
  .refine((transaction) => Object.keys(transaction).length > 0, {
    message: "Provide at least one transaction field to update",
  });

const createTransactionGroupBodySchema = z
  .object({
    title: groupTitleSchema,
    categoryId: z.string().trim().min(1),
    date: transactionGroupDateSchema.optional(),
    transactions: z
      .array(groupTransactionInputSchema)
      .min(MIN_GROUP_TRANSACTIONS)
      .max(MAX_GROUP_TRANSACTIONS),
  })
  .strict();

const updateTransactionGroupBodySchema = z
  .object({
    title: groupTitleSchema.optional(),
    categoryId: z.string().trim().min(1).optional(),
    date: transactionGroupDateSchema.optional(),
  })
  .strict()
  .refine((group) => Object.keys(group).length > 0, {
    message: "Provide at least one group field to update",
  });

const reorderGroupTransactionsBodySchema = z
  .object({
    transactionIds: z
      .array(z.string().trim().min(1))
      .min(MIN_GROUP_TRANSACTIONS)
      .max(MAX_GROUP_TRANSACTIONS),
  })
  .strict();

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

function getSignedAmountCents(transaction: Pick<Transaction, "type" | "amountCents">) {
  return transaction.type === "INCOME"
    ? transaction.amountCents
    : -transaction.amountCents;
}

function toTransactionGroupResponse(group: TransactionGroupWithDetails) {
  const netTotalCents = group.transactions.reduce(
    (total, transaction) => total + getSignedAmountCents(transaction),
    0,
  );

  return {
    id: group.id,
    title: group.title,
    categoryId: group.categoryId,
    category: group.category,
    date: formatDateOnly(group.occurredOn),
    netTotal: centsToDecimal(netTotalCents),
    netTotalCents,
    transactions: group.transactions.map((transaction) =>
      toTransactionResponse({
        ...transaction,
        category: group.category,
      }),
    ),
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

async function getTransactionGroup(
  client: TransactionGroupClient,
  userId: string,
  groupId: string,
) {
  return client.transactionGroup.findFirst({
    where: { id: groupId, userId },
    include: {
      category: { select: { id: true, name: true, type: true } },
      transactions: {
        orderBy: [{ groupOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        include: { category: { select: { id: true, name: true, type: true } } },
      },
    },
  });
}

async function getCategory(categoryId: string) {
  return db.category.findUnique({
    where: { id: categoryId },
    select: { id: true, name: true, type: true },
  });
}

function getTransactionCreateData(input: {
  userId: string;
  groupId: string;
  groupOrder: number;
  categoryId: string;
  occurredOn: Date;
  transaction: z.infer<typeof groupTransactionInputSchema>;
}): Prisma.TransactionUncheckedCreateInput {
  const { transaction } = input;

  if (transaction.currency === USD_CURRENCY) {
    const amountCents =
      transaction.type === "INCOME" ? (transaction.baseAmount ?? 0) : 1;
    const exchangeRateBasePerUsd =
      transaction.type === "INCOME"
        ? getUsdIncomeRateBasePerUsd({
            usdAmountMinor: transaction.amount,
            baseAmountMinor: amountCents,
          })
        : null;

    return {
      userId: input.userId,
      groupId: input.groupId,
      groupOrder: input.groupOrder,
      type: transaction.type,
      categoryId: input.categoryId,
      amountCents,
      currency: USD_CURRENCY,
      originalAmountMinor: transaction.amount,
      exchangeRateBasePerUsd,
      description: transaction.title,
      occurredOn: input.occurredOn,
    };
  }

  return {
    userId: input.userId,
    groupId: input.groupId,
    groupOrder: input.groupOrder,
    type: transaction.type,
    categoryId: input.categoryId,
    amountCents: transaction.amount,
    currency: BASE_CURRENCY,
    originalAmountMinor: null,
    exchangeRateBasePerUsd: null,
    description: transaction.title,
    occurredOn: input.occurredOn,
  };
}

function getTransactionUpdateData(input: {
  existing: Pick<
    Transaction,
    "type" | "currency" | "amountCents" | "originalAmountMinor"
  >;
  transaction: z.infer<typeof updateGroupTransactionInputSchema>;
}): Prisma.TransactionUncheckedUpdateInput {
  const resultingType = input.transaction.type ?? input.existing.type;
  const resultingCurrency = input.transaction.currency ?? input.existing.currency;
  const existingOriginalAmount =
    input.existing.currency === USD_CURRENCY
      ? input.existing.originalAmountMinor ?? input.existing.amountCents
      : input.existing.amountCents;
  const resultingOriginalAmount =
    input.transaction.amount ?? existingOriginalAmount;
  const updateData: Prisma.TransactionUncheckedUpdateInput = {
    type: input.transaction.type,
    description: input.transaction.title,
  };

  if (resultingCurrency === BASE_CURRENCY) {
    if (input.transaction.baseAmount !== undefined) {
      throw new CurrencyLedgerError(
        "INVALID_USD_INCOME_BASIS",
        "EUR transactions do not need a base amount",
      );
    }

    updateData.currency = BASE_CURRENCY;
    updateData.amountCents = input.transaction.amount ?? resultingOriginalAmount;
    updateData.originalAmountMinor = null;
    updateData.exchangeRateBasePerUsd = null;
    return updateData;
  }

  if (
    resultingCurrency === USD_CURRENCY &&
    resultingType === "EXPENSE" &&
    input.transaction.baseAmount !== undefined
  ) {
    throw new CurrencyLedgerError(
      "INVALID_USD_INCOME_BASIS",
      "USD expenses use the wallet cost basis",
    );
  }

  updateData.currency = USD_CURRENCY;
  updateData.originalAmountMinor = resultingOriginalAmount;

  if (resultingType === "INCOME") {
    const resultingBaseAmount =
      input.transaction.baseAmount ?? input.existing.amountCents;
    updateData.amountCents = resultingBaseAmount;
    updateData.exchangeRateBasePerUsd = getUsdIncomeRateBasePerUsd({
      usdAmountMinor: resultingOriginalAmount,
      baseAmountMinor: resultingBaseAmount,
    });
  } else {
    updateData.amountCents = 1;
    updateData.exchangeRateBasePerUsd = null;
  }

  return updateData;
}

async function normalizeGroupTransactionOrder(
  client: TransactionGroupClient,
  groupId: string,
) {
  const transactions = await client.transaction.findMany({
    where: { groupId },
    orderBy: [{ groupOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });

  await Promise.all(
    transactions.map((transaction, index) =>
      client.transaction.update({
        where: { id: transaction.id },
        data: { groupOrder: index },
      }),
    ),
  );
}

async function dissolveGroupIfNeeded(
  client: TransactionGroupClient,
  input: {
    userId: string;
    groupId: string;
    categoryId: string;
    occurredOn: Date;
  },
) {
  const remainingTransactions = await client.transaction.findMany({
    where: { groupId: input.groupId },
    orderBy: [{ groupOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });

  if (remainingTransactions.length > 1) {
    await normalizeGroupTransactionOrder(client, input.groupId);
    return { dissolved: false as const };
  }

  if (remainingTransactions.length === 1) {
    await client.transaction.update({
      where: { id: remainingTransactions[0].id },
      data: {
        groupId: null,
        groupOrder: null,
        categoryId: input.categoryId,
        occurredOn: input.occurredOn,
      },
    });
  }

  await client.transactionGroup.delete({
    where: { id: input.groupId },
  });

  return {
    dissolved: true as const,
    promotedTransactionId: remainingTransactions[0]?.id ?? null,
  };
}

export const transactionGroupRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/transaction-groups/:id",
    { config: { rateLimit: financialReadRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const parsedParams = groupParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.code(400).send({ error: "Invalid transaction group id" });
      }

      const group = await getTransactionGroup(db, userId, parsedParams.data.id);

      if (!group) {
        return reply.code(404).send({ error: "Transaction group not found" });
      }

      return reply.send({ group: toTransactionGroupResponse(group) });
    },
  );

  app.post(
    "/transaction-groups",
    { config: { rateLimit: financialWriteRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const parsedBody = createTransactionGroupBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "Invalid transaction group data",
          issues: parsedBody.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const category = await getCategory(parsedBody.data.categoryId);

      if (!category) {
        return reply.code(400).send({ error: "Invalid transaction group category" });
      }

      const occurredOn =
        parsedBody.data.date ?? parseDateOnly(getTodayDateOnly());
      const includesUsdTransaction = parsedBody.data.transactions.some(
        (transaction) => transaction.currency === USD_CURRENCY,
      );

      try {
        const group = await db.$transaction(async (client) => {
          const createdGroup = await client.transactionGroup.create({
            data: {
              userId,
              title: parsedBody.data.title,
              categoryId: category.id,
              occurredOn,
            },
          });

          await Promise.all(
            parsedBody.data.transactions.map((transaction, index) =>
              client.transaction.create({
                data: getTransactionCreateData({
                  userId,
                  groupId: createdGroup.id,
                  groupOrder: index,
                  categoryId: category.id,
                  occurredOn,
                  transaction,
                }),
              }),
            ),
          );

          if (includesUsdTransaction) {
            await rebuildUsdLedger(userId, client);
          }

          return getTransactionGroup(client, userId, createdGroup.id);
        });

        return reply.code(201).send({
          group: group ? toTransactionGroupResponse(group) : null,
        });
      } catch (error) {
        return sendCurrencyLedgerError(reply, error);
      }
    },
  );

  app.patch(
    "/transaction-groups/:id",
    { config: { rateLimit: financialWriteRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const parsedParams = groupParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.code(400).send({ error: "Invalid transaction group id" });
      }

      const parsedBody = updateTransactionGroupBodySchema.safeParse(
        request.body ?? {},
      );

      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "Invalid transaction group data",
          issues: parsedBody.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const category = parsedBody.data.categoryId
        ? await getCategory(parsedBody.data.categoryId)
        : null;

      if (parsedBody.data.categoryId && !category) {
        return reply.code(400).send({ error: "Invalid transaction group category" });
      }

      try {
        const result = await db.$transaction(async (client) => {
          const group = await client.transactionGroup.findFirst({
            where: { id: parsedParams.data.id, userId },
            include: { transactions: { select: { id: true, currency: true } } },
          });

          if (!group) {
            return null;
          }

          const nextCategoryId = category?.id ?? group.categoryId;
          const nextOccurredOn = parsedBody.data.date ?? group.occurredOn;
          const hasUsdTransaction = group.transactions.some(
            (transaction) => transaction.currency === USD_CURRENCY,
          );

          await client.transactionGroup.update({
            where: { id: group.id },
            data: {
              title: parsedBody.data.title,
              categoryId: nextCategoryId,
              occurredOn: nextOccurredOn,
            },
          });

          if (parsedBody.data.categoryId || parsedBody.data.date) {
            await client.transaction.updateMany({
              where: { groupId: group.id },
              data: {
                categoryId: nextCategoryId,
                occurredOn: nextOccurredOn,
              },
            });
          }

          if (hasUsdTransaction && parsedBody.data.date) {
            await rebuildUsdLedger(userId, client);
          }

          return getTransactionGroup(client, userId, group.id);
        });

        if (!result) {
          return reply.code(404).send({ error: "Transaction group not found" });
        }

        return reply.send({
          group: toTransactionGroupResponse(
            result as TransactionGroupWithDetails,
          ),
        });
      } catch (error) {
        return sendCurrencyLedgerError(reply, error);
      }
    },
  );

  app.delete(
    "/transaction-groups/:id",
    { config: { rateLimit: financialWriteRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const parsedParams = groupParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.code(400).send({ error: "Invalid transaction group id" });
      }

      try {
        const result = await db.$transaction(async (client) => {
          const group = await client.transactionGroup.findFirst({
            where: { id: parsedParams.data.id, userId },
            include: { transactions: { select: { currency: true } } },
          });

          if (!group) {
            return null;
          }

          const includesUsdTransaction = group.transactions.some(
            (transaction) => transaction.currency === USD_CURRENCY,
          );

          await client.transactionGroup.delete({
            where: { id: group.id },
          });

          if (includesUsdTransaction) {
            await rebuildUsdLedger(userId, client);
          }

          return group;
        });

        if (!result) {
          return reply.code(404).send({ error: "Transaction group not found" });
        }

        return reply.send({ message: "Transaction group deleted" });
      } catch (error) {
        return sendCurrencyLedgerError(reply, error);
      }
    },
  );

  app.post(
    "/transaction-groups/:id/transactions",
    { config: { rateLimit: financialWriteRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const parsedParams = groupParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.code(400).send({ error: "Invalid transaction group id" });
      }

      const parsedBody = groupTransactionInputSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "Invalid transaction data",
          issues: parsedBody.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      try {
        const group = await db.$transaction(async (client) => {
          const existingGroup = await client.transactionGroup.findFirst({
            where: { id: parsedParams.data.id, userId },
            include: {
              transactions: {
                select: { id: true },
                orderBy: [{ groupOrder: "asc" }, { createdAt: "asc" }],
              },
            },
          });

          if (!existingGroup) {
            return null;
          }

          if (existingGroup.transactions.length >= MAX_GROUP_TRANSACTIONS) {
            return "TOO_MANY_TRANSACTIONS" as const;
          }

          await client.transaction.create({
            data: getTransactionCreateData({
              userId,
              groupId: existingGroup.id,
              groupOrder: existingGroup.transactions.length,
              categoryId: existingGroup.categoryId,
              occurredOn: existingGroup.occurredOn,
              transaction: parsedBody.data,
            }),
          });

          if (parsedBody.data.currency === USD_CURRENCY) {
            await rebuildUsdLedger(userId, client);
          }

          return getTransactionGroup(client, userId, existingGroup.id);
        });

        if (group === "TOO_MANY_TRANSACTIONS") {
          return reply
            .code(400)
            .send({ error: "A transaction group can contain up to 10 transactions" });
        }

        if (!group) {
          return reply.code(404).send({ error: "Transaction group not found" });
        }

        return reply.code(201).send({ group: toTransactionGroupResponse(group) });
      } catch (error) {
        return sendCurrencyLedgerError(reply, error);
      }
    },
  );

  app.patch(
    "/transaction-groups/:id/transactions/:transactionId",
    { config: { rateLimit: financialWriteRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const parsedParams = groupTransactionParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.code(400).send({ error: "Invalid transaction group request" });
      }

      const parsedBody = updateGroupTransactionInputSchema.safeParse(
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

      try {
        const group = await db.$transaction(async (client) => {
          const transaction = await client.transaction.findFirst({
            where: {
              id: parsedParams.data.transactionId,
              groupId: parsedParams.data.id,
              userId,
            },
            select: {
              id: true,
              type: true,
              amountCents: true,
              currency: true,
              originalAmountMinor: true,
            },
          });

          if (!transaction) {
            return null;
          }

          const updateData = getTransactionUpdateData({
            existing: transaction,
            transaction: parsedBody.data,
          });

          await client.transaction.update({
            where: { id: transaction.id },
            data: updateData,
          });

          if (
            transaction.currency === USD_CURRENCY ||
            parsedBody.data.currency === USD_CURRENCY
          ) {
            await rebuildUsdLedger(userId, client);
          }

          return getTransactionGroup(client, userId, parsedParams.data.id);
        });

        if (!group) {
          return reply.code(404).send({ error: "Transaction group not found" });
        }

        return reply.send({ group: toTransactionGroupResponse(group) });
      } catch (error) {
        return sendCurrencyLedgerError(reply, error);
      }
    },
  );

  app.delete(
    "/transaction-groups/:id/transactions/:transactionId",
    { config: { rateLimit: financialWriteRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const parsedParams = groupTransactionParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.code(400).send({ error: "Invalid transaction group request" });
      }

      try {
        const result = await db.$transaction(async (client) => {
          const group = await client.transactionGroup.findFirst({
            where: { id: parsedParams.data.id, userId },
            include: {
              transactions: {
                select: { id: true, currency: true },
                orderBy: [{ groupOrder: "asc" }, { createdAt: "asc" }],
              },
            },
          });

          if (!group) {
            return null;
          }

          const transaction = group.transactions.find(
            (item) => item.id === parsedParams.data.transactionId,
          );

          if (!transaction) {
            return null;
          }

          await client.transaction.delete({
            where: { id: transaction.id },
          });

          const dissolved = await dissolveGroupIfNeeded(client, {
            userId,
            groupId: group.id,
            categoryId: group.categoryId,
            occurredOn: group.occurredOn,
          });

          if (
            transaction.currency === USD_CURRENCY ||
            group.transactions.some((item) => item.currency === USD_CURRENCY)
          ) {
            await rebuildUsdLedger(userId, client);
          }

          if (dissolved.dissolved) {
            return dissolved;
          }

          return getTransactionGroup(client, userId, group.id);
        });

        if (!result) {
          return reply.code(404).send({ error: "Transaction group not found" });
        }

        if ("dissolved" in result && result.dissolved) {
          return reply.send({
            message: "Transaction group dissolved",
            promotedTransactionId: result.promotedTransactionId,
          });
        }

        return reply.send({
          group: toTransactionGroupResponse(
            result as TransactionGroupWithDetails,
          ),
        });
      } catch (error) {
        return sendCurrencyLedgerError(reply, error);
      }
    },
  );

  app.patch(
    "/transaction-groups/:id/transactions/reorder",
    { config: { rateLimit: financialWriteRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required" });
      }

      const parsedParams = groupParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.code(400).send({ error: "Invalid transaction group id" });
      }

      const parsedBody = reorderGroupTransactionsBodySchema.safeParse(
        request.body ?? {},
      );

      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "Invalid transaction order",
          issues: parsedBody.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const uniqueTransactionIds = new Set(parsedBody.data.transactionIds);

      if (uniqueTransactionIds.size !== parsedBody.data.transactionIds.length) {
        return reply.code(400).send({ error: "Transaction order contains duplicates" });
      }

      const group = await db.$transaction(async (client) => {
        const existingGroup = await client.transactionGroup.findFirst({
          where: { id: parsedParams.data.id, userId },
          include: { transactions: { select: { id: true } } },
        });

        if (!existingGroup) {
          return null;
        }

        const existingTransactionIds = new Set(
          existingGroup.transactions.map((transaction) => transaction.id),
        );

        if (
          existingTransactionIds.size !== parsedBody.data.transactionIds.length ||
          parsedBody.data.transactionIds.some(
            (transactionId) => !existingTransactionIds.has(transactionId),
          )
        ) {
          return "INVALID_ORDER" as const;
        }

        await Promise.all(
          parsedBody.data.transactionIds.map((transactionId, index) =>
            client.transaction.update({
              where: { id: transactionId },
              data: { groupOrder: index },
            }),
          ),
        );

        return getTransactionGroup(client, userId, existingGroup.id);
      });

      if (group === "INVALID_ORDER") {
        return reply
          .code(400)
          .send({ error: "Transaction order must include every group transaction once" });
      }

      if (!group) {
        return reply.code(404).send({ error: "Transaction group not found" });
      }

      return reply.send({ group: toTransactionGroupResponse(group) });
    },
  );
};
