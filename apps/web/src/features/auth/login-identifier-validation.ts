import { validateEmail } from "./email-validation";
import { validateUsername } from "./username-validation";

export function validateLoginIdentifier(identifier: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();

  if (normalizedIdentifier.includes("@")) {
    const result = validateEmail(normalizedIdentifier);

    return result.success
      ? { success: true as const, data: result.data }
      : {
          success: false as const,
          message: "Enter a valid email or username",
        };
  }

  const result = validateUsername(normalizedIdentifier);

  return result.success
    ? { success: true as const, data: result.data }
    : {
        success: false as const,
        message: "Enter a valid email or username",
      };
}
