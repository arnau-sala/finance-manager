ALTER TABLE "AccessRequestEvent"
DROP CONSTRAINT "AccessRequestEvent_adminId_fkey";

DROP INDEX "AccessRequestEvent_adminId_idx";

ALTER TABLE "AccessRequestEvent"
DROP COLUMN "adminId";

ALTER TABLE "ApprovedEmail"
DROP CONSTRAINT "ApprovedEmail_approvedById_fkey";

DROP INDEX "ApprovedEmail_approvedById_idx";

ALTER TABLE "ApprovedEmail"
DROP COLUMN "approvedById";
