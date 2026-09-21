-- CreateTable
CREATE TABLE "TransactionGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "categoryId" TEXT NOT NULL,
    "occurredOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionGroup_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Transaction"
ADD COLUMN "groupId" TEXT,
ADD COLUMN "groupOrder" INTEGER;

-- CreateIndex
CREATE INDEX "TransactionGroup_userId_occurredOn_idx" ON "TransactionGroup"("userId", "occurredOn");

-- CreateIndex
CREATE INDEX "TransactionGroup_categoryId_idx" ON "TransactionGroup"("categoryId");

-- CreateIndex
CREATE INDEX "Transaction_groupId_groupOrder_idx" ON "Transaction"("groupId", "groupOrder");

-- AddForeignKey
ALTER TABLE "TransactionGroup" ADD CONSTRAINT "TransactionGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionGroup" ADD CONSTRAINT "TransactionGroup_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TransactionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
