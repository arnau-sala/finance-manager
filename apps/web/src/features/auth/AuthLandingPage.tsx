import { useRef, useState } from "react";
import { ArrowRight, Mail } from "lucide-react";

import { GoogleIcon } from "../../components/brand/GoogleIcon";
import { validateEmail } from "./email-validation";

type AuthLandingPageProps = {
  onEmailContinue: (email: string) => void;
  onRequestAccess: () => void;
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
  onEmailContinue,
  onRequestAccess,
  onGoogleContinue,
  externalError = null,
  onClearExternalError
}: AuthLandingPageProps) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const hasContinued = useRef(false);

  function continueWithEmail(value: string) {
    const result = validateEmail(value);

    if (!result.success) {
      setEmailError(result.error.issues[0]?.message ?? "Enter a valid email address.");
      return;
    }

    if (hasContinued.current) {
      return;
    }

    hasContinued.current = true;
    setEmailError(null);
    onEmailContinue(result.data);
  }

  function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    continueWithEmail(email);
  }

  function handleEmailAutofill(input: HTMLInputElement) {
    if (input.value) {
      setEmail(input.value);
      continueWithEmail(input.value);
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
            onSubmit={handleEmailSubmit}
            noValidate
          >
            <label className="sr-only" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Email address"
              value={email}
              aria-invalid={emailError !== null}
              aria-describedby={emailError ? "email-error" : undefined}
              onChange={(event) => {
                const input = event.currentTarget;
                setEmail(input.value);
                onClearExternalError?.();
                if (emailError) {
                  setEmailError(null);
                }

                if (isAutofilled(input)) {
                  handleEmailAutofill(input);
                }
              }}
              onAnimationStart={(event) => {
                if (event.animationName === "auth-email-autofill") {
                  handleEmailAutofill(event.currentTarget);
                }
              }}
            />
            <button type="submit" aria-label="Continue with email">
              <ArrowRight aria-hidden="true" strokeWidth={2} />
            </button>
          </form>

          <p
            id="email-error"
            className="auth-field-message auth-field-message--error"
            role="alert"
            aria-live="polite"
          >
            {emailError ?? externalError ?? "\u00a0"}
          </p>

          <div className="auth-divider" aria-hidden="true">
            <span>OR</span>
          </div>

          <div className="auth-options">
            <button className="auth-option" type="button" onClick={onRequestAccess}>
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
