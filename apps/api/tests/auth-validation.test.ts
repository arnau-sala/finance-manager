import { describe, expect, it } from "vitest";

import { passwordSchema } from "../src/auth/password-validation.js";
import {
  createAccountRecoveryCode,
  hashCanonicalRecoveryCode,
  normalizeRecoveryCode,
  recoveryCodeSchema,
} from "../src/auth/recovery-code.js";
import {
  normalizeLoginIdentifier,
  usernameSchema,
} from "../src/auth/username-validation.js";

describe("API authentication validation", () => {
  it("matches the public username and password rules", () => {
    expect(usernameSchema.safeParse("arnau_01").success).toBe(true);
    expect(usernameSchema.safeParse("admin").success).toBe(false);
    expect(usernameSchema.safeParse("a".repeat(16)).success).toBe(false);
    expect(passwordSchema.safeParse("Finance9!").success).toBe(true);
    expect(passwordSchema.safeParse("finance").success).toBe(false);
    expect(normalizeLoginIdentifier(" Arnau@Example.com ")).toBe(
      "arnau@example.com",
    );
  });

  it("creates canonical one-use recovery code material", () => {
    const recovery = createAccountRecoveryCode();
    const canonical = normalizeRecoveryCode(recovery.displayCode);

    expect(canonical).toHaveLength(16);
    expect(recovery.displayCode).toMatch(/^.{4}-.{4}-.{4}-.{4}$/);
    expect(recoveryCodeSchema.safeParse(recovery.displayCode).success).toBe(true);
    expect(recovery.codeHash).toBe(hashCanonicalRecoveryCode(canonical));
    expect(recovery.codeHash).toHaveLength(64);
  });
});
