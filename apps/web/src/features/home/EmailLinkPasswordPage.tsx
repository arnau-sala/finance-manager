import { useState } from "react";
import { ChevronLeft, Mail } from "lucide-react";

import { ActionButton } from "../../components/ui/ActionButton";
import { formatErrorMessage } from "../../components/ui/error-message";
import { NewPasswordFields } from "../auth/NewPasswordFields";
import { isAccountPasswordComplete } from "../auth/password-assistance";
import { validateAccountPassword } from "../auth/password-validation";

type EmailLinkPasswordPageProps = {
  email: string;
  onBack: () => void;
  onSubmit: (password: string, confirmation: string) => void | Promise<void>;
};

export function EmailLinkPasswordPage({
  email,
  onBack,
  onSubmit
}: EmailLinkPasswordPageProps) {
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

    const parsedPassword = validateAccountPassword(password);

    if (!parsedPassword.success) {
      setError(
        parsedPassword.error.issues[0]?.message ?? "Enter a valid password"
      );
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit(parsedPassword.data, passwordConfirmation);
      setIsSubmitting(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create your password"
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
        disabled={isSubmitting}
        aria-label="Go back"
      >
        <ChevronLeft aria-hidden="true" strokeWidth={1.8} />
      </ActionButton>

      <section
        className="auth-panel auth-password-reset-panel email-link-panel"
        aria-labelledby="email-link-password-title"
      >
        <header className="auth-header auth-password-reset-header">
          <span className="auth-recovery-code-icon" aria-hidden="true">
            <Mail strokeWidth={1.7} />
          </span>
          <div className="auth-message">
            <h1 id="email-link-password-title">Create a password</h1>
            <p className="auth-subtitle">
              Continuing sends a 6-digit code to
              <strong className="email-link-inline-address">{email}</strong>
            </p>
          </div>
        </header>

        <form
          className="auth-login-form auth-register-form email-link-form"
          noValidate
          onSubmit={handleSubmit}
        >
          <NewPasswordFields
            idPrefix="email-link-password"
            password={password}
            passwordConfirmation={passwordConfirmation}
            invalid={error !== null}
            disabled={isSubmitting}
            errorId="email-link-password-error"
            onPasswordChange={setPassword}
            onPasswordConfirmationChange={setPasswordConfirmation}
            onError={setError}
          />

          <p
            id="email-link-password-error"
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
            {isSubmitting ? "Sending..." : "Continue"}
          </ActionButton>
        </form>
      </section>
    </main>
  );
}
