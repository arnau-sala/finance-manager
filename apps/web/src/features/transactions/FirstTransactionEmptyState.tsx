import { ChevronRight, Plus, ReceiptText } from "lucide-react";

type FirstTransactionEmptyStateProps = {
  headingId: string;
  onNewTransaction: () => void;
};

export function FirstTransactionEmptyState({
  headingId,
  onNewTransaction
}: FirstTransactionEmptyStateProps) {
  return (
    <div className="first-transaction-empty">
      <ReceiptText aria-hidden="true" />
      <h2 id={headingId}>No transactions yet</h2>
      <p>
        Add your first transaction to start seeing your financial information.
      </p>
      <button
        className="home-new-transaction first-transaction-empty__action"
        type="button"
        onClick={onNewTransaction}
      >
        <span className="home-new-transaction__icon" aria-hidden="true">
          <Plus />
        </span>
        <span>New transaction</span>
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}
