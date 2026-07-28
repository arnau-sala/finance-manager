ALTER TABLE "User"
DROP CONSTRAINT IF EXISTS "User_startingNetWorth_pair_check";

UPDATE "User"
SET "startingNetWorthCents" = 0
WHERE
  "startingNetWorthSetupAt" IS NOT NULL
  AND "startingNetWorthCents" IS NULL;

ALTER TABLE "User"
DROP COLUMN "startingNetWorthDate",
DROP COLUMN "startingNetWorthSetupAt";
