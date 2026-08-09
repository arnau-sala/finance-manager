import { z } from "zod";

const uppercasePattern = /\p{Lu}/u;
const digitPattern = /\p{Nd}/u;
const specialCharacterPattern = /(?:\p{P}|\p{S})/u;

export const accountPasswordRequirements = [
  {
    id: "length",
    label: "9+ characters",
    isMet: (password: string) => password.length >= 9
  },
  {
    id: "uppercase",
    label: "Uppercase",
    isMet: (password: string) => uppercasePattern.test(password)
  },
  {
    id: "number",
    label: "Number",
    isMet: (password: string) => digitPattern.test(password)
  },
  {
    id: "special",
    label: "Special",
    isMet: (password: string) => specialCharacterPattern.test(password)
  }
] as const;

const loginPasswordSchema = z
  .string()
  .min(1, "Enter your password")
  .max(128, "Password must be 128 characters or fewer");

export function validateLoginPassword(password: string) {
  return loginPasswordSchema.safeParse(password);
}

export const accountPasswordSchema = z
  .string()
  .min(9, "Password must contain more than 8 characters")
  .max(128, "Password must contain at most 128 characters")
  .regex(uppercasePattern, "Password must contain at least one uppercase letter")
  .regex(digitPattern, "Password must contain at least one digit")
  .regex(
    specialCharacterPattern,
      "Password must contain at least one special character"
  );

export function getAccountPasswordRequirements(password: string) {
  return accountPasswordRequirements.map((requirement) => ({
    ...requirement,
    met: requirement.isMet(password)
  }));
}

export function validateAccountPassword(password: string) {
  return accountPasswordSchema.safeParse(password);
}
