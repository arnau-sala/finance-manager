import {
  Prisma,
  type Category,
  type Transaction,
  type TransactionType,
} from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
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
  getPaginatedResponse,
  getPaginationQuerySchema,
} from "../pagination.js";
import {
  financialReadRateLimit,
  financialWriteRateLimit,
} from "../security/rate-limit.js";

type TransactionCategory = Pick<Category, "id" | "name" | "type">;
type TransactionWithCategory = Transaction & {
  category: TransactionCategory;
};

type TransactionWithCategoryRow = {
  id: string;
  userId: string;
  type: TransactionType;
  categoryId: string;
  amountCents: number;
  description: string;
  occurredOn: Date;
  createdAt: Date;
  categoryName: string;
  categoryType: TransactionType;
};

const transactionsPaginationQuerySchema = getPaginationQuerySchema({
  defaultLimit: 100,
  maxLimit: 200,
});

const MAX_AMOUNT_CENTS = 2_147_483_647n;
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
    z
      .string()
      .regex(
        DECIMAL_AMOUNT_PATTERN,
        "Amount must be a positive decimal with at most two decimal places.",
      ),
  )
  .superRefine((amount, context) => {
    const amountCents = decimalToCents(amount);

    if (amountCents <= 0n) {
      context.addIssue({
        code: "custom",
        message: "Amount must be greater than zero.",
      });
    }

    if (amountCents > MAX_AMOUNT_CENTS) {
      context.addIssue({
        code: "custom",
        message: "Amount is too large.",
      });
    }
  })
  .transform((amount) => Number(decimalToCents(amount)));

const transactionTypeSchema = z.enum(["INCOME", "EXPENSE"]);
const transactionDescriptionSchema = z.string().trim().min(1).max(100);
const transactionDateSchema = z.iso.date().transform(parseDateOnly);

const createTransactionBodySchema = z
  .object({
    type: transactionTypeSchema,
    categoryId: z.string().trim().min(1),
    description: transactionDescriptionSchema,
    date: transactionDateSchema.optional(),
    amount: amountSchema,
  })
  .strict();

const updateTransactionBodySchema = z
  .object({
    type: transactionTypeSchema.optional(),
    categoryId: z.string().trim().min(1).optional(),
    description: transactionDescriptionSchema.optional(),
    date: transactionDateSchema.optional(),
    amount: amountSchema.optional(),
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

function toTransactionResponse(transaction: TransactionWithCategory) {
  return {
    id: transaction.id,
    type: transaction.type,
    categoryId: transaction.categoryId,
    category: transaction.category,
    amount: centsToDecimal(transaction.amountCents),
    description: transaction.description,
    date: formatDateOnly(transaction.occurredOn),
    createdAt: transaction.createdAt.toISOString(),
  };
}

export const transactionRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/transactions",
    { config: { rateLimit: financialReadRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required." });
      }

      const parsedQuery = transactionsPaginationQuerySchema.safeParse(
        request.query,
      );

      if (!parsedQuery.success) {
        return reply.code(400).send({ error: "Invalid pagination query." });
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
          t."description" AS "description",
          t."occurredOn" AS "occurredOn",
          t."createdAt" AS "createdAt",
          c."name" AS "categoryName",
          c."type" AS "categoryType"
        FROM "Transaction" t
        INNER JOIN "Category" c ON c."id" = t."categoryId"
        WHERE t."userId" = ${userId}
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
    "/transactions/categories/:category",
    { config: { rateLimit: financialReadRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required." });
      }

      const parsedParams = transactionCategoryParamsSchema.safeParse(
        request.params,
      );

      if (!parsedParams.success) {
        return reply.code(400).send({ error: "Invalid category id." });
      }

      const parsedQuery = transactionsPaginationQuerySchema.safeParse(
        request.query,
      );

      if (!parsedQuery.success) {
        return reply.code(400).send({ error: "Invalid pagination query." });
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
          t."description" AS "description",
          t."occurredOn" AS "occurredOn",
          t."createdAt" AS "createdAt",
          c."name" AS "categoryName",
          c."type" AS "categoryType"
        FROM "Transaction" t
        INNER JOIN "Category" c ON c."id" = t."categoryId"
        WHERE t."userId" = ${userId}
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
        return reply.code(401).send({ error: "Authentication required." });
      }

      const parsedParams = transactionParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.code(400).send({ error: "Invalid transaction id." });
      }

      const transactions = await db.$queryRaw<TransactionWithCategoryRow[]>(
        Prisma.sql`
        SELECT
          t."id" AS "id",
          t."userId" AS "userId",
          t."type" AS "type",
          t."categoryId" AS "categoryId",
          t."amountCents" AS "amountCents",
          t."description" AS "description",
          t."occurredOn" AS "occurredOn",
          t."createdAt" AS "createdAt",
          c."name" AS "categoryName",
          c."type" AS "categoryType"
        FROM "Transaction" t
        INNER JOIN "Category" c ON c."id" = t."categoryId"
        WHERE t."id" = ${parsedParams.data.id}
          AND t."userId" = ${userId}
        LIMIT 1
      `,
      );
      const transaction = transactions[0];

      if (!transaction) {
        return reply.code(404).send({ error: "Transaction not found." });
      }

      return reply.send({
        transaction: toTransactionResponse(
          toTransactionWithCategory(transaction),
        ),
      });
    },
  );

  app.post(
    "/transactions",
    { config: { rateLimit: financialWriteRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required." });
      }

      const parsedBody = createTransactionBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "Invalid transaction data.",
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
          .send({ error: "Invalid category for transaction type." });
      }

      const transaction = await db.transaction.create({
        data: {
          userId,
          type: parsedBody.data.type,
          categoryId: category.id,
          amountCents: parsedBody.data.amount,
          description: parsedBody.data.description,
          occurredOn:
            parsedBody.data.date ?? parseDateOnly(getTodayDateOnly()),
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
        return reply.code(401).send({ error: "Authentication required." });
      }

      const parsedParams = transactionParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.code(400).send({ error: "Invalid transaction id." });
      }

      const deletion = await db.transaction.deleteMany({
        where: {
          id: parsedParams.data.id,
          userId,
        },
      });

      if (deletion.count === 0) {
        return reply.code(404).send({ error: "Transaction not found." });
      }

      return reply.send({ message: "Transaction deleted." });
    },
  );

  app.patch(
    "/transactions/:id",
    { config: { rateLimit: financialWriteRateLimit } },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({ error: "Authentication required." });
      }

      const parsedParams = transactionParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.code(400).send({ error: "Invalid transaction id." });
      }

      const parsedBody = updateTransactionBodySchema.safeParse(
        request.body ?? {},
      );

      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "Invalid transaction data.",
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
        },
        select: {
          id: true,
          type: true,
          categoryId: true,
        },
      });

      if (!transaction) {
        return reply.code(404).send({ error: "Transaction not found." });
      }

      if (Object.keys(parsedBody.data).length === 0) {
        return reply.send({ message: "Transaction updated." });
      }

      const { type, categoryId, description, date, amount } = parsedBody.data;
      const resultingType = type ?? transaction.type;
      const resultingCategoryId = categoryId ?? transaction.categoryId;
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
          .send({ error: "Invalid category for transaction type." });
      }

      const update = await db.transaction.updateMany({
        where: {
          id: parsedParams.data.id,
          userId,
        },
        data: {
          type,
          categoryId,
          description,
          occurredOn: date,
          amountCents: amount,
        },
      });

      if (update.count === 0) {
        return reply.code(404).send({ error: "Transaction not found." });
      }

      return reply.send({ message: "Transaction updated." });
    },
  );
};
