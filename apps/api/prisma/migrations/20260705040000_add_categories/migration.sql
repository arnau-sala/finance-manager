CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Category_name_type_key" ON "Category"("name", "type");

INSERT INTO "Category" ("id", "name", "type") VALUES
    ('expense-housing', 'Housing', 'EXPENSE'),
    ('expense-utilities', 'Utilities', 'EXPENSE'),
    ('expense-groceries', 'Groceries', 'EXPENSE'),
    ('expense-dining-out', 'Dining Out', 'EXPENSE'),
    ('expense-transportation', 'Transportation', 'EXPENSE'),
    ('expense-healthcare', 'Healthcare', 'EXPENSE'),
    ('expense-insurance', 'Insurance', 'EXPENSE'),
    ('expense-education', 'Education', 'EXPENSE'),
    ('expense-entertainment', 'Entertainment', 'EXPENSE'),
    ('expense-shopping', 'Shopping', 'EXPENSE'),
    ('expense-subscriptions', 'Subscriptions', 'EXPENSE'),
    ('expense-travel', 'Travel', 'EXPENSE'),
    ('expense-personal-care', 'Personal Care', 'EXPENSE'),
    ('expense-pets', 'Pets', 'EXPENSE'),
    ('expense-childcare', 'Childcare', 'EXPENSE'),
    ('expense-debt-payments', 'Debt Payments', 'EXPENSE'),
    ('expense-taxes', 'Taxes', 'EXPENSE'),
    ('expense-gifts-donations', 'Gifts & Donations', 'EXPENSE'),
    ('expense-other', 'Other Expense', 'EXPENSE'),
    ('income-salary', 'Salary', 'INCOME'),
    ('income-freelance', 'Freelance', 'INCOME'),
    ('income-business', 'Business Income', 'INCOME'),
    ('income-investments', 'Investment Income', 'INCOME'),
    ('income-rental', 'Rental Income', 'INCOME'),
    ('income-benefits', 'Benefits', 'INCOME'),
    ('income-gifts', 'Gifts Received', 'INCOME'),
    ('income-refunds', 'Refunds', 'INCOME'),
    ('income-other', 'Other Income', 'INCOME');

ALTER TABLE "Transaction" ADD COLUMN "categoryId" TEXT;

UPDATE "Transaction"
SET "categoryId" = CASE
    WHEN "type" = 'INCOME' THEN 'income-other'
    ELSE 'expense-other'
END;

ALTER TABLE "Transaction" ALTER COLUMN "categoryId" SET NOT NULL;

CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId");

ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
