import { useState } from "react";
import { ChevronLeft, Mail } from "lucide-react";

import { ActionButton } from "../../components/ui/ActionButton";
import { formatErrorMessage } from "../../components/ui/error-message";

type EmailLinkIntroPageProps = {
  email: string;
  requiresPassword: boolean;
  onBack: () => void;
  onContinue: () => void | Promise<void>;
};

export function EmailLinkIntroPage({
  email,
  requiresPassword,
  onBack,
  onContinue
}: EmailLinkIntroPageProps) {
  const [isContinuing, setIsContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (isContinuing) {
      return;
    }

    setError(null);
    setIsContinuing(true);

    try {
      await onContinue();
      setIsContinuing(false);
    } catch (continueError) {
      setError(
        continueError instanceof Error
          ? continueError.message
          : "Unable to continue"
      );
      setIsContinuing(false);
    }
  }

  return (
    <main className="auth-screen auth-screen--login auth-screen--password-reset">
      <ActionButton
        shape="icon"
        className="auth-back-button"
        type="button"
        onClick={onBack}
        disabled={isContinuing}
        aria-label="Go back"
      >
        <ChevronLeft aria-hidden="true" strokeWidth={1.8} />
      </ActionButton>

      <section
        className="auth-panel auth-password-reset-panel email-link-panel"
        aria-labelledby="email-link-intro-title"
      >
        <header className="auth-header auth-password-reset-header">
          <span className="auth-recovery-code-icon" aria-hidden="true">
            <Mail strokeWidth={1.7} />
          </span>
          <div className="auth-message">
            <h1 id="email-link-intro-title">Enable email sign-in</h1>
            <p className="auth-subtitle">
              {requiresPassword
                ? "Create a password, then verify your email"
                : "Confirm the email linked through Google"}
            </p>
          </div>
        </header>

        <div className="email-link-address-card">
          <Mail aria-hidden="true" strokeWidth={1.8} />
          <div>
            <span>Email address</span>
            <strong>{email}</strong>
          </div>
        </div>

        <p className="email-link-notice">
          {requiresPassword
            ? `After creating your password, we'll send a 6-digit code to ${email}`
            : `Continuing sends a 6-digit code to ${email}`}
        </p>

        <p
          className="auth-field-message auth-field-message--error auth-register-error"
          role="alert"
          aria-live="polite"
        >
          {error ? formatErrorMessage(error) : "\u00a0"}
        </p>

        <ActionButton
          className="auth-primary-button email-link-primary-action"
          type="button"
          disabled={isContinuing}
          onClick={() => void handleContinue()}
        >
          {isContinuing
            ? requiresPassword
              ? "Opening..."
              : "Sending..."
            : "Continue"}
        </ActionButton>
      </section>
    </main>
  );
}
