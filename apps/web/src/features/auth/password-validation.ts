import { z } from "zod";

const loginPasswordSchema = z
  .string()
  .min(1, "Enter your password.")
  .max(128, "Password must be 128 characters or fewer.");

export function validateLoginPassword(password: string) {
  return loginPasswordSchema.safeParse(password);
}

const accountPasswordSchema = z
  .string()
  .min(9, "Password must contain more than 8 characters.")
  .max(128, "Password must contain at most 128 characters.")
  .regex(/\p{Lu}/u, "Password must contain at least one uppercase letter.")
  .regex(/\p{Nd}/u, "Password must contain at least one digit.")
  .regex(
    /(?:\p{P}|\p{S})/u,
    "Password must contain at least one special character."
  );

export function validateAccountPassword(password: string) {
  return accountPasswordSchema.safeParse(password);
}
