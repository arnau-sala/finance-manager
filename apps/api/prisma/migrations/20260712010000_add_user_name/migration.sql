ALTER TABLE "User"
ADD COLUMN "name" VARCHAR(100);

UPDATE "User"
SET "name" = LEFT(split_part("email", '@', 1), 100)
WHERE "name" IS NULL;

ALTER TABLE "User"
ALTER COLUMN "name" SET NOT NULL;
