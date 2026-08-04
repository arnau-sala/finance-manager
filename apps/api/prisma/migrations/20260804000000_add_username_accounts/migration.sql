ALTER TABLE "User"
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "emailVerifiedAt" DROP DEFAULT,
ALTER COLUMN "emailVerifiedAt" DROP NOT NULL,
ADD COLUMN "username" VARCHAR(30);

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

ALTER TABLE "User"
ADD CONSTRAINT "User_login_identifier_check"
CHECK ("email" IS NOT NULL OR "username" IS NOT NULL);

CREATE TABLE "AccountRecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountRecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountRecoveryCode_userId_key"
ON "AccountRecoveryCode"("userId");

ALTER TABLE "AccountRecoveryCode"
ADD CONSTRAINT "AccountRecoveryCode_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PendingEmailLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "verificationCodeHash" CHAR(64) NOT NULL,
    "verificationAttempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingEmailLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingEmailLink_userId_key"
ON "PendingEmailLink"("userId");

CREATE UNIQUE INDEX "PendingEmailLink_email_key"
ON "PendingEmailLink"("email");

CREATE INDEX "PendingEmailLink_updatedAt_idx"
ON "PendingEmailLink"("updatedAt");

ALTER TABLE "PendingEmailLink"
ADD CONSTRAINT "PendingEmailLink_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
