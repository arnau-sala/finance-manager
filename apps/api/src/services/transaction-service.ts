import {
  Prisma,
  type Category,
  type Transaction,
  type TransactionType,
} from "@prisma/client";

import { formatDateOnly } from "../dates/date-only.js";
import { db } from "../db/client.js";
import { centsToDecimal } from "../money/cents.js";

export type TransactionCategory = Pick<Category, "id" | "name" | "type">;

export type TransactionWithCategory = Transaction & {
  category: TransactionCategory;
};

type TransactionDetailAggregateRow = {
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
  trackedBalanceBeforeCents: bigint;
  monthCategoryPosition: bigint;
  monthCategoryTotal: bigint;
  monthTypePosition: bigint;
  monthTypeTotal: bigint;
  monthTypeAmountCents: bigint;
  yearCategoryPosition: bigint;
  yearCategoryTotal: bigint;
  yearTypePosition: bigint;
  yearTypeTotal: bigint;
  yearTypeAmountCents: bigint;
  allCategoryPosition: bigint;
  allCategoryTotal: bigint;
  allTypePosition: bigint;
  allTypeTotal: bigint;
  allTypeAmountCents: bigint;
};

type TransactionDetailContext = {
  categoryRank: {
    position: number;
    total: number;
  };
  typeRank: {
    position: number;
    total: number;
  };
  periodImpactPercentage: number;
};

