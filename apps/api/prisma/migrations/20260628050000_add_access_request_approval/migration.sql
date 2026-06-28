ALTER TABLE "AccessRequestEvent"
RENAME COLUMN "createdAt" TO "timestamp";

ALTER TABLE "AccessRequestEvent"
ADD COLUMN "adminId" TEXT;

ALTER TABLE "AccessRequestEvent"
ADD CONSTRAINT "AccessRequestEvent_adminId_fkey"
FOREIGN KEY ("adminId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "AccessRequestEvent_adminId_idx"
ON "AccessRequestEvent"("adminId");
