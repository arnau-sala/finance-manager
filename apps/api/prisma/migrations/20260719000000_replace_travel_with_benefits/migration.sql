UPDATE "Transaction"
SET "categoryId" = 'expense-other'
WHERE "categoryId" = 'expense-travel';

DELETE FROM "Category"
WHERE "id" = 'expense-travel';

INSERT INTO "Category" ("id", "name", "type")
VALUES ('income-benefits', 'Benefits', 'INCOME');
