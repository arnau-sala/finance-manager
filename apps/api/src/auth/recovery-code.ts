import { createHash, randomBytes } from "node:crypto";

import { z } from "zod";

const recoveryCodeLength = 16;
const recoveryCodeAlphabet =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const unbiasedByteLimit =
  Math.floor(256 / recoveryCodeAlphabet.length) * recoveryCodeAlphabet.length;
const legacyRecoveryCodePattern = /^[A-F0-9]{32}$/;
const recoveryCodePattern = new RegExp(
  `^[${recoveryCodeAlphabet}]{${recoveryCodeLength}}$`,
);

export const recoveryCodeSchema = z
  .string()
  .trim()
  .min(recoveryCodeLength)
  .max(128)
  .transform(normalizeRecoveryCode)
  .refine(
    (code) =>
      recoveryCodePattern.test(code) || legacyRecoveryCodePattern.test(code),
    "Invalid recovery code.",
  );

export function normalizeRecoveryCode(code: string) {
  const alphanumericCode = code.replace(/[^A-Za-z0-9]/g, "");

  return legacyRecoveryCodePattern.test(alphanumericCode.toUpperCase())
    ? alphanumericCode.toUpperCase()
    : alphanumericCode;
}

export function hashCanonicalRecoveryCode(code: string) {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export function createAccountRecoveryCode() {
  let canonicalCode = "";

  while (canonicalCode.length < recoveryCodeLength) {
    const bytes = randomBytes(recoveryCodeLength);

    for (const byte of bytes) {
      if (byte >= unbiasedByteLimit) {
        continue;
      }

      canonicalCode += recoveryCodeAlphabet[byte % recoveryCodeAlphabet.length];

      if (canonicalCode.length === recoveryCodeLength) {
        break;
      }
    }
  }

  const displayCode = canonicalCode.match(/.{1,4}/g)?.join("-") ?? canonicalCode;

  return {
    displayCode,
    codeHash: hashCanonicalRecoveryCode(canonicalCode),
  };
}
