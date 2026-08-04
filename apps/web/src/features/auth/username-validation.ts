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
  .min(3, "At least 3 characters")
  .max(30, "Maximum 30 characters")
  .regex(
    /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])$/,
    "Start and end with a letter or number",
  )
  .refine((username) => !reservedUsernames.has(username), {
    message: "This username is reserved",
  });

export function isReservedUsername(username: string) {
  return reservedUsernames.has(username.trim().toLowerCase());
}

function describeInvalidCharacter(character: string) {
  if (character === " ") {
    return "space";
  }

  if (character === "\t") {
    return "tab";
  }

  if (character === "\n" || character === "\r") {
    return "line break";
  }

  return character;
}

export function getUsernameValidationMessage(username: string) {
  const invalidCharacters = [
    ...new Set(
      Array.from(username.toLowerCase()).filter(
        (character) => !/[a-z0-9._-]/.test(character)
      )
    )
  ].map(describeInvalidCharacter);

  if (invalidCharacters.length > 0) {
    return `Invalid character${invalidCharacters.length === 1 ? "" : "s"}: ${invalidCharacters.join(", ")}`;
  }

  const result = usernameSchema.safeParse(username);

  return result.success
    ? null
    : (result.error.issues[0]?.message ?? "Username is not valid");
}

export function validateUsername(username: string) {
  return usernameSchema.safeParse(username);
}
