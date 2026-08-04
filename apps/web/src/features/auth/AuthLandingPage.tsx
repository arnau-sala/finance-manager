import { useRef, useState } from "react";
import { ArrowRight, Mail } from "lucide-react";

import { GoogleIcon } from "../../components/brand/GoogleIcon";
import { validateLoginIdentifier } from "./login-identifier-validation";

type AuthLandingPageProps = {
  onIdentifierContinue: (identifier: string) => void;
  onCreateAccount: () => void;
  onGoogleContinue: () => void;
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
  externalError = null,
  onClearExternalError
}: AuthLandingPageProps) {
  const [identifier, setIdentifier] = useState("");
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const hasContinued = useRef(false);

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

  return (
    <main className="auth-screen auth-screen--static">
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
              aria-describedby={identifierError ? "identifier-error" : undefined}
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
            <button type="submit" aria-label="Continue with email or username">
              <ArrowRight aria-hidden="true" strokeWidth={2} />
            </button>
          </form>

          <p
            id="identifier-error"
            className="auth-field-message auth-field-message--error"
            role="alert"
            aria-live="polite"
          >
            {identifierError ?? externalError ?? "\u00a0"}
          </p>

          <div className="auth-divider" aria-hidden="true">
            <span>OR</span>
          </div>

          <div className="auth-options">
            <button className="auth-option" type="button" onClick={onCreateAccount}>
              <span className="auth-option-label">
                <Mail aria-hidden="true" strokeWidth={1.8} />
                Create an account
              </span>
              <ArrowRight className="auth-option-arrow" aria-hidden="true" />
            </button>

            <button
              className="auth-option auth-option--google"
              type="button"
              onClick={onGoogleContinue}
            >
              <span className="auth-option-label">
                <GoogleIcon className="auth-provider-icon" />
                Continue with Google
              </span>
              <ArrowRight className="auth-option-arrow" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
