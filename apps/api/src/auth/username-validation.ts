import { z } from "zod";

const reservedUsernames = new Set([
  "admin",
  "administrator",
  "api",
  "auth",
  "finance-manager",
  "financemanager",
  "me",
  "null",
  "root",
  "support",
  "system",
  "undefined",
]);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must contain at least 3 characters.")
  .max(30, "Username must contain at most 30 characters.")
  .regex(
    /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])$/,
    "Username can contain lowercase letters, numbers, dots, hyphens, and underscores, and must start and end with a letter or number.",
  )
  .refine((username) => !reservedUsernames.has(username), {
    message: "This username is reserved.",
  });

export function normalizeLoginIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}
