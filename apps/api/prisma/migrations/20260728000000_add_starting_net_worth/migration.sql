ALTER TABLE "User"
ADD COLUMN "startingNetWorthCents" INTEGER,
ADD COLUMN "startingNetWorthDate" DATE,
ADD COLUMN "startingNetWorthSetupAt" TIMESTAMP(3);

ALTER TABLE "User"
ADD CONSTRAINT "User_startingNetWorth_pair_check"
CHECK (
  (
    "startingNetWorthCents" IS NULL
    AND "startingNetWorthDate" IS NULL
  )
  OR (
    "startingNetWorthCents" IS NOT NULL
    AND "startingNetWorthDate" IS NOT NULL
  )
);
