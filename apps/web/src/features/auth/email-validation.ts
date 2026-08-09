import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address")
  .max(254, "Email must be 254 characters or fewer")
  .email("Enter a valid email address")
  .transform((email) => email.toLowerCase());

export function validateEmail(email: string) {
  return emailSchema.safeParse(email);
}
