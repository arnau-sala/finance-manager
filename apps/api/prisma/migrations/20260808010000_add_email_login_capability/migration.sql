ALTER TABLE "User"
ADD COLUMN "emailLoginEnabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET "emailLoginEnabled" = true
WHERE "email" IS NOT NULL
  AND "passwordHash" IS NOT NULL
  AND (
    "authProvider" = 'PASSWORD'
    OR (
      "authProvider" = 'PASSWORD_AND_GOOGLE'
      AND "username" IS NULL
    )
  );

ALTER TABLE "PendingEmailLink"
ADD COLUMN "passwordHash" TEXT;
