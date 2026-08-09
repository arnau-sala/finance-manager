import { useEffect, useRef, useState } from "react";

import { AuthPasswordField } from "./AuthPasswordField";
import { copyTextToClipboard } from "./clipboard";
import {
  generateAccountPassword,
  getPasswordCharacterStatuses,
  isAccountPasswordComplete
} from "./password-assistance";
import { PasswordSecuritySummary } from "./PasswordSecuritySummary";

type NewPasswordFieldsProps = {
  idPrefix: string;
  password: string;
  passwordConfirmation: string;
  invalid?: boolean;
  disabled?: boolean;
  errorId?: string;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmationChange: (value: string) => void;
  onError: (message: string | null) => void;
};

const generatedPasswordCharacterDelayMs = 11;
const generatedPasswordFieldDelayMs = 24;

export function NewPasswordFields({
  idPrefix,
  password,
  passwordConfirmation,
  invalid = false,
  disabled = false,
  errorId,
  onPasswordChange,
  onPasswordConfirmationChange,
  onError
}: NewPasswordFieldsProps) {
  const [isGeneratingPassword, setIsGeneratingPassword] = useState(false);
  const [isAppGeneratedPassword, setIsAppGeneratedPassword] = useState(false);
  const [passwordAutofillDetected, setPasswordAutofillDetected] =
    useState(false);
  const [canCopyPassword, setCanCopyPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const copyFeedbackTimeoutRef = useRef<number | null>(null);
  const passwordGenerationRunRef = useRef(0);
  const characterStatuses = getPasswordCharacterStatuses(
    password,
    passwordConfirmation
  );
  const passwordPairComplete =
    password === passwordConfirmation &&
    isAccountPasswordComplete(password) &&
    isAccountPasswordComplete(passwordConfirmation);
  const requirementsId = `${idPrefix}-requirements`;

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }

      passwordGenerationRunRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!passwordAutofillDetected || !passwordPairComplete) {
      return;
    }

    setCanCopyPassword(true);
    setPasswordAutofillDetected(false);
  }, [passwordAutofillDetected, passwordPairComplete]);

  function resetCopyState() {
    setCanCopyPassword(false);
    setPasswordCopied(false);
  }

  function waitForGeneratedPasswordStep(delay: number) {
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, delay);
    });
  }

  function cancelGeneratedPasswordAnimation() {
    if (!isGeneratingPassword) {
      return;
    }

    passwordGenerationRunRef.current += 1;
    setIsGeneratingPassword(false);
  }

  async function handleGeneratePassword() {
    if (isGeneratingPassword || disabled) {
      return;
    }

    try {
      const generatedPassword = generateAccountPassword();
      const runId = passwordGenerationRunRef.current + 1;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      const characterDelay = reduceMotion
        ? 0
        : generatedPasswordCharacterDelayMs;
      const fieldDelay = reduceMotion ? 0 : generatedPasswordFieldDelayMs;

      passwordGenerationRunRef.current = runId;
      setIsGeneratingPassword(true);
      setIsAppGeneratedPassword(true);
      onPasswordChange("");
      onPasswordConfirmationChange("");
      resetCopyState();
      setPasswordAutofillDetected(false);
      onError(null);

      for (let index = 1; index <= generatedPassword.length; index += 1) {
        await waitForGeneratedPasswordStep(characterDelay);

        if (passwordGenerationRunRef.current !== runId) {
          return;
        }

        onPasswordChange(generatedPassword.slice(0, index));
      }

      await waitForGeneratedPasswordStep(fieldDelay);

      for (let index = 1; index <= generatedPassword.length; index += 1) {
        await waitForGeneratedPasswordStep(characterDelay);

        if (passwordGenerationRunRef.current !== runId) {
          return;
        }

        onPasswordConfirmationChange(generatedPassword.slice(0, index));
      }

      if (passwordGenerationRunRef.current === runId) {
        setCanCopyPassword(true);
        setIsGeneratingPassword(false);
      }
    } catch (generationError) {
      setIsGeneratingPassword(false);
      setIsAppGeneratedPassword(false);
      onError(
        generationError instanceof Error
          ? generationError.message
          : "Unable to generate a secure password"
      );
    }
  }

  async function handleCopyPassword() {
    try {
      await copyTextToClipboard(passwordConfirmation);
      setPasswordCopied(true);

      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }

      copyFeedbackTimeoutRef.current = window.setTimeout(() => {
        setPasswordCopied(false);
        copyFeedbackTimeoutRef.current = null;
      }, 1400);
    } catch {
      onError("Unable to copy this field\nPlease try again");
    }
  }

  function handleManualPasswordChange(
    value: string,
    autofilled: boolean,
    confirmation: boolean
  ) {
    cancelGeneratedPasswordAnimation();
    setIsAppGeneratedPassword(false);

    if (confirmation) {
      onPasswordConfirmationChange(value);
    } else {
      onPasswordChange(value);
    }

    if (autofilled) {
      setPasswordAutofillDetected(true);
    } else {
      setPasswordAutofillDetected(false);
      resetCopyState();
    }

    onError(null);
  }

  return (
    <>
      <AuthPasswordField
        id={`${idPrefix}-password`}
        label="New password"
        name="newPassword"
        placeholder="Create a new password"
        value={password}
        invalid={invalid}
        autoComplete="new-password"
        describedBy={[requirementsId, errorId].filter(Boolean).join(" ")}
        disabled={disabled}
        onGenerate={handleGeneratePassword}
        generating={isGeneratingPassword}
        generated={isAppGeneratedPassword}
        characterStatuses={characterStatuses.password}
        onAutofill={() => setPasswordAutofillDetected(true)}
        onChange={(value, autofilled) =>
          handleManualPasswordChange(value, autofilled, false)
        }
      />

      <AuthPasswordField
        id={`${idPrefix}-confirmation`}
        label="Repeat password"
        name="newPasswordConfirmation"
        placeholder="Repeat your new password"
        value={passwordConfirmation}
        invalid={invalid}
        autoComplete="new-password"
        describedBy={errorId}
        disabled={disabled}
        generated={isAppGeneratedPassword}
        characterStatuses={characterStatuses.confirmation}
        copyAction={
          canCopyPassword
            ? {
                label: "repeated password",
                copied: passwordCopied,
                disabled,
                onCopy: () => void handleCopyPassword()
              }
            : undefined
        }
        onAutofill={() => setPasswordAutofillDetected(true)}
        onBlur={() => setCanCopyPassword(passwordPairComplete)}
        onChange={(value, autofilled) =>
          handleManualPasswordChange(value, autofilled, true)
        }
      />

      <PasswordSecuritySummary
        password={password}
        requirementsId={requirementsId}
      />
    </>
  );
}
