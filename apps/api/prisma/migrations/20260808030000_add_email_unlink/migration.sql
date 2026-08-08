CREATE TABLE "PendingEmailUnlink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "verificationCodeHash" CHAR(64) NOT NULL,
    "verificationAttempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingEmailUnlink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingEmailUnlink_userId_key"
ON "PendingEmailUnlink"("userId");

CREATE INDEX "PendingEmailUnlink_updatedAt_idx"
ON "PendingEmailUnlink"("updatedAt");

ALTER TABLE "PendingEmailUnlink"
ADD CONSTRAINT "PendingEmailUnlink_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
