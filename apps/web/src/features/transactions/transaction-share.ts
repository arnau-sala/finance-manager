import { parseLocalDateOnly } from "../../dates/date-only";
import { formatEuroAmount } from "../../money/format-euro";
import type { TransactionPreview } from "./transaction-api";

export type TransactionShareResult = "shared" | "copied" | "cancelled";

function formatShareDate(value: string) {
  const date = parseLocalDateOnly(value);

  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

export function buildTransactionShareText(transaction: TransactionPreview) {
  const amount = Number(transaction.amount);
  const signedAmount =
    transaction.type === "INCOME" ? Math.abs(amount) : -Math.abs(amount);
  const type =
    transaction.type === "INCOME" ? "\uD83D\uDCB0 Income" : "\uD83D\uDCB8 Expense";

  return [
    type,
    "",
    `\uD83D\uDCDD ${transaction.description}`,
    `\uD83D\uDCB6 ${formatEuroAmount(signedAmount, { showSign: true })}`,
    "",
    `\uD83C\uDFF7\uFE0F ${transaction.category.name}`,
    `\uD83D\uDCC5 ${formatShareDate(transaction.date)}`
  ].join("\n");
}

async function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.append(textArea);
  textArea.select();

  const copied = document.execCommand("copy");
  textArea.remove();

  if (!copied) {
    throw new Error("Clipboard access is unavailable");
  }
}

export async function shareTransaction(
  transaction: TransactionPreview
): Promise<TransactionShareResult> {
  const text = buildTransactionShareText(transaction);

  if (typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: "Finance Manager",
        text
      });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }

  await copyText(text);
  return "copied";
}
