INSERT INTO "Category" ("id", "name", "type")
VALUES ('expense-transport', 'Transport', 'EXPENSE');

UPDATE "Transaction"
SET "categoryId" = 'expense-transport'
WHERE "categoryId" = 'expense-transportation';

DELETE FROM "Category"
WHERE "id" = 'expense-transportation';
