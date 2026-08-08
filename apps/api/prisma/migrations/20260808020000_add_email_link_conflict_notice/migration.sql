CREATE TABLE "EmailLinkConflictNotice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailLinkConflictNotice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailLinkConflictNotice_userId_key"
ON "EmailLinkConflictNotice"("userId");

CREATE INDEX "EmailLinkConflictNotice_updatedAt_idx"
ON "EmailLinkConflictNotice"("updatedAt");

ALTER TABLE "EmailLinkConflictNotice"
ADD CONSTRAINT "EmailLinkConflictNotice_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
