CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

CREATE TABLE "Transaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "TransactionType" NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "description" VARCHAR(100) NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Transaction_amountCents_positive_check" CHECK ("amountCents" > 0),
  CONSTRAINT "Transaction_description_not_empty_check" CHECK (length(trim("description")) > 0)
);

CREATE INDEX "Transaction_userId_occurredAt_idx"
ON "Transaction"("userId", "occurredAt");
