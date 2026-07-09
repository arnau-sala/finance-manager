import type { Transaction } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { getAuthenticatedUserId } from "../auth/authenticated-user.js";
import { db } from "../db/client.js";
import { centsToDecimal } from "../money/cents.js";

const MAX_AMOUNT_CENTS = 2_147_483_647n;
const DECIMAL_AMOUNT_PATTERN = /^\d+(?:\.\d{1,2})?$/;

function decimalToCents(amount: string) {
  const [wholePart, decimalPart = ""] = amount.split(".");
  return BigInt(wholePart) * 100n + BigInt(decimalPart.padEnd(2, "0"));
}

const amountSchema = z
  .union([z.string(), z.number().finite()])
  .transform((amount) =>
    typeof amount === "number" ? amount.toString() : amount.trim()
  )
  .pipe(
    z
      .string()
      .regex(
        DECIMAL_AMOUNT_PATTERN,
        "Amount must be a positive decimal with at most two decimal places."
      )
  )
  .superRefine((amount, context) => {
    const amountCents = decimalToCents(amount);

    if (amountCents <= 0n) {
      context.addIssue({
        code: "custom",
        message: "Amount must be greater than zero."
      });
    }

    if (amountCents > MAX_AMOUNT_CENTS) {
      context.addIssue({
        code: "custom",
        message: "Amount is too large."
      });
    }
  })
  .transform((amount) => Number(decimalToCents(amount)));

const transactionTypeSchema = z.enum(["INCOME", "EXPENSE"]);
const transactionDescriptionSchema = z.string().trim().min(1).max(100);
const transactionDateSchema = z
  .iso.datetime({ offset: true })
  .transform((date) => new Date(date));

const createTransactionBodySchema = z
  .object({
    type: transactionTypeSchema,
    categoryId: z.string().trim().min(1),
    description: transactionDescriptionSchema,
    date: transactionDateSchema.optional(),
    amount: amountSchema
  })
  .strict();

const updateTransactionBodySchema = z
  .object({
    type: transactionTypeSchema.optional(),
    categoryId: z.string().trim().min(1).optional(),
    description: transactionDescriptionSchema.optional(),
    date: transactionDateSchema.optional(),
    amount: amountSchema.optional()
  })
  .strict();

const transactionParamsSchema = z
  .object({
    id: z.string().trim().min(1)
  })
  .strict();

function toTransactionResponse(transaction: Transaction) {
  return {
    id: transaction.id,
    userId: transaction.userId,
    type: transaction.type,
    categoryId: transaction.categoryId,
    amount: centsToDecimal(transaction.amountCents),
    description: transaction.description,
    date: transaction.occurredAt.toISOString(),
    createdAt: transaction.createdAt.toISOString()
  };
}

export const transactionRoutes: FastifyPluginAsync = async (app) => {
  app.get("/transactions", async (request, reply) => {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    const transactions = await db.transaction.findMany({
      where: { userId },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }]
    });

    return reply.send({
      transactions: transactions.map(toTransactionResponse)
    });
  });

  app.get("/transactions/:id", async (request, reply) => {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    const parsedParams = transactionParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid transaction id." });
    }

    const transaction = await db.transaction.findFirst({
      where: {
        id: parsedParams.data.id,
        userId
      }
    });

    if (!transaction) {
      return reply.code(404).send({ error: "Transaction not found." });
    }

    return reply.send({
      transaction: toTransactionResponse(transaction)
    });
  });

  app.post("/transactions", async (request, reply) => {
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
          message: issue.message
        }))
      });
    }

    const category = await db.category.findFirst({
      where: {
        id: parsedBody.data.categoryId,
        type: parsedBody.data.type
      },
      select: { id: true }
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
        occurredAt: parsedBody.data.date ?? new Date()
      }
    });

    return reply.code(201).send({
      transaction: toTransactionResponse(transaction)
    });
  });

  app.delete("/transactions/:id", async (request, reply) => {
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
        userId
      }
    });

    if (deletion.count === 0) {
      return reply.code(404).send({ error: "Transaction not found." });
    }

    return reply.send({ message: "Transaction deleted." });
  });

  app.patch("/transactions/:id", async (request, reply) => {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    const parsedParams = transactionParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({ error: "Invalid transaction id." });
    }

    const parsedBody = updateTransactionBodySchema.safeParse(request.body ?? {});

    if (!parsedBody.success) {
      return reply.code(400).send({
        error: "Invalid transaction data.",
        issues: parsedBody.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    const transaction = await db.transaction.findFirst({
      where: {
        id: parsedParams.data.id,
        userId
      },
      select: {
        id: true,
        type: true,
        categoryId: true
      }
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
        type: resultingType
      },
      select: { id: true }
    });

    if (!category) {
      return reply
        .code(400)
        .send({ error: "Invalid category for transaction type." });
    }

    const update = await db.transaction.updateMany({
      where: {
        id: parsedParams.data.id,
        userId
      },
      data: {
        type,
        categoryId,
        description,
        occurredAt: date,
        amountCents: amount
      }
    });

    if (update.count === 0) {
      return reply.code(404).send({ error: "Transaction not found." });
    }

    return reply.send({ message: "Transaction updated." });
  });
};
