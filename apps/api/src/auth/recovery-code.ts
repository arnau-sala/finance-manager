import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const recoveryCodeBytes = 16;
const recoveryCodeHexLength = recoveryCodeBytes * 2;
const dummyRecoveryCodeHash = hashCanonicalRecoveryCode(
  "0".repeat(recoveryCodeHexLength),
);

export const recoveryCodeSchema = z
  .string()
  .trim()
  .min(recoveryCodeHexLength)
  .max(64)
  .transform((code) => code.replace(/[\s-]/g, "").toUpperCase())
  .refine(
    (code) => new RegExp(`^[A-F0-9]{${recoveryCodeHexLength}}$`).test(code),
    "Invalid recovery code.",
  );

function hashCanonicalRecoveryCode(code: string) {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export function createAccountRecoveryCode() {
  const canonicalCode = randomBytes(recoveryCodeBytes)
    .toString("hex")
    .toUpperCase();
  const displayCode = canonicalCode.match(/.{1,4}/g)?.join("-") ?? canonicalCode;

  return {
    displayCode,
    codeHash: hashCanonicalRecoveryCode(canonicalCode),
  };
}

export function recoveryCodeMatches(
  canonicalCode: string,
  expectedHash: string | null,
) {
  const candidate = Buffer.from(
    hashCanonicalRecoveryCode(canonicalCode),
    "hex",
  );
  const expected = Buffer.from(expectedHash ?? dummyRecoveryCodeHash, "hex");

  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}
