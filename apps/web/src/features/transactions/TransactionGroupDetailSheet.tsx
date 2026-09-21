import { useState } from "react";
import { createPortal } from "react-dom";
import { Edit3, Layers, Trash2, X } from "lucide-react";

import { invalidateAfterTransactionWrite } from "../../cache/financial-cache";
import { ActionButton } from "../../components/ui/ActionButton";
import { parseLocalDateOnly } from "../../dates/date-only";
import { formatEuroAmount, formatMoneyAmount } from "../../money/format-euro";
import { getCategoryIcon } from "./category-catalog";
import {
  deleteTransactionGroup,
  type TransactionGroupListItem
} from "./transaction-groups-api";

type TransactionGroupDetailSheetProps = {
  userId: string;
  group: TransactionGroupListItem | null;
  onClose: () => void;
  onEdit: (group: TransactionGroupListItem) => void;
  onDeleted: () => void;
};

function formatDate(value: string) {
  const date = parseLocalDateOnly(value);

  if (!date) return value;

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

export function TransactionGroupDetailSheet({
  userId,
  group,
  onClose,
  onEdit,
  onDeleted
}: TransactionGroupDetailSheetProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  if (!group) return null;

  const Icon = getCategoryIcon(group.categoryId, group.category.type);
  const netTotal = Number(group.netTotal);

  async function confirmDeleteGroup() {
    const currentGroup = group;

    if (!currentGroup) {
      return;
    }

    setIsDeleting(true);
    setDeleteError("");
    try {
      await deleteTransactionGroup(currentGroup.id);
      await invalidateAfterTransactionWrite(userId);
      onDeleted();
      onClose();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Unable to delete group");
    } finally {
      setIsDeleting(false);
    }
  }

  return createPortal(
    <section
      className="transaction-detail-sheet is-open"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-group-detail-title"
    >
      <div className="transaction-detail-sheet__panel transaction-detail-sheet__panel--group">
        <div className="transaction-detail-sheet__content">
          <div className="transaction-detail-hero">
            <span className="transaction-detail-hero__icon" aria-hidden="true">
              <Icon />
            </span>
            <p>{group.category.name} &middot; Group</p>
            <h2 id="transaction-group-detail-title">{group.title}</h2>
            <strong
              className={`transaction-detail-hero__amount${
                netTotal > 0
                  ? " transaction-detail-hero__amount--income"
                  : netTotal < 0
                    ? " transaction-detail-hero__amount--expense"
                    : ""
              }`}
            >
              {netTotal === 0
                ? formatEuroAmount(0)
                : formatEuroAmount(netTotal, { showSign: true })}
            </strong>
            <time dateTime={group.date}>{formatDate(group.date)}</time>
          </div>

          <section className="transaction-group-detail-lines">
            <h3>
              <Layers aria-hidden="true" />
              Transactions
            </h3>
            <ul>
              {group.transactions.map((line) => {
                const amount = Number(line.originalAmount ?? line.amount);
                return (
                  <li key={line.id}>
                    <span>{line.description}</span>
                    <strong>
                      {formatMoneyAmount(
                        line.type === "INCOME" ? amount : -amount,
                        {
                          showSign: true,
                          currency: line.currency ?? "EUR"
                        }
                      )}
                    </strong>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {confirmDelete ? (
          <div className="transaction-detail-delete-confirm" role="alertdialog">
            <strong>Delete permanently?</strong>
            <span className="transaction-detail-delete-confirm__summary">
              <span>{group.title}</span>
              <b>{formatEuroAmount(netTotal, { showSign: netTotal !== 0 })}</b>
            </span>
            {deleteError ? (
              <p className="transaction-detail-delete-confirm__error">
                {deleteError}
              </p>
            ) : null}
            <div className="transaction-detail-delete-confirm__actions">
              <ActionButton type="button" onClick={() => setConfirmDelete(false)}>
                Cancel
              </ActionButton>
              <ActionButton
                type="button"
                className="transaction-detail-delete-confirm__submit"
                disabled={isDeleting}
                onClick={() => void confirmDeleteGroup()}
              >
                {isDeleting ? "Deleting" : "Delete"}
              </ActionButton>
            </div>
          </div>
        ) : null}

        <div className="transaction-detail-sheet__floating-actions">
          <ActionButton
            shape="icon"
            className="transaction-detail-sheet__floating-action"
            type="button"
            aria-label="Edit group"
            title="Edit"
            onClick={() => onEdit(group)}
          >
            <Edit3 aria-hidden="true" />
          </ActionButton>
          <ActionButton
            shape="icon"
            className="transaction-detail-sheet__floating-action transaction-detail-sheet__floating-action--delete"
            type="button"
            aria-label="Delete group"
            title="Delete"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 aria-hidden="true" />
          </ActionButton>
        </div>

        <ActionButton
          shape="icon"
          className="transaction-detail-sheet__close"
          type="button"
          aria-label="Close group details"
          title="Close"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </ActionButton>
      </div>
    </section>,
    document.body
  );
}
