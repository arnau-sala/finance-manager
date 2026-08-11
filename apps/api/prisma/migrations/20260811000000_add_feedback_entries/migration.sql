CREATE TYPE "FeedbackType" AS ENUM ('GENERAL', 'SUGGESTION');

CREATE TABLE "FeedbackEntry" (
  "id" TEXT NOT NULL,
  "type" "FeedbackType" NOT NULL,
  "userId" TEXT,
  "email" TEXT,
  "message" VARCHAR(1000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FeedbackEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeedbackEntry_type_createdAt_idx" ON "FeedbackEntry"("type", "createdAt");
CREATE INDEX "FeedbackEntry_userId_createdAt_idx" ON "FeedbackEntry"("userId", "createdAt");

ALTER TABLE "FeedbackEntry"
ADD CONSTRAINT "FeedbackEntry_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
