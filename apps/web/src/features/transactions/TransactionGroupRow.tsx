import { Layers } from "lucide-react";

import { parseLocalDateOnly } from "../../dates/date-only";
import { formatEuroAmount } from "../../money/format-euro";
import type { TransactionGroupListItem } from "./transaction-groups-api";

function formatGroupDate(value: string) {
  const date = parseLocalDateOnly(value);

  if (!date) {
    return "Date unavailable";
  }

  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (isToday) {
    return "Today";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric"
  }).format(date);
}

function getGroupAmountTone(netTotalCents: number) {
  if (netTotalCents > 0) return "income";
  if (netTotalCents < 0) return "expense";
  return "neutral";
}

export function TransactionGroupRow({
  group,
  onSelect
}: {
  group: TransactionGroupListItem;
  onSelect?: () => void;
}) {
  const tone = getGroupAmountTone(group.netTotalCents);
  const amount =
    group.netTotalCents === 0
      ? formatEuroAmount(0)
      : formatEuroAmount(Number(group.netTotal), { showSign: true });
  const content = (
    <>
      <span className="transaction-row__icon transaction-row__icon--group" aria-hidden="true">
        <Layers />
      </span>
      <span className="transaction-row__details">
        <strong>{group.title}</strong>
        <span>
          {group.category.name} &middot; {formatGroupDate(group.date)} &middot;{" "}
          {group.transactions.length} lines
        </span>
      </span>
      <span
        className={`transaction-row__amount transaction-row__amount--${tone}`}
      >
        {amount}
      </span>
    </>
  );

  return (
    <li className="transaction-row transaction-row--group">
      {onSelect ? (
        <button
          className="transaction-row__content"
          type="button"
          aria-label={`View ${group.title} group details`}
          onClick={onSelect}
        >
          {content}
        </button>
      ) : (
        <div className="transaction-row__content">{content}</div>
      )}
    </li>
  );
}
