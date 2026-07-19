INSERT INTO "Category" ("id", "name", "type")
VALUES ('expense-dining', 'Dining', 'EXPENSE');

UPDATE "Transaction"
SET "categoryId" = 'expense-dining'
WHERE "categoryId" = 'expense-bars-restaurants';

DELETE FROM "Category"
WHERE "id" = 'expense-bars-restaurants';
