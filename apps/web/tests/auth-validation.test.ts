import { describe, expect, it } from "vitest";

import { validateEmail } from "../src/features/auth/email-validation";
import {
  getAccountPasswordRequirements,
  validateAccountPassword,
} from "../src/features/auth/password-validation";
import {
  getUsernameValidationMessage,
  validateUsername,
} from "../src/features/auth/username-validation";

describe("authentication validation", () => {
  it("normalizes valid email addresses", () => {
    const result = validateEmail("  Arnau@Example.com  ");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("arnau@example.com");
    }
  });

  it("rejects malformed email addresses", () => {
    expect(validateEmail("arnau@example").success).toBe(false);
  });

  it("enforces username format, length, and reserved names", () => {
    expect(validateUsername("arnau_01").success).toBe(true);
    expect(getUsernameValidationMessage("admin")).toBe(
      "This username is reserved",
    );
    expect(getUsernameValidationMessage("arnau@01")).toBe(
      "Invalid character: @",
    );
    expect(validateUsername("a".repeat(16)).success).toBe(false);
  });

  it("reports every password requirement independently", () => {
    const statuses = getAccountPasswordRequirements("Finance9!");

    expect(statuses.every((requirement) => requirement.met)).toBe(true);
    expect(validateAccountPassword("Finance9!").success).toBe(true);
    expect(validateAccountPassword("finance").success).toBe(false);
  });
});
