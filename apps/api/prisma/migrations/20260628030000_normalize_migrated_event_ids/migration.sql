DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "AccessRequestEvent" AS migrated_event
    JOIN "AccessRequestEvent" AS existing_event
      ON existing_event."id" = migrated_event."accessRequestId"
    WHERE migrated_event."id" LIKE 'migrated_%'
      AND existing_event."id" <> migrated_event."id"
  ) THEN
    RAISE EXCEPTION 'Cannot normalize migrated event ids because an id is already in use';
  END IF;
END $$;

UPDATE "AccessRequestEvent"
SET "id" = "accessRequestId"
WHERE "id" LIKE 'migrated_%'
  AND "type" = 'ACCESS_REQUEST_CREATED'
  AND "accessRequestId" IS NOT NULL;
