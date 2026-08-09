import { useState } from "react";
import { ChevronLeft, Mail, TriangleAlert } from "lucide-react";

import { ActionButton } from "../../components/ui/ActionButton";
import { formatErrorMessage } from "../../components/ui/error-message";
import { revealTrailingCaret } from "../auth/AuthPasswordField";
import { validateEmail } from "../auth/email-validation";

type EmailLinkEmailPageProps = {
  onBack: () => void;
  onSubmit: (email: string) => void | Promise<void>;
};

export function EmailLinkEmailPage({
  onBack,
  onSubmit
}: EmailLinkEmailPageProps) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const parsedEmail = validateEmail(email);
  const canSubmit = parsedEmail.success && !isSubmitting;

  function validateEmailField() {
    if (!email.trim()) {
      setEmailError(null);
      return;
    }

    const result = validateEmail(email);
    setEmailError(
      result.success
        ? null
        : (result.error.issues[0]?.message ?? "Enter a valid email address")
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || !parsedEmail.success) {
      validateEmailField();
      return;
    }

    setEmailError(null);
    setFormError(null);
    setIsSubmitting(true);

    try {
      await onSubmit(parsedEmail.data);
      setIsSubmitting(false);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to link this email"
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
        aria-labelledby="email-link-address-title"
      >
        <header className="auth-header auth-password-reset-header">
          <span className="auth-recovery-code-icon" aria-hidden="true">
            <Mail strokeWidth={1.7} />
          </span>
          <div className="auth-message">
            <h1 id="email-link-address-title">Link your email</h1>
            <p className="auth-subtitle">
              We&apos;ll send a 6-digit code to verify it
            </p>
          </div>
        </header>

        <form
          className="auth-login-form auth-register-form email-link-form"
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="auth-form-field">
            <div className="auth-register-field-heading">
              <span className="text-field-label" id="email-link-address-label">
                Email address
              </span>
              {emailError ? (
                <p className="auth-register-field-error" role="alert">
                  <TriangleAlert aria-hidden="true" strokeWidth={1.8} />
                  <span>{formatErrorMessage(emailError)}</span>
                </p>
              ) : null}
            </div>
            <input
              id="email-link-address"
              className="text-field"
              aria-labelledby="email-link-address-label"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Enter your email address"
              value={email}
              maxLength={254}
              aria-invalid={emailError !== null}
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailError(null);
                setFormError(null);
              }}
              onFocus={(event) => revealTrailingCaret(event.currentTarget)}
              onClick={(event) => revealTrailingCaret(event.currentTarget)}
              onBlur={validateEmailField}
              disabled={isSubmitting}
            />
          </div>

          <p
            className="auth-field-message auth-field-message--error auth-register-error"
            role="alert"
            aria-live="polite"
          >
            {formError ? formatErrorMessage(formError) : "\u00a0"}
          </p>

          <ActionButton
            className="auth-primary-button auth-register-submit"
            type="submit"
            disabled={!canSubmit}
          >
            {isSubmitting ? "Sending" : "Send code"}
          </ActionButton>
        </form>
      </section>
    </main>
  );
}
