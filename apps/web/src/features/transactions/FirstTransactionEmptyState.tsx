import { ChevronRight, Plus, ReceiptEuro } from "lucide-react";

import { ActionButton } from "../../components/ui/ActionButton";

type FirstTransactionEmptyStateProps = {
  headingId: string;
  description: string;
  onNewTransaction: () => void;
};

export function FirstTransactionEmptyState({
  headingId,
  description,
  onNewTransaction
}: FirstTransactionEmptyStateProps) {
  return (
    <div className="first-transaction-empty">
      <ReceiptEuro aria-hidden="true" />
      <h2 id={headingId}>No transactions yet</h2>
      <p>{description}</p>
      <ActionButton
        className="home-new-transaction first-transaction-empty__action"
        type="button"
        onClick={onNewTransaction}
      >
        <span className="home-new-transaction__icon" aria-hidden="true">
          <Plus />
        </span>
        <span>New transaction</span>
        <ChevronRight aria-hidden="true" />
      </ActionButton>
    </div>
  );
}
