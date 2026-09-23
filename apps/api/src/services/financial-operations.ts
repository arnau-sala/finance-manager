import type { TransactionType } from "@prisma/client";

export type SignedAmountInput = {
  type: TransactionType;
  amountCents: number;
};

export function getSignedAmountCents(transaction: SignedAmountInput) {
  return transaction.type === "INCOME"
    ? transaction.amountCents
    : -transaction.amountCents;
}

export function getNetOperationSummary(
  transactions: readonly SignedAmountInput[],
) {
  const netTotalCents = transactions.reduce(
    (total, transaction) => total + getSignedAmountCents(transaction),
    0,
  );

  return {
    netTotalCents,
    amountCents: Math.abs(netTotalCents),
    type:
      netTotalCents > 0
        ? ("INCOME" as const)
        : netTotalCents < 0
          ? ("EXPENSE" as const)
          : null,
  };
}
