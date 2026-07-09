import type { Prisma } from "@prisma/client";

import { db } from "../db/client.js";
import { centsToDecimal } from "../money/cents.js";

type BalanceDateRange = {
  from: Date;
  to: Date;
};

export async function getUserBalance(
  userId: string,
  dateRange?: BalanceDateRange
) {
  const where: Prisma.TransactionWhereInput = {
    userId
  };

  if (dateRange) {
    where.occurredAt = {
      gte: dateRange.from,
      lt: dateRange.to
    };
  }

  const totals = await db.transaction.groupBy({
    by: ["type"],
    where,
    _sum: {
      amountCents: true
    }
  });

  const totalIncomeCents =
    totals.find((total) => total.type === "INCOME")?._sum.amountCents ?? 0;
  const totalSpentCents =
    totals.find((total) => total.type === "EXPENSE")?._sum.amountCents ?? 0;
  const totalBalanceCents = totalIncomeCents - totalSpentCents;

  return {
    totalIncome: centsToDecimal(totalIncomeCents),
    totalSpent: centsToDecimal(totalSpentCents),
    totalBalance: centsToDecimal(totalBalanceCents)
  };
}
