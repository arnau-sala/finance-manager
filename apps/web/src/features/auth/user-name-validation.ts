import { z } from "zod";

export const userNameSchema = z
  .string()
  .trim()
  .min(1, "Enter your name.")
  .max(100, "Name must be 100 characters or fewer.");

export function validateUserName(name: string) {
  return userNameSchema.safeParse(name);
}
