import { afterEach, describe, expect, it, vi } from "vitest";

import { copyTextToClipboard, isClipboardReadCancelled, readTextFromClipboard } from "../src/features/auth/clipboard";
import { isDesktopLegalPath, normalizeAppPath } from "../src/features/auth/desktop-legal-path";
import { validateLoginIdentifier } from "../src/features/auth/login-identifier-validation";
import {
  generateAccountPassword,
  getPasswordCharacterStatuses,
  getPasswordStrength,
  isAccountPasswordComplete,
} from "../src/features/auth/password-assistance";
import { validateRegistration } from "../src/features/auth/registration-validation";
import { validateUserName } from "../src/features/auth/user-name-validation";
import {
  isEditableStartingNetWorth,
  parseStartingNetWorth,
} from "../src/money/starting-net-worth-validation";

afterEach(() => vi.restoreAllMocks());

describe("password assistance", () => {
  it("classifies empty, weak, medium and strong passwords", () => {
    expect(getPasswordStrength("").level).toBe("empty");
    expect(getPasswordStrength("abc").level).toBe("very-weak");
    expect(getPasswordStrength("Finance9!").percentage).toBeGreaterThan(50);
    expect(getPasswordStrength("MuchLongerFinance9!Unique").level).toBe("very-strong");
  });

  it("marks mismatched characters in both password fields", () => {
    expect(getPasswordCharacterStatuses("Finance9!", "FinXnce9!")).toEqual({
      password: ["match", "match", "match", "mismatch", "match", "match", "match", "match", "match"],
      confirmation: ["match", "match", "match", "mismatch", "match", "match", "match", "match", "match"],
    });
    expect(isAccountPasswordComplete("Finance9!")).toBe(true);
  });

  it("generates a compliant password with the expected length", () => {
    const password = generateAccountPassword();
    expect(password).toHaveLength(14);
    expect(isAccountPasswordComplete(password)).toBe(true);
  });
});

describe("account form validation", () => {
  it("accepts either normalized email or username identifiers", () => {
    expect(validateLoginIdentifier(" ARNau_01 ")).toEqual({ success: true, data: "arnau_01" });
    expect(validateLoginIdentifier(" A@Example.com ")).toEqual({ success: true, data: "a@example.com" });
    expect(validateLoginIdentifier("invalid@").success).toBe(false);
  });

  it("requires matching registration passwords and a valid name", () => {
    expect(
      validateRegistration({
        email: "arnau@example.com",
        name: "Arnau",
        password: "Finance9!",
        passwordConfirmation: "Finance9!",
      }).success,
    ).toBe(true);
    expect(
      validateRegistration({
        email: "arnau@example.com",
        name: "Arnau",
        password: "Finance9!",
        passwordConfirmation: "Different9!",
      }).success,
    ).toBe(false);
    expect(validateUserName(" ").success).toBe(false);
    expect(validateUserName("A".repeat(21)).success).toBe(false);
  });

  it("accepts editable partial money and parses only final valid values", () => {
    expect(isEditableStartingNetWorth("-12,")).toBe(true);
    expect(isEditableStartingNetWorth("12,345")).toBe(false);
    expect(parseStartingNetWorth(" -1250,50 ")).toBe("-1250.50");
    expect(parseStartingNetWorth("10000000.01")).toBeNull();
  });
});

describe("platform helpers", () => {
  it("normalizes legal URLs", () => {
    expect(normalizeAppPath("/")).toBe("/");
    expect(normalizeAppPath("/privacy-and-terms///")).toBe("/privacy-and-terms");
    expect(isDesktopLegalPath("/privacy-and-terms/")).toBe(true);
    expect(isDesktopLegalPath("/app")).toBe(false);
  });

  it("uses the secure clipboard and recognizes user cancellation", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const readText = vi.fn().mockResolvedValue("saved");
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText, readText },
    });
    await copyTextToClipboard("hello");
    await expect(readTextFromClipboard()).resolves.toBe("saved");
    expect(writeText).toHaveBeenCalledWith("hello");
    expect(isClipboardReadCancelled(new DOMException("cancel", "AbortError"))).toBe(true);
    expect(isClipboardReadCancelled(new Error("failure"))).toBe(false);
  });

  it("uses the DOM copy fallback and reports unavailable clipboard reads", async () => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });
    await expect(copyTextToClipboard("fallback")).resolves.toBeUndefined();
    expect(document.querySelector("textarea")).toBeNull();
    await expect(readTextFromClipboard()).rejects.toThrow(
      "Clipboard access is unavailable",
    );
  });
});
