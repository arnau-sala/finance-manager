CREATE TYPE "PasswordResetMethod" AS ENUM ('EMAIL_CODE', 'RECOVERY_CODE');
CREATE TYPE "PasswordResetEmailKind" AS ENUM ('RESET_CODE', 'GOOGLE_GUIDANCE');

CREATE UNIQUE INDEX "AccountRecoveryCode_codeHash_key"
ON "AccountRecoveryCode"("codeHash");

CREATE TABLE "PendingPasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "kind" "PasswordResetEmailKind" NOT NULL,
    "verificationCodeHash" CHAR(64),
    "verificationAttempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingPasswordReset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingPasswordReset_userId_key"
ON "PendingPasswordReset"("userId");

CREATE UNIQUE INDEX "PendingPasswordReset_email_key"
ON "PendingPasswordReset"("email");

CREATE INDEX "PendingPasswordReset_updatedAt_idx"
ON "PendingPasswordReset"("updatedAt");

ALTER TABLE "PendingPasswordReset"
ADD CONSTRAINT "PendingPasswordReset_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PasswordResetGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" "PasswordResetMethod" NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "recoveryCodeHash" CHAR(64),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetGrant_userId_key"
ON "PasswordResetGrant"("userId");

CREATE UNIQUE INDEX "PasswordResetGrant_tokenHash_key"
ON "PasswordResetGrant"("tokenHash");

CREATE INDEX "PasswordResetGrant_expiresAt_idx"
ON "PasswordResetGrant"("expiresAt");

ALTER TABLE "PasswordResetGrant"
ADD CONSTRAINT "PasswordResetGrant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
