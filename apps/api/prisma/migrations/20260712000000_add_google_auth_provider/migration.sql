CREATE TYPE "AuthProvider" AS ENUM ('PASSWORD', 'GOOGLE');

ALTER TABLE "User"
ADD COLUMN "authProvider" "AuthProvider" NOT NULL DEFAULT 'PASSWORD',
ADD COLUMN "googleSubject" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");
