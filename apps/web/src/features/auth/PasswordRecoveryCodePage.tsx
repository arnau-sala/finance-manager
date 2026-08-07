import { useState } from "react";
import { ChevronLeft, KeyRound } from "lucide-react";

import { formatErrorMessage } from "../../components/ui/error-message";
import { verifyPasswordResetRecoveryCode } from "./password-recovery-api";

type PasswordRecoveryCodePageProps = {
  username: string | null;
  onBack: () => void;
  onVerified: (username: string) => void;
};

const RECOVERY_CODE_LENGTH = 16;
const RECOVERY_CODE_DISPLAY_LENGTH = 19;
const RECOVERY_CODE_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function canonicalRecoveryCode(value: string) {
  return Array.from(value)
    .filter((character) => RECOVERY_CODE_ALPHABET.includes(character))
    .join("");
}

function formatRecoveryCode(value: string) {
  const canonical = canonicalRecoveryCode(value).slice(
    0,
    RECOVERY_CODE_LENGTH
  );

  return canonical.match(/.{1,4}/g)?.join("-") ?? canonical;
}

export function PasswordRecoveryCodePage({
  username,
  onBack,
  onVerified
}: PasswordRecoveryCodePageProps) {
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const codeLength = canonicalRecoveryCode(recoveryCode).length;
  const canSubmit = codeLength === RECOVERY_CODE_LENGTH;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || isSubmitting) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const verifiedUsername = await verifyPasswordResetRecoveryCode({
        username,
        recoveryCode
      });
      onVerified(verifiedUsername);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to verify the recovery code. Please try again"
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-screen auth-screen--login auth-screen--password-recovery-code">
      <button
        className="auth-back-button"
        type="button"
        onClick={onBack}
        aria-label="Go back"
      >
        <ChevronLeft aria-hidden="true" strokeWidth={1.8} />
      </button>

      <section
        className="auth-panel auth-password-recovery-code-panel"
        aria-labelledby="password-recovery-code-title"
      >
        <header className="auth-header auth-password-recovery-code-header">
          <span className="auth-recovery-code-icon" aria-hidden="true">
            <KeyRound strokeWidth={1.7} />
          </span>
          <div className="auth-message">
            {username ? (
              <p className="auth-recovery-code-eyebrow">@{username}</p>
            ) : null}
            <h1 id="password-recovery-code-title">
              {username ? "Enter recovery code" : "Find your username"}
            </h1>
            <p className="auth-subtitle auth-password-recovery-code-subtitle">
              Enter the 16-character code shown when you created your account
            </p>
          </div>
        </header>

        <form
          className="auth-register-form auth-password-recovery-code-form"
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="auth-form-field">
            <div className="auth-register-field-heading">
              <span id="password-recovery-code-label">Recovery code</span>
            </div>
            <input
              id="password-recovery-code"
              aria-labelledby="password-recovery-code-label"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={recoveryCode}
              maxLength={RECOVERY_CODE_DISPLAY_LENGTH}
              aria-invalid={error !== null}
              aria-describedby="password-recovery-code-error"
              onChange={(event) => {
                setRecoveryCode(formatRecoveryCode(event.target.value));
                setError(null);
              }}
              onPaste={(event) => {
                event.preventDefault();
                setRecoveryCode(
                  formatRecoveryCode(event.clipboardData.getData("text"))
                );
                setError(null);
              }}
            />
          </div>

          <p className="auth-password-recovery-code-note">
            Separators do not matter, but letters are case-sensitive
          </p>

          <p
            id="password-recovery-code-error"
            className="auth-field-message auth-field-message--error auth-password-recovery-error"
            role="alert"
            aria-live="polite"
          >
            {error ? formatErrorMessage(error) : "\u00a0"}
          </p>

          <button
            className="auth-primary-button"
            type="submit"
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? "Verifying..." : "Continue"}
          </button>
        </form>
      </section>
    </main>
  );
}
