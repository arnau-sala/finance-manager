import { z } from "zod";

import { parseLocalDateOnly } from "../../dates/date-only";
import { transactionCategories } from "./category-catalog";

const MAX_AMOUNT_CENTS = 2_147_483_647n;
const AMOUNT_PATTERN = /^\d{1,8}(?:,\d{1,2})?$/;

function amountToCents(amount: string) {
  const [wholePart, decimalPart = ""] = amount.split(",");
  return BigInt(wholePart) * 100n + BigInt(decimalPart.padEnd(2, "0"));
}

const transactionAmountSchema = z
  .string()
  .trim()
  .min(1, "Enter an amount.")
  .regex(
    AMOUNT_PATTERN,
    "Enter a valid amount with no more than two decimal places."
  )
  .superRefine((amount, context) => {
    if (!AMOUNT_PATTERN.test(amount)) {
      return;
    }

    const amountCents = amountToCents(amount);

    if (amountCents <= 0n) {
      context.addIssue({
        code: "custom",
        message: "Amount must be greater than zero."
      });
    }

    if (amountCents > MAX_AMOUNT_CENTS) {
      context.addIssue({
        code: "custom",
        message: "Amount is too large."
      });
    }
  })
  .transform((amount) => amount.replace(",", "."));

export const createTransactionSchema = z
  .object({
    amount: transactionAmountSchema,
    type: z.enum(["INCOME", "EXPENSE"]),
    description: z
      .string()
      .trim()
      .min(1, "Enter a name.")
      .max(50, "Name must be 50 characters or fewer."),
    categoryId: z.string().trim().min(1, "Choose a category."),
    date: z
      .string()
      .refine((value) => parseLocalDateOnly(value) !== null, "Choose a valid date.")
  })
  .strict()
  .superRefine((transaction, context) => {
    const categoryMatchesType = transactionCategories.some(
      (category) =>
        category.id === transaction.categoryId &&
        category.type === transaction.type
    );

    if (!categoryMatchesType) {
      context.addIssue({
        code: "custom",
        path: ["categoryId"],
        message: "Choose a valid category."
      });
    }
  });

export type CreateTransactionFormInput = z.input<
  typeof createTransactionSchema
>;
export type CreateTransactionInput = z.output<typeof createTransactionSchema>;
export type CreateTransactionField = keyof CreateTransactionFormInput;

export function validateCreateTransaction(input: CreateTransactionFormInput) {
  return createTransactionSchema.safeParse(input);
}
