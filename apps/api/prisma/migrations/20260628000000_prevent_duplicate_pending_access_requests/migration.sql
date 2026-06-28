CREATE UNIQUE INDEX "AccessRequest_pending_email_key"
ON "AccessRequest"("email")
WHERE "status" = 'PENDING';
