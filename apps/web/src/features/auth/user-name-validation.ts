import { z } from "zod";

export const userNameSchema = z
  .string()
  .trim()
  .min(1, "Enter your name")
  .max(20, "Maximum 20 characters");

export function validateUserName(name: string) {
  return userNameSchema.safeParse(name);
}
