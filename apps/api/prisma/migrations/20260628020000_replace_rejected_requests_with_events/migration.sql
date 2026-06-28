CREATE TYPE "AccessRequestEventType" AS ENUM (
  'ACCESS_REQUEST_CREATED',
  'ACCESS_REQUEST_DISCARDED',
  'ACCESS_REQUEST_APPROVED',
  'ACCESS_REQUEST_DENIED'
);

CREATE TYPE "AccessRequestDiscardReason" AS ENUM (
  'EMAIL_ALREADY_REGISTERED',
  'ACCESS_REQUEST_ALREADY_EXISTS'
);

CREATE TYPE "AccessRequestEventActorType" AS ENUM (
  'VISITOR',
  'SYSTEM',
  'ADMIN'
);

ALTER TABLE "RejectedAccessRequest" RENAME TO "AccessRequestEvent";
ALTER TABLE "AccessRequestEvent"
RENAME CONSTRAINT "RejectedAccessRequest_pkey" TO "AccessRequestEvent_pkey";

ALTER TABLE "AccessRequestEvent"
ADD COLUMN "accessRequestId" TEXT,
ADD COLUMN "type" "AccessRequestEventType",
ADD COLUMN "actorType" "AccessRequestEventActorType";

ALTER TABLE "AccessRequestEvent"
ALTER COLUMN "reason" TYPE "AccessRequestDiscardReason"
USING "reason"::text::"AccessRequestDiscardReason";

ALTER TABLE "AccessRequestEvent" RENAME COLUMN "reason" TO "discardReason";

ALTER TABLE "AccessRequestEvent"
ALTER COLUMN "discardReason" DROP NOT NULL;

UPDATE "AccessRequestEvent"
SET
  "type" = 'ACCESS_REQUEST_DISCARDED',
  "actorType" = 'SYSTEM';

ALTER TABLE "AccessRequestEvent"
ALTER COLUMN "type" SET NOT NULL,
ALTER COLUMN "actorType" SET NOT NULL;

ALTER TABLE "AccessRequestEvent"
ADD CONSTRAINT "AccessRequestEvent_accessRequestId_fkey"
FOREIGN KEY ("accessRequestId") REFERENCES "AccessRequest"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AccessRequestEvent_accessRequestId_idx"
ON "AccessRequestEvent"("accessRequestId");

INSERT INTO "AccessRequestEvent" (
  "id",
  "accessRequestId",
  "email",
  "name",
  "message",
  "type",
  "discardReason",
  "actorType",
  "createdAt"
)
SELECT
  'migrated_' || md5("id"),
  "id",
  "email",
  "name",
  "message",
  'ACCESS_REQUEST_CREATED',
  NULL,
  'VISITOR',
  "createdAt"
FROM "AccessRequest";

DROP TYPE "RejectedAccessRequestReason";
