ALTER TABLE "Transaction"
RENAME COLUMN "occurredAt" TO "occurredOn";

ALTER TABLE "Transaction"
ALTER COLUMN "occurredOn" TYPE DATE
USING "occurredOn"::date;

ALTER INDEX "Transaction_userId_occurredAt_idx"
RENAME TO "Transaction_userId_occurredOn_idx";
