-- CreateTable
CREATE TABLE "TransactionGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "categoryId" TEXT NOT NULL,
    "occurredOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionGroup_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Transaction"
ADD COLUMN "groupId" TEXT,
ADD COLUMN "groupOrder" INTEGER;

-- CreateIndex
CREATE INDEX "TransactionGroup_userId_occurredOn_idx" ON "TransactionGroup"("userId", "occurredOn");

-- CreateIndex
CREATE INDEX "TransactionGroup_categoryId_idx" ON "TransactionGroup"("categoryId");

-- CreateIndex
CREATE INDEX "Transaction_groupId_groupOrder_idx" ON "Transaction"("groupId", "groupOrder");

-- AddForeignKey
ALTER TABLE "TransactionGroup" ADD CONSTRAINT "TransactionGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionGroup" ADD CONSTRAINT "TransactionGroup_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TransactionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateView
CREATE VIEW "FinancialOperation" AS
SELECT
    t."id" AS "id",
    t."userId" AS "userId",
    'TRANSACTION'::text AS "sourceType",
    t."id" AS "sourceId",
    t."type" AS "type",
    t."categoryId" AS "categoryId",
    t."amountCents"::bigint AS "amountCents",
    CASE
        WHEN t."type" = 'INCOME'::"TransactionType" THEN t."amountCents"::bigint
        ELSE -t."amountCents"::bigint
    END AS "signedAmountCents",
    t."description" AS "description",
    t."occurredOn" AS "occurredOn",
    t."createdAt" AS "createdAt"
FROM "Transaction" t
WHERE t."groupId" IS NULL

UNION ALL

SELECT
    g."id" AS "id",
    g."userId" AS "userId",
    'TRANSACTION_GROUP'::text AS "sourceType",
    g."id" AS "sourceId",
    CASE
        WHEN group_totals."signedAmountCents" > 0 THEN 'INCOME'::"TransactionType"
        WHEN group_totals."signedAmountCents" < 0 THEN 'EXPENSE'::"TransactionType"
        ELSE NULL
    END AS "type",
    g."categoryId" AS "categoryId",
    ABS(group_totals."signedAmountCents") AS "amountCents",
    group_totals."signedAmountCents" AS "signedAmountCents",
    g."title" AS "description",
    g."occurredOn" AS "occurredOn",
    g."createdAt" AS "createdAt"
FROM "TransactionGroup" g
LEFT JOIN LATERAL (
    SELECT
        COALESCE(
            SUM(
                CASE
                    WHEN t."type" = 'INCOME'::"TransactionType" THEN t."amountCents"::bigint
                    ELSE -t."amountCents"::bigint
                END
            ),
            0
        ) AS "signedAmountCents"
    FROM "Transaction" t
    WHERE t."groupId" = g."id"
) group_totals ON TRUE;
