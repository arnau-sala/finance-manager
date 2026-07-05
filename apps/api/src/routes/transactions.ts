import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { getAuthenticatedUserId } from "../auth/authenticated-user.js";
import { db } from "../db/client.js";

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

const createTransactionBodySchema = z
  .object({
    type: z.enum(["INCOME", "EXPENSE"]),
    description: z.string().trim().min(1).max(100),
    date: z.iso.datetime({ offset: true }).transform((date) => new Date(date)).optional(),
    amount: amountSchema
  })
  .strict();

const transactionParamsSchema = z
  .object({
    id: z.string().trim().min(1)
  })
  .strict();

function centsToDecimal(amountCents: number) {
  const wholePart = Math.floor(amountCents / 100);
  const decimalPart = (amountCents % 100).toString().padStart(2, "0");
  return `${wholePart}.${decimalPart}`;
}

export const transactionRoutes: FastifyPluginAsync = async (app) => {
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

    const transaction = await db.transaction.create({
      data: {
        userId,
        type: parsedBody.data.type,
        amountCents: parsedBody.data.amount,
        description: parsedBody.data.description,
        occurredAt: parsedBody.data.date ?? new Date()
      }
    });

    return reply.code(201).send({
      transaction: {
        id: transaction.id,
        userId: transaction.userId,
        type: transaction.type,
        amount: centsToDecimal(transaction.amountCents),
        description: transaction.description,
        date: transaction.occurredAt.toISOString(),
        createdAt: transaction.createdAt.toISOString()
      }
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
};