export function toTransactionResponse(
  transaction: TransactionWithCategory,
) {
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

function toSafeNumber(value: bigint) {
  const number = Number(value);

  if (!Number.isSafeInteger(number)) {
    throw new Error("Transaction detail aggregate exceeds the safe range.");
  }

  return number;
}

function getPeriodImpactPercentage(
  amountCents: number,
  periodTypeAmountCents: bigint,
) {
  const totalCents = toSafeNumber(periodTypeAmountCents);

  if (totalCents <= 0) {
    return 0;
  }

  const percentage = (amountCents / totalCents) * 100;

  if (percentage < 1) {
    const roundedPercentage = Math.round(percentage * 10) / 10;
    return roundedPercentage === 0 ? 0.1 : roundedPercentage;
  }

  return Math.round(percentage);
}

function createDetailContext(
  amountCents: number,
  categoryPosition: bigint,
  categoryTotal: bigint,
  typePosition: bigint,
  typeTotal: bigint,
  typeAmountCents: bigint,
): TransactionDetailContext {
  return {
    categoryRank: {
      position: toSafeNumber(categoryPosition),
      total: toSafeNumber(categoryTotal),
    },
    typeRank: {
      position: toSafeNumber(typePosition),
      total: toSafeNumber(typeTotal),
    },
    periodImpactPercentage: getPeriodImpactPercentage(
      amountCents,
      typeAmountCents,
    ),
  };
}

export async function getTransactionDetail(
  userId: string,
  transactionId: string,
) {
  const rows = await db.$queryRaw<TransactionDetailAggregateRow[]>(
    Prisma.sql`
      WITH target AS (
        SELECT
          t."id",
          t."userId",
          t."type",
          t."categoryId",
          t."amountCents",
          t."description",
          t."occurredOn",
          t."createdAt",
          c."name" AS "categoryName",
          c."type" AS "categoryType"
        FROM "Transaction" t
        INNER JOIN "Category" c ON c."id" = t."categoryId"
        WHERE t."id" = ${transactionId}
          AND t."userId" = ${userId}
      ),
      candidates AS (
        SELECT
          candidate."type",
          candidate."categoryId",
          candidate."amountCents",
          (
            candidate."occurredOn",
            candidate."createdAt",
            candidate."id"
          ) < (
            target."occurredOn",
            target."createdAt",
            target."id"
          ) AS "isBefore",
          (
            candidate."amountCents" > target."amountCents"
            OR (
              candidate."amountCents" = target."amountCents"
              AND (
                candidate."occurredOn",
                candidate."createdAt",
                candidate."id"
              ) > (
                target."occurredOn",
                target."createdAt",
                target."id"
              )
            )
          ) AS "ranksAhead",
          candidate."categoryId" = target."categoryId" AS "sameCategory",
          candidate."type" = target."type" AS "sameType",
          DATE_TRUNC('month', candidate."occurredOn") =
            DATE_TRUNC('month', target."occurredOn") AS "inMonth",
          DATE_TRUNC('year', candidate."occurredOn") =
            DATE_TRUNC('year', target."occurredOn") AS "inYear"
        FROM target
        INNER JOIN "Transaction" candidate
          ON candidate."userId" = target."userId"
      )
      SELECT
        target."id",
        target."userId",
        target."type",
        target."categoryId",
        target."amountCents",
        target."description",
        target."occurredOn",
        target."createdAt",
        target."categoryName",
        target."categoryType",
        COALESCE(
          SUM(
            CASE
              WHEN candidates."isBefore"
                THEN CASE
                  WHEN candidates."type" = 'INCOME'::"TransactionType"
                    THEN candidates."amountCents"
                  ELSE -candidates."amountCents"
                END
              ELSE 0
            END
          ),
          0
        )::bigint AS "trackedBalanceBeforeCents",
        (
          COUNT(*) FILTER (
            WHERE candidates."sameCategory"
              AND candidates."inMonth"
              AND candidates."ranksAhead"
          ) + 1
        )::bigint AS "monthCategoryPosition",
        COUNT(*) FILTER (
          WHERE candidates."sameCategory"
            AND candidates."inMonth"
        )::bigint AS "monthCategoryTotal",
        (
          COUNT(*) FILTER (
            WHERE candidates."sameType"
              AND candidates."inMonth"
              AND candidates."ranksAhead"
          ) + 1
        )::bigint AS "monthTypePosition",
        COUNT(*) FILTER (
          WHERE candidates."sameType"
            AND candidates."inMonth"
        )::bigint AS "monthTypeTotal",
        COALESCE(
          SUM(candidates."amountCents") FILTER (
            WHERE candidates."sameType"
              AND candidates."inMonth"
          ),
          0
        )::bigint AS "monthTypeAmountCents",
        (
          COUNT(*) FILTER (
            WHERE candidates."sameCategory"
              AND candidates."inYear"
              AND candidates."ranksAhead"
          ) + 1
        )::bigint AS "yearCategoryPosition",
        COUNT(*) FILTER (
          WHERE candidates."sameCategory"
            AND candidates."inYear"
        )::bigint AS "yearCategoryTotal",
        (
          COUNT(*) FILTER (
            WHERE candidates."sameType"
              AND candidates."inYear"
              AND candidates."ranksAhead"
          ) + 1
        )::bigint AS "yearTypePosition",
        COUNT(*) FILTER (
          WHERE candidates."sameType"
            AND candidates."inYear"
        )::bigint AS "yearTypeTotal",
        COALESCE(
          SUM(candidates."amountCents") FILTER (
            WHERE candidates."sameType"
              AND candidates."inYear"
          ),
          0
        )::bigint AS "yearTypeAmountCents",
        (
          COUNT(*) FILTER (
            WHERE candidates."sameCategory"
              AND candidates."ranksAhead"
          ) + 1
        )::bigint AS "allCategoryPosition",
        COUNT(*) FILTER (
          WHERE candidates."sameCategory"
        )::bigint AS "allCategoryTotal",
        (
          COUNT(*) FILTER (
            WHERE candidates."sameType"
              AND candidates."ranksAhead"
          ) + 1
        )::bigint AS "allTypePosition",
        COUNT(*) FILTER (
          WHERE candidates."sameType"
        )::bigint AS "allTypeTotal",
        COALESCE(
          SUM(candidates."amountCents") FILTER (
            WHERE candidates."sameType"
          ),
          0
        )::bigint AS "allTypeAmountCents"
      FROM target
      INNER JOIN candidates ON TRUE
      GROUP BY
        target."id",
        target."userId",
        target."type",
        target."categoryId",
        target."amountCents",
        target."description",
        target."occurredOn",
        target."createdAt",
        target."categoryName",
        target."categoryType"
    `,
  );
  const row = rows[0];

  if (!row) {
    return null;
  }

  const trackedBalanceBeforeCents = toSafeNumber(
    row.trackedBalanceBeforeCents,
  );
  const signedAmountCents =
    row.type === "INCOME" ? row.amountCents : -row.amountCents;
  const transaction: TransactionWithCategory = {
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

  return {
    transaction: toTransactionResponse(transaction),
    trackedBalance: {
      before: centsToDecimal(trackedBalanceBeforeCents),
      after: centsToDecimal(
        trackedBalanceBeforeCents + signedAmountCents,
      ),
    },
    contexts: {
      month: createDetailContext(
        row.amountCents,
        row.monthCategoryPosition,
        row.monthCategoryTotal,
        row.monthTypePosition,
        row.monthTypeTotal,
        row.monthTypeAmountCents,
      ),
      year: createDetailContext(
        row.amountCents,
        row.yearCategoryPosition,
        row.yearCategoryTotal,
        row.yearTypePosition,
        row.yearTypeTotal,
        row.yearTypeAmountCents,
      ),
      all: createDetailContext(
        row.amountCents,
        row.allCategoryPosition,
        row.allCategoryTotal,
        row.allTypePosition,
        row.allTypeTotal,
        row.allTypeAmountCents,
      ),
    },
  };
}
