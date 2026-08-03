ALTER TABLE "User"
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

UPDATE "User"
SET "emailVerifiedAt" = "createdAt";

ALTER TABLE "User"
ALTER COLUMN "emailVerifiedAt" SET NOT NULL,
ALTER COLUMN "emailVerifiedAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "PendingRegistration" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "verificationCodeHash" CHAR(64) NOT NULL,
    "verificationAttempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingRegistration_email_key"
ON "PendingRegistration"("email");

CREATE INDEX "PendingRegistration_updatedAt_idx"
ON "PendingRegistration"("updatedAt");

DROP TABLE "AccessRequestEvent";
DROP TABLE "AccessRequest";
DROP TABLE "ApprovedEmail";

DROP TYPE "AccessRequestEventActorType";
DROP TYPE "AccessRequestDiscardReason";
DROP TYPE "AccessRequestEventType";
