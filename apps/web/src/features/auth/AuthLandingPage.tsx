import { useRef, useState } from "react";
import { ArrowRight, Mail } from "lucide-react";

import { validateEmail } from "./email-validation";

function GoogleIcon() {
  return (
    <svg
      className="auth-provider-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.98-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.93A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.62.39 3.16 1.04 4.55l3.35-2.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.94c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"
      />
    </svg>
  );
}

type AuthLandingPageProps = {
  onEmailContinue: (email: string) => void;
  onRequestAccess: () => void;
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
  onRequestAccess
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
                src="/icons/app-icon.png"
                alt=""
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
            {emailError ?? "\u00a0"}
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

            <button className="auth-option auth-option--google" type="button">
              <span className="auth-option-label">
                <GoogleIcon />
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
