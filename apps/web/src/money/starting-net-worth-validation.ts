const MAX_STARTING_NET_WORTH_CENTS = 1_000_000_000n;
const STARTING_NET_WORTH_PATTERN = /^-?\d{1,8}(?:\.\d{1,2})?$/;
const EDITABLE_STARTING_NET_WORTH_PATTERN =
  /^-?\d{0,8}(?:[.,]\d{0,2})?$/;

export const STARTING_NET_WORTH_ERROR =
  "Use -10M€ to 10M€";

function decimalToCents(amount: string) {
  const isNegative = amount.startsWith("-");
  const unsignedAmount = isNegative ? amount.slice(1) : amount;
  const [wholePart, decimalPart = ""] = unsignedAmount.split(".");
  const cents =
    BigInt(wholePart) * 100n + BigInt(decimalPart.padEnd(2, "0"));

  return isNegative ? -cents : cents;
}

export function isEditableStartingNetWorth(value: string) {
  return EDITABLE_STARTING_NET_WORTH_PATTERN.test(value);
}

export function parseStartingNetWorth(value: string) {
  const normalizedValue = value.trim().replace(",", ".");

  if (!STARTING_NET_WORTH_PATTERN.test(normalizedValue)) {
    return null;
  }

  const cents = decimalToCents(normalizedValue);

  if (
    cents > MAX_STARTING_NET_WORTH_CENTS ||
    cents < -MAX_STARTING_NET_WORTH_CENTS
  ) {
    return null;
  }

  return normalizedValue;
}
