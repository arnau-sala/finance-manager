import { z } from "zod";

const loginPasswordSchema = z
  .string()
  .min(1, "Enter your password.")
  .max(128, "Password must be 128 characters or fewer.");

export function validateLoginPassword(password: string) {
  return loginPasswordSchema.safeParse(password);
}
