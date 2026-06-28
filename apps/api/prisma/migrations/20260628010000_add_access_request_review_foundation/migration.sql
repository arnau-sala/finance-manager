-- AccessRequest now represents only the current pending queue.
DROP INDEX "AccessRequest_pending_email_key";
DROP INDEX "AccessRequest_email_idx";
DROP INDEX "AccessRequest_status_idx";
DROP INDEX "AccessRequest_reviewedById_idx";

ALTER TABLE "AccessRequest"
DROP CONSTRAINT "AccessRequest_reviewedById_fkey";

ALTER TABLE "AccessRequest"
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "message" SET NOT NULL,
DROP COLUMN "status",
DROP COLUMN "reviewedAt",
DROP COLUMN "reviewedById";

DROP TYPE "AccessRequestStatus";

CREATE UNIQUE INDEX "AccessRequest_email_key" ON "AccessRequest"("email");

CREATE TYPE "RejectedAccessRequestReason" AS ENUM (
  'EMAIL_ALREADY_REGISTERED',
  'ACCESS_REQUEST_ALREADY_EXISTS'
);

CREATE TABLE "RejectedAccessRequest" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "reason" "RejectedAccessRequestReason" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RejectedAccessRequest_pkey" PRIMARY KEY ("id")
);
