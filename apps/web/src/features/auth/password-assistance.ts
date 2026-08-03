import { getAccountPasswordRequirements } from "./password-validation";

const LOWERCASE_CHARACTERS = "abcdefghijkmnopqrstuvwxyz";
const UPPERCASE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGIT_CHARACTERS = "23456789";
const SPECIAL_CHARACTERS = "!@#$%&*?";
const GENERATED_PASSWORD_LENGTH = 14;

export type PasswordStrengthLevel =
  | "empty"
  | "very-weak"
  | "weak"
  | "medium"
  | "strong"
  | "very-strong";

export type PasswordStrength = {
  level: PasswordStrengthLevel;
  label: string;
  percentage: number;
};

export type PasswordCharacterStatus = "match" | "mismatch";

function secureRandomIndex(maxExclusive: number) {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure password generation is unavailable.");
  }

  const randomBytes = new Uint8Array(1);
  const highestAcceptedValue = 256 - (256 % maxExclusive);

  do {
    globalThis.crypto.getRandomValues(randomBytes);
  } while (randomBytes[0] >= highestAcceptedValue);

  return randomBytes[0] % maxExclusive;
}

function randomCharacter(characters: string) {
  return characters[secureRandomIndex(characters.length)];
}

export function generateAccountPassword() {
  const allCharacters =
    LOWERCASE_CHARACTERS +
    UPPERCASE_CHARACTERS +
    DIGIT_CHARACTERS +
    SPECIAL_CHARACTERS;
  const passwordCharacters = [
    randomCharacter(LOWERCASE_CHARACTERS),
    randomCharacter(UPPERCASE_CHARACTERS),
    randomCharacter(DIGIT_CHARACTERS),
    randomCharacter(SPECIAL_CHARACTERS)
  ];

  while (passwordCharacters.length < GENERATED_PASSWORD_LENGTH) {
    passwordCharacters.push(randomCharacter(allCharacters));
  }

  for (let index = passwordCharacters.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomIndex(index + 1);
    [passwordCharacters[index], passwordCharacters[swapIndex]] = [
      passwordCharacters[swapIndex],
      passwordCharacters[index]
    ];
  }

  return passwordCharacters.join("");
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { level: "empty", label: "Strength", percentage: 0 };
  }

  let score = 0;

  if (password.length >= 9) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (/\p{Ll}/u.test(password)) score += 1;
  if (/\p{Lu}/u.test(password)) score += 1;
  if (/\p{Nd}/u.test(password)) score += 1;
  if (/(?:\p{P}|\p{S})/u.test(password)) score += 1;

  const characters = Array.from(password);
  const uniqueRatio = new Set(characters).size / characters.length;
  if (characters.length >= 9 && uniqueRatio >= 0.7) score += 1;

  const percentage = Math.round((score / 8) * 100);

  if (score <= 2) {
    return { level: "very-weak", label: "Very weak", percentage };
  }

  if (score === 3) {
    return { level: "weak", label: "Weak", percentage };
  }

  if (score <= 5) {
    return { level: "medium", label: "Medium", percentage };
  }

  if (score === 6) {
    return { level: "strong", label: "Strong", percentage };
  }

  return { level: "very-strong", label: "Very strong", percentage };
}

export function getPasswordCharacterStatuses(
  password: string,
  confirmation: string
) {
  const passwordStatuses: PasswordCharacterStatus[] = Array.from(
    { length: password.length },
    (_, index) =>
      index >= confirmation.length || password[index] === confirmation[index]
        ? "match"
        : "mismatch"
  );
  const confirmationStatuses: PasswordCharacterStatus[] = Array.from(
    { length: confirmation.length },
    (_, index) =>
      password[index] === confirmation[index] ? "match" : "mismatch"
  );

  return {
    password: passwordStatuses,
    confirmation: confirmationStatuses
  };
}

export function isAccountPasswordComplete(password: string) {
  return getAccountPasswordRequirements(password).every(
    (requirement) => requirement.met
  );
}
