import { useState } from "react";
import { ChevronLeft } from "lucide-react";

import { ActionButton } from "../../components/ui/ActionButton";
import { formatErrorMessage } from "../../components/ui/error-message";
import { NewPasswordFields } from "./NewPasswordFields";
import { isAccountPasswordComplete } from "./password-assistance";
import { completePasswordReset } from "./password-recovery-api";
import { validateAccountPassword } from "./password-validation";

export type PasswordResetResult = {
  username: string | null;
  recoveryCode: string | null;
};

type PasswordResetPageProps = {
  onBack: () => void;
  onComplete: (result: PasswordResetResult) => void;
};

export function PasswordResetPage({
  onBack,
  onComplete
}: PasswordResetPageProps) {
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmit =
    password === passwordConfirmation &&
    isAccountPasswordComplete(password) &&
    isAccountPasswordComplete(passwordConfirmation);

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
      <ActionButton
        shape="icon"
        className="auth-back-button"
        type="button"
        onClick={onBack}
        aria-label="Go back"
      >
        <ChevronLeft aria-hidden="true" strokeWidth={1.8} />
      </ActionButton>

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
          <NewPasswordFields
            idPrefix="password-reset"
            password={password}
            passwordConfirmation={passwordConfirmation}
            invalid={error !== null}
            disabled={isSubmitting}
            errorId="password-reset-error"
            onPasswordChange={setPassword}
            onPasswordConfirmationChange={setPasswordConfirmation}
            onError={setError}
          />

          <p
            id="password-reset-error"
            className="auth-field-message auth-field-message--error auth-register-error"
            role="alert"
            aria-live="polite"
          >
            {error ? formatErrorMessage(error) : "\u00a0"}
          </p>

          <ActionButton
            className="auth-primary-button auth-register-submit"
            type="submit"
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? "Updating..." : "Change password"}
          </ActionButton>
        </form>
      </section>
    </main>
  );
}
