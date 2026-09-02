CREATE TYPE "CurrencyCode" AS ENUM ('EUR', 'USD');

ALTER TABLE "Transaction"
ADD COLUMN "currency" "CurrencyCode" NOT NULL DEFAULT 'EUR',
ADD COLUMN "originalAmountMinor" INTEGER,
ADD COLUMN "exchangeRateBasePerUsd" DECIMAL(38, 20);

ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_originalAmountMinor_positive_check"
CHECK ("originalAmountMinor" IS NULL OR "originalAmountMinor" > 0);

ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_exchangeRateBasePerUsd_positive_check"
CHECK ("exchangeRateBasePerUsd" IS NULL OR "exchangeRateBasePerUsd" > 0);

CREATE INDEX "Transaction_userId_currency_occurredOn_idx"
ON "Transaction"("userId", "currency", "occurredOn");

CREATE TABLE "CurrencyExchange" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fromCurrency" "CurrencyCode" NOT NULL,
  "toCurrency" "CurrencyCode" NOT NULL,
  "fromAmountMinor" INTEGER NOT NULL,
  "toAmountMinor" INTEGER NOT NULL,
  "exchangeRateBasePerUsd" DECIMAL(38, 20) NOT NULL,
  "occurredOn" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CurrencyExchange_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CurrencyExchange_distinct_currencies_check" CHECK ("fromCurrency" <> "toCurrency"),
  CONSTRAINT "CurrencyExchange_fromAmountMinor_positive_check" CHECK ("fromAmountMinor" > 0),
  CONSTRAINT "CurrencyExchange_toAmountMinor_positive_check" CHECK ("toAmountMinor" > 0),
  CONSTRAINT "CurrencyExchange_exchangeRateBasePerUsd_positive_check" CHECK ("exchangeRateBasePerUsd" > 0)
);

CREATE INDEX "CurrencyExchange_userId_occurredOn_idx"
ON "CurrencyExchange"("userId", "occurredOn");

CREATE INDEX "CurrencyExchange_userId_createdAt_idx"
ON "CurrencyExchange"("userId", "createdAt");

ALTER TABLE "CurrencyExchange"
ADD CONSTRAINT "CurrencyExchange_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
