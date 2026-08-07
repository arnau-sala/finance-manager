CREATE TYPE "GoogleAuthIntent" AS ENUM ('LOGIN', 'REGISTER');
CREATE TYPE "GoogleAuthActionType" AS ENUM (
    'CREATE_ACCOUNT',
    'SIGN_IN_WITH_GOOGLE',
    'SIGN_IN_WITH_PASSWORD'
);

CREATE TABLE "PendingGoogleAuthAction" (
    "id" TEXT NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "intent" "GoogleAuthIntent" NOT NULL,
    "action" "GoogleAuthActionType" NOT NULL,
    "email" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "googleSubject" TEXT NOT NULL,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingGoogleAuthAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingGoogleAuthAction_tokenHash_key"
ON "PendingGoogleAuthAction"("tokenHash");

CREATE INDEX "PendingGoogleAuthAction_expiresAt_idx"
ON "PendingGoogleAuthAction"("expiresAt");

CREATE INDEX "PendingGoogleAuthAction_userId_idx"
ON "PendingGoogleAuthAction"("userId");

ALTER TABLE "PendingGoogleAuthAction"
ADD CONSTRAINT "PendingGoogleAuthAction_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
