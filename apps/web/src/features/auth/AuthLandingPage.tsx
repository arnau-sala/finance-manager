import { useRef, useState } from "react";
import { ArrowRight, Mail } from "lucide-react";

import { GoogleIcon } from "../../components/brand/GoogleIcon";
import { ActionButton } from "../../components/ui/ActionButton";
import { formatErrorMessage } from "../../components/ui/error-message";
import { LegalNoticeScreen } from "./LegalNoticeScreen";
import { validateLoginIdentifier } from "./login-identifier-validation";
import type { PasswordRecoveryStart } from "./PasswordRecoveryFlow";
import { PasswordRecoveryStartDialog } from "./PasswordRecoveryStartDialog";

type AuthLandingPageProps = {
  onIdentifierContinue: (identifier: string) => void;
  onCreateAccount: () => void;
  onGoogleContinue: () => void;
  onPasswordRecoveryStart: (start: PasswordRecoveryStart) => void;
  externalError?: string | null;
  onClearExternalError?: () => void;
};

function isAutofilled(input: HTMLInputElement) {
  try {
    return input.matches(":-webkit-autofill");
  } catch {
    return false;
  }
}

export function AuthLandingPage({
  onIdentifierContinue,
  onCreateAccount,
  onGoogleContinue,
  onPasswordRecoveryStart,
  externalError = null,
  onClearExternalError
}: AuthLandingPageProps) {
  const [identifier, setIdentifier] = useState("");
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [isRecoveryDialogOpen, setIsRecoveryDialogOpen] = useState(false);
  const [isLegalScreenOpen, setIsLegalScreenOpen] = useState(false);
  const [isLegalScreenClosing, setIsLegalScreenClosing] = useState(false);
  const hasContinued = useRef(false);
  const displayedError = identifierError ?? externalError;

  function continueWithIdentifier(value: string) {
    const result = validateLoginIdentifier(value);

    if (!result.success) {
      setIdentifierError(result.message);
      return;
    }

    if (hasContinued.current) {
      return;
    }

    hasContinued.current = true;
    setIdentifierError(null);
    onIdentifierContinue(result.data);
  }

  function handleIdentifierSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    continueWithIdentifier(identifier);
  }

  function handleIdentifierAutofill(input: HTMLInputElement) {
    if (input.value) {
      setIdentifier(input.value);
      continueWithIdentifier(input.value);
    }
  }

  function openLegalScreen() {
    setIsLegalScreenClosing(false);
    setIsLegalScreenOpen(true);
  }

  function closeLegalScreen() {
    setIsLegalScreenClosing(true);
  }

  return (
    <main
      className={`auth-screen auth-screen--static${
        isLegalScreenOpen ? " auth-screen--legal-open" : ""
      }`}
    >
      <section className="auth-panel" aria-labelledby="auth-title">
        <header className="auth-header">
          <div className="auth-identity">
            <div className="auth-logo" aria-hidden="true">
              <img
                src="/icons/app-icon-512.png"
                width={512}
                height={512}
                alt=""
                decoding="sync"
                fetchPriority="high"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
              <span>FM</span>
            </div>
            <p className="auth-brand">Finance Manager</p>
          </div>

          <div className="auth-message">
            <h1 id="auth-title">Money, made clear.</h1>
            <p className="auth-subtitle">A simpler way to track your finances</p>
          </div>
        </header>

        <div className="auth-entry">
          <p className="auth-section-label">Access your account</p>

          <form
            className="auth-email-form"
            onSubmit={handleIdentifierSubmit}
            noValidate
          >
            <label className="sr-only" htmlFor="login-identifier">
              Email or username
            </label>
            <input
              id="login-identifier"
              className="text-field text-field--prominent"
              name="username"
              type="text"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Email or username"
              value={identifier}
              aria-invalid={identifierError !== null}
              aria-describedby={displayedError ? "identifier-error" : undefined}
              onChange={(event) => {
                const input = event.currentTarget;
                setIdentifier(input.value);
                onClearExternalError?.();
                if (identifierError) {
                  setIdentifierError(null);
                }

                if (isAutofilled(input)) {
                  handleIdentifierAutofill(input);
                }
              }}
              onAnimationStart={(event) => {
                if (event.animationName === "auth-email-autofill") {
                  handleIdentifierAutofill(event.currentTarget);
                }
              }}
            />
            <ActionButton
              shape="icon"
              type="submit"
              aria-label="Continue with email or username"
            >
              <ArrowRight aria-hidden="true" strokeWidth={2} />
            </ActionButton>
          </form>

          {displayedError ? (
            <p
              id="identifier-error"
              className="auth-field-message auth-field-message--error"
              role="alert"
              aria-live="polite"
            >
              {formatErrorMessage(displayedError)}
            </p>
          ) : null}

          <ActionButton
            className="auth-option auth-option--google"
            type="button"
            onClick={onGoogleContinue}
          >
            <span className="auth-option-label">
              <GoogleIcon className="auth-provider-icon" />
              Continue with Google
            </span>
            <ArrowRight className="auth-option-arrow" aria-hidden="true" />
          </ActionButton>

          <div
            className={`auth-divider auth-landing-divider${
              displayedError ? " auth-landing-divider--after-error" : ""
            }`}
            aria-hidden="true"
          >
            <span>OR</span>
          </div>

          <ActionButton
            className="auth-option auth-landing-create"
            type="button"
            onClick={onCreateAccount}
          >
            <span className="auth-option-label">
              <Mail aria-hidden="true" strokeWidth={1.8} />
              Create an account
            </span>
            <ArrowRight className="auth-option-arrow" aria-hidden="true" />
          </ActionButton>

          <button
            className="auth-landing-help"
            type="button"
            onClick={() => setIsRecoveryDialogOpen(true)}
          >
            Need help?
          </button>
        </div>
      </section>

      <button
        className="auth-landing-legal"
        type="button"
        onClick={openLegalScreen}
      >
        Privacy & Terms
      </button>

      {isLegalScreenOpen ? (
        <LegalNoticeScreen
          closing={isLegalScreenClosing}
          onClose={closeLegalScreen}
          onClosed={() => {
            setIsLegalScreenOpen(false);
            setIsLegalScreenClosing(false);
          }}
        />
      ) : null}

      <PasswordRecoveryStartDialog
        open={isRecoveryDialogOpen}
        initialIdentifier={identifier}
        onCancel={() => setIsRecoveryDialogOpen(false)}
        onEmailSelected={(email) => {
          setIsRecoveryDialogOpen(false);
          onPasswordRecoveryStart({ method: "email", identifier: email });
        }}
        onRecoveryCodeSelected={(username) => {
          setIsRecoveryDialogOpen(false);
          onPasswordRecoveryStart({ method: "recovery-code", username });
        }}
      />
    </main>
  );
}
