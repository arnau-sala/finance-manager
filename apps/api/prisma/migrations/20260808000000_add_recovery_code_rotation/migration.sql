ALTER TABLE "AccountRecoveryCode"
ADD COLUMN "pendingCodeHash" CHAR(64),
ADD COLUMN "pendingRotationTokenHash" CHAR(64),
ADD COLUMN "pendingRotationExpiresAt" TIMESTAMP(3),
ADD COLUMN "pendingSignOutOtherDevices" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "AccountRecoveryCode_pendingCodeHash_key"
ON "AccountRecoveryCode"("pendingCodeHash");

CREATE UNIQUE INDEX "AccountRecoveryCode_pendingRotationTokenHash_key"
ON "AccountRecoveryCode"("pendingRotationTokenHash");
