import { useRef, useState } from "react";
import { ChevronLeft, Eye, EyeOff } from "lucide-react";

import { login } from "./auth-api";
import { validateLoginIdentifier } from "./login-identifier-validation";
import { validateLoginPassword } from "./password-validation";

type PasswordLoginPageProps = {
  identifier: string;
  onBack: () => void;
  onLoginSuccess: () => void | Promise<void>;
};

type InvalidFields = {
  identifier: boolean;
  password: boolean;
};

export function PasswordLoginPage({
  identifier: initialIdentifier,
  onBack,
  onLoginSuccess
}: PasswordLoginPageProps) {
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<InvalidFields>({
    identifier: false,
    password: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordInput = useRef<HTMLInputElement>(null);

  function togglePasswordVisibility() {
    setIsPasswordVisible((isVisible) => !isVisible);

    requestAnimationFrame(() => {
      const input = passwordInput.current;

      if (!input) {
        return;
      }

      input.focus({ preventScroll: true });
      input.setSelectionRange(password.length, password.length);
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const parsedIdentifier = validateLoginIdentifier(identifier);

    if (!parsedIdentifier.success) {
      setInvalidFields({ identifier: true, password: false });
      setFormError(parsedIdentifier.message);
      return;
    }

    const parsedPassword = validateLoginPassword(password);

    if (!parsedPassword.success) {
      setInvalidFields({ identifier: false, password: true });
      setFormError(parsedPassword.error.issues[0]?.message ?? "Enter your password.");
      return;
    }

    setFormError(null);
    setInvalidFields({ identifier: false, password: false });
    setIsSubmitting(true);

    try {
      await login({
        identifier: parsedIdentifier.data,
        password: parsedPassword.data
      });
      await onLoginSuccess();
    } catch (error) {
      setInvalidFields({ identifier: true, password: true });
      setFormError(
        error instanceof Error
          ? error.message
          : "Login failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-screen auth-screen--static auth-screen--login">
      <button className="auth-back-button" type="button" onClick={onBack} aria-label="Go back">
        <ChevronLeft aria-hidden="true" strokeWidth={1.8} />
      </button>

      <section className="auth-panel auth-login-panel" aria-labelledby="login-title">
        <header className="auth-header auth-login-header">
          <div className="auth-logo auth-logo--login" aria-hidden="true">
            <img
              src="/icons/app-icon-512.png"
              width={512}
              height={512}
              alt=""
              decoding="sync"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
            <span>FM</span>
          </div>

          <div className="auth-message">
            <h1 id="login-title">Welcome back</h1>
            <p className="auth-subtitle">Enter your details to access your account</p>
          </div>
        </header>

        <form
          className="auth-login-form"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="auth-form-field">
            <span id="login-identifier-label">Email or username</span>
            <input
              id="login-identifier"
              aria-labelledby="login-identifier-label"
              name="username"
              type="text"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={identifier}
              aria-invalid={invalidFields.identifier}
              aria-describedby={formError ? "login-form-error" : undefined}
              onChange={(event) => {
                setIdentifier(event.target.value);
                if (formError) {
                  setFormError(null);
                  setInvalidFields({ identifier: false, password: false });
                }
              }}
            />
          </div>

          <div className="auth-form-field auth-password-field">
            <span id="login-password-label">Password</span>
            <div className="auth-input-with-action">
              <input
                ref={passwordInput}
                id="login-password"
                aria-labelledby="login-password-label"
                name="password"
                type={isPasswordVisible ? "text" : "password"}
                className={`auth-password-input auth-password-input--${
                  isPasswordVisible ? "visible" : "masked"
                }`}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Enter your password"
                value={password}
                aria-invalid={invalidFields.password}
                aria-describedby={formError ? "login-form-error" : undefined}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (formError) {
                    setFormError(null);
                    setInvalidFields({ identifier: false, password: false });
                  }
                }}
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                aria-pressed={isPasswordVisible}
              >
                {isPasswordVisible ? (
                  <EyeOff aria-hidden="true" strokeWidth={1.8} />
                ) : (
                  <Eye aria-hidden="true" strokeWidth={1.8} />
                )}
              </button>
            </div>
          </div>

          <p
            id="login-form-error"
            className="auth-field-message auth-field-message--error auth-login-error"
            role="alert"
            aria-live="polite"
          >
            {formError ?? "\u00a0"}
          </p>

          <button className="auth-primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Checking..." : "Continue"}
          </button>
        </form>
      </section>
    </main>
  );
}
