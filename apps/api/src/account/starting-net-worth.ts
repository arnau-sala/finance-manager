import { z } from "zod";

const MAX_STARTING_NET_WORTH_CENTS = 1_000_000_000n;
const DECIMAL_NET_WORTH_PATTERN = /^-?\d{1,8}(?:\.\d{1,2})?$/;

function decimalToCents(amount: string) {
  const isNegative = amount.startsWith("-");
  const unsignedAmount = isNegative ? amount.slice(1) : amount;
  const [wholePart, decimalPart = ""] = unsignedAmount.split(".");
  const cents =
    BigInt(wholePart) * 100n + BigInt(decimalPart.padEnd(2, "0"));

  return isNegative ? -cents : cents;
}

export const startingNetWorthSchema = z
  .union([z.string(), z.number().finite()])
  .transform((amount) =>
    typeof amount === "number" ? amount.toString() : amount.trim()
  )
  .pipe(
    z
      .string()
      .max(32)
      .regex(
        DECIMAL_NET_WORTH_PATTERN,
        "Starting net worth must be a decimal with at most two decimal places."
      )
  )
  .superRefine((amount, context) => {
    const amountCents = decimalToCents(amount);

    if (
      amountCents > MAX_STARTING_NET_WORTH_CENTS ||
      amountCents < -MAX_STARTING_NET_WORTH_CENTS
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Starting net worth must be between -10,000,000 and 10,000,000."
      });
    }
  })
  .transform((amount) => Number(decimalToCents(amount)));
