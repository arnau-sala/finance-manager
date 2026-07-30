import { useRef, useState } from "react";
import { ChevronLeft, Eye, EyeOff } from "lucide-react";

import { login } from "./auth-api";
import { validateEmail } from "./email-validation";
import { validateLoginPassword } from "./password-validation";

type PasswordLoginPageProps = {
  email: string;
  onBack: () => void;
  onLoginSuccess: () => void | Promise<void>;
};

type InvalidFields = {
  email: boolean;
  password: boolean;
};

const supportsImmediatePasswordMask =
  typeof CSS !== "undefined" && CSS.supports("-webkit-text-security", "disc");

export function PasswordLoginPage({
  email: initialEmail,
  onBack,
  onLoginSuccess
}: PasswordLoginPageProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<InvalidFields>({
    email: false,
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

    const parsedEmail = validateEmail(email);

    if (!parsedEmail.success) {
      setInvalidFields({ email: true, password: false });
      setFormError(parsedEmail.error.issues[0]?.message ?? "Enter a valid email address.");
      return;
    }

    const parsedPassword = validateLoginPassword(password);

    if (!parsedPassword.success) {
      setInvalidFields({ email: false, password: true });
      setFormError(parsedPassword.error.issues[0]?.message ?? "Enter your password.");
      return;
    }

    setFormError(null);
    setInvalidFields({ email: false, password: false });
    setIsSubmitting(true);

    try {
      await login({
        email: parsedEmail.data,
        password: parsedPassword.data
      });
      await onLoginSuccess();
    } catch (error) {
      setInvalidFields({ email: true, password: true });
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
            <span id="login-email-label">Email address</span>
            <input
              id="login-email"
              aria-labelledby="login-email-label"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              aria-invalid={invalidFields.email}
              aria-describedby={formError ? "login-form-error" : undefined}
              onChange={(event) => {
                setEmail(event.target.value);
                if (formError) {
                  setFormError(null);
                  setInvalidFields({ email: false, password: false });
                }
              }}
            />
          </div>

          <div className="auth-form-field auth-password-field">
            <span id="login-password-label">Password</span>
            <div className="auth-input-with-action">
              <input
                key={isPasswordVisible ? "visible" : "masked"}
                ref={passwordInput}
                id="login-password"
                aria-labelledby="login-password-label"
                name="password"
                type={
                  isPasswordVisible || supportsImmediatePasswordMask
                    ? "text"
                    : "password"
                }
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
                    setInvalidFields({ email: false, password: false });
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
