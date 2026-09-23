import { parseLocalDateOnly } from "../../dates/date-only";
import { formatMoneyAmount, type MoneyCurrencyCode } from "../../money/format-euro";
import { getCategoryIcon } from "./category-catalog";
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
  const Icon = getCategoryIcon(group.categoryId, group.category.type);
  const stackCount = group.transactions.length > 2 ? 3 : 2;
  const displayCurrency = (group.displayCurrency ?? "EUR") as MoneyCurrencyCode;
  const displayNetTotal = group.displayNetTotal ?? group.netTotal;
  const displayNetTotalCents = group.displayNetTotalCents ?? group.netTotalCents;
  const amount =
    displayNetTotalCents === 0
      ? formatMoneyAmount(0, { currency: displayCurrency })
      : formatMoneyAmount(Number(displayNetTotal), {
          currency: displayCurrency,
          showSign: true
        });
  const content = (
    <>
      <span
        className={`transaction-group-row-icon transaction-group-row-icon--${stackCount}`}
        aria-hidden="true"
      >
        {Array.from({ length: stackCount }, (_, index) => {
          const isFront = index === stackCount - 1;

          return (
            <span
              className={`transaction-group-row-icon__circle${
                isFront ? " transaction-group-row-icon__circle--front" : ""
              }`}
              key={index}
            >
              {isFront ? <Icon /> : null}
            </span>
          );
        })}
      </span>
      <span className="transaction-row__details">
        <strong>{group.title}</strong>
        <span>
          {group.category.name} &middot; {formatGroupDate(group.date)} &middot;{" "}
          {group.transactions.length}{" "}
          {group.transactions.length === 1 ? "move" : "moves"}
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
