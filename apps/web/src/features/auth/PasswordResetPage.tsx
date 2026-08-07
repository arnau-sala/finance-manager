import { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";

import { formatErrorMessage } from "../../components/ui/error-message";
import { AuthPasswordField } from "./AuthPasswordField";
import {
  generateAccountPassword,
  getPasswordCharacterStatuses,
  isAccountPasswordComplete
} from "./password-assistance";
import { copyTextToClipboard } from "./clipboard";
import { completePasswordReset } from "./password-recovery-api";
import { PasswordSecuritySummary } from "./PasswordSecuritySummary";
import { validateAccountPassword } from "./password-validation";

export type PasswordResetResult = {
  username: string | null;
  recoveryCode: string | null;
};

type PasswordResetPageProps = {
  onBack: () => void;
  onComplete: (result: PasswordResetResult) => void;
};

const generatedPasswordCharacterDelayMs = 11;
const generatedPasswordFieldDelayMs = 24;

export function PasswordResetPage({
  onBack,
  onComplete
}: PasswordResetPageProps) {
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const canSubmit =
    password === passwordConfirmation &&
    isAccountPasswordComplete(password) &&
    isAccountPasswordComplete(passwordConfirmation);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }

      passwordGenerationRunRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!passwordAutofillDetected || !canSubmit) {
      return;
    }

    setCanCopyPassword(true);
    setPasswordAutofillDetected(false);
  }, [canSubmit, passwordAutofillDetected]);

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
    if (isGeneratingPassword) {
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
      setPassword("");
      setPasswordConfirmation("");
      resetCopyState();
      setPasswordAutofillDetected(false);
      setError(null);

      for (let index = 1; index <= generatedPassword.length; index += 1) {
        await waitForGeneratedPasswordStep(characterDelay);

        if (passwordGenerationRunRef.current !== runId) {
          return;
        }

        setPassword(generatedPassword.slice(0, index));
      }

      await waitForGeneratedPasswordStep(fieldDelay);

      for (let index = 1; index <= generatedPassword.length; index += 1) {
        await waitForGeneratedPasswordStep(characterDelay);

        if (passwordGenerationRunRef.current !== runId) {
          return;
        }

        setPasswordConfirmation(generatedPassword.slice(0, index));
      }

      if (passwordGenerationRunRef.current === runId) {
        setCanCopyPassword(true);
        setIsGeneratingPassword(false);
      }
    } catch (generationError) {
      setIsGeneratingPassword(false);
      setIsAppGeneratedPassword(false);
      setError(
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
      setError("Unable to copy this field. Please try again");
    }
  }

  function validatePasswordConfirmationField() {
    setCanCopyPassword(canSubmit);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || isSubmitting) {
      return;
    }

    const passwordValidation = validateAccountPassword(password);

    if (!passwordValidation.success) {
      setError(passwordValidation.error.issues[0]?.message ?? "Invalid password");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await completePasswordReset({
        newPassword: password,
        newPasswordConfirmation: passwordConfirmation
      });
      onComplete(result);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to change the password. Please try again"
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-screen auth-screen--login auth-screen--password-reset">
      <button
        className="auth-back-button"
        type="button"
        onClick={onBack}
        aria-label="Go back"
      >
        <ChevronLeft aria-hidden="true" strokeWidth={1.8} />
      </button>

      <section
        className="auth-panel auth-password-reset-panel"
        aria-labelledby="password-reset-title"
      >
        <header className="auth-header auth-password-reset-header">
          <div className="auth-logo auth-logo--verification" aria-hidden="true">
            <img
              src="/icons/app-icon-512.png"
              width={512}
              height={512}
              alt=""
              decoding="sync"
            />
          </div>
          <div className="auth-message">
            <h1 id="password-reset-title">Create a new password</h1>
            <p className="auth-subtitle">
              All existing sessions will be signed out
            </p>
          </div>
        </header>

        <form
          className="auth-login-form auth-register-form"
          noValidate
          onSubmit={handleSubmit}
        >
          <AuthPasswordField
            id="password-reset-password"
            label="New password"
            name="newPassword"
            placeholder="Create a new password"
            value={password}
            invalid={error !== null}
            autoComplete="new-password"
            describedBy="password-reset-requirements password-reset-error"
            onGenerate={handleGeneratePassword}
            generating={isGeneratingPassword}
            generated={isAppGeneratedPassword}
            characterStatuses={characterStatuses.password}
            onAutofill={() => setPasswordAutofillDetected(true)}
            onChange={(value, autofilled) => {
              cancelGeneratedPasswordAnimation();
              setIsAppGeneratedPassword(false);
              setPassword(value);

              if (autofilled) {
                setPasswordAutofillDetected(true);
              } else {
                setPasswordAutofillDetected(false);
                resetCopyState();
              }

              setError(null);
            }}
          />

          <AuthPasswordField
            id="password-reset-confirmation"
            label="Repeat password"
            name="newPasswordConfirmation"
            placeholder="Repeat your new password"
            value={passwordConfirmation}
            invalid={error !== null}
            autoComplete="new-password"
            describedBy="password-reset-error"
            generated={isAppGeneratedPassword}
            characterStatuses={characterStatuses.confirmation}
            copyAction={
              canCopyPassword
                ? {
                    label: "repeated password",
                    copied: passwordCopied,
                    onCopy: handleCopyPassword
                  }
                : undefined
            }
            onAutofill={() => setPasswordAutofillDetected(true)}
            onBlur={validatePasswordConfirmationField}
            onChange={(value, autofilled) => {
              cancelGeneratedPasswordAnimation();
              setIsAppGeneratedPassword(false);
              setPasswordConfirmation(value);

              if (autofilled) {
                setPasswordAutofillDetected(true);
              } else {
                setPasswordAutofillDetected(false);
                resetCopyState();
              }

              setError(null);
            }}
          />

          <PasswordSecuritySummary
            password={password}
            requirementsId="password-reset-requirements"
          />

          <p
            id="password-reset-error"
            className="auth-field-message auth-field-message--error auth-register-error"
            role="alert"
            aria-live="polite"
          >
            {error ? formatErrorMessage(error) : "\u00a0"}
          </p>

          <button
            className="auth-primary-button auth-register-submit"
            type="submit"
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? "Updating..." : "Change password"}
          </button>
        </form>
      </section>
    </main>
  );
}
