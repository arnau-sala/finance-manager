UPDATE "AccessRequestEvent" AS target
SET "accessRequestId" = (
  SELECT COALESCE(created."accessRequestId", created."id")
  FROM "AccessRequestEvent" AS created
  WHERE created."email" = target."email"
    AND created."type" = 'ACCESS_REQUEST_CREATED'
    AND created."timestamp" <= target."timestamp"
  ORDER BY created."timestamp" DESC
  LIMIT 1
)
WHERE target."accessRequestId" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "AccessRequestEvent" AS created
    WHERE created."email" = target."email"
      AND created."type" = 'ACCESS_REQUEST_CREATED'
      AND created."timestamp" <= target."timestamp"
  );
