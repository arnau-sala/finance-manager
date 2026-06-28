UPDATE "AccessRequestEvent"
SET "accessRequestId" = NULL
WHERE "type" = 'ACCESS_REQUEST_DISCARDED';

ALTER TABLE "AccessRequestEvent"
ADD CONSTRAINT "AccessRequestEvent_accessRequestId_by_type_check"
CHECK (
  (
    "type" = 'ACCESS_REQUEST_DISCARDED'
    AND "accessRequestId" IS NULL
  )
  OR
  (
    "type" <> 'ACCESS_REQUEST_DISCARDED'
    AND "accessRequestId" IS NOT NULL
  )
);
