import { useRef, useState } from "react";
import { ChevronLeft, Eye, EyeOff } from "lucide-react";

import { startRegistration } from "./registration-api";
import {
  type RegistrationField,
  validateRegistration
} from "./registration-validation";

type CreateAccountPageProps = {
  onBack: () => void;
  onRegistrationStarted: (email: string) => void;
};

type InvalidFields = Partial<Record<RegistrationField, boolean>>;

type PasswordFieldProps = {
  id: string;
  label: string;
  name: "password" | "passwordConfirmation";
  placeholder: string;
  value: string;
  invalid: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
};

const supportsImmediatePasswordMask =
  typeof CSS !== "undefined" && CSS.supports("-webkit-text-security", "disc");

function PasswordField({
  id,
  label,
  name,
  placeholder,
  value,
  invalid,
  describedBy,
  onChange
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function toggleVisibility() {
    setIsVisible((current) => !current);

    window.requestAnimationFrame(() => {
      const input = inputRef.current;

      if (!input) {
        return;
      }

      input.focus({ preventScroll: true });
      input.setSelectionRange(value.length, value.length);
    });
  }

  return (
    <div className="auth-form-field auth-password-field">
      <span id={`${id}-label`}>{label}</span>
      <div className="auth-input-with-action">
        <input
          key={isVisible ? "visible" : "masked"}
          ref={inputRef}
          id={id}
          aria-labelledby={`${id}-label`}
          name={name}
          type={
            isVisible || supportsImmediatePasswordMask ? "text" : "password"
          }
          className={`auth-password-input auth-password-input--${
            isVisible ? "visible" : "masked"
          }`}
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          maxLength={128}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          onClick={toggleVisibility}
          aria-label={
            isVisible
              ? `Hide ${label.toLowerCase()}`
              : `Show ${label.toLowerCase()}`
          }
          aria-pressed={isVisible}
        >
          {isVisible ? (
            <EyeOff aria-hidden="true" strokeWidth={1.8} />
          ) : (
            <Eye aria-hidden="true" strokeWidth={1.8} />
          )}
        </button>
      </div>
    </div>
  );
}

export function CreateAccountPage({
  onBack,
  onRegistrationStarted
}: CreateAccountPageProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [invalidFields, setInvalidFields] = useState<InvalidFields>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function clearFieldError(field: RegistrationField) {
    if (invalidFields[field]) {
      setInvalidFields((current) => ({ ...current, [field]: false }));
    }

    if (formError) {
      setFormError(null);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const result = validateRegistration({
      email,
      name,
      password,
      passwordConfirmation
    });

    if (!result.success) {
      const nextInvalidFields: InvalidFields = {};

      for (const issue of result.error.issues) {
        const field = issue.path[0];

        if (
          field === "email" ||
          field === "name" ||
          field === "password" ||
          field === "passwordConfirmation"
        ) {
          nextInvalidFields[field] = true;
        }
      }

      setInvalidFields(nextInvalidFields);
      setFormError(
        result.error.issues[0]?.message ?? "Check the information you entered."
      );
      return;
    }

    setInvalidFields({});
    setFormError(null);
    setIsSubmitting(true);

    try {
      await startRegistration(result.data);
      setPassword("");
      setPasswordConfirmation("");
      onRegistrationStarted(result.data.email);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to start registration. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-screen auth-screen--login auth-screen--register">
      <button
        className="auth-back-button"
        type="button"
        onClick={onBack}
        aria-label="Go back"
      >
        <ChevronLeft aria-hidden="true" strokeWidth={1.8} />
      </button>

      <section
        className="auth-panel auth-register-panel"
        aria-labelledby="register-title"
      >
        <header className="auth-header auth-register-header">
          <div className="auth-logo auth-logo--register" aria-hidden="true">
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
            <h1 id="register-title">Create your account</h1>
            <p className="auth-subtitle auth-register-subtitle">
              Enter your details to get started.
            </p>
          </div>
        </header>

        <form
          className="auth-login-form auth-register-form"
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="auth-form-field">
            <span id="register-email-label">Email address</span>
            <input
              id="register-email"
              aria-labelledby="register-email-label"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Enter your email address"
              value={email}
              maxLength={254}
              aria-invalid={invalidFields.email === true}
              aria-describedby={formError ? "register-form-error" : undefined}
              onChange={(event) => {
                setEmail(event.target.value);
                clearFieldError("email");
              }}
            />
          </div>

          <div className="auth-form-field">
            <span id="register-name-label">Name</span>
            <input
              id="register-name"
              aria-labelledby="register-name-label"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Enter your name"
              value={name}
              maxLength={100}
              aria-invalid={invalidFields.name === true}
              aria-describedby={formError ? "register-form-error" : undefined}
              onChange={(event) => {
                setName(event.target.value);
                clearFieldError("name");
              }}
            />
          </div>

          <PasswordField
            id="register-password"
            label="Password"
            name="password"
            placeholder="Create a password"
            value={password}
            invalid={invalidFields.password === true}
            describedBy={
              formError
                ? "register-form-error"
                : "register-password-requirements"
            }
            onChange={(value) => {
              setPassword(value);
              clearFieldError("password");
            }}
          />

          <PasswordField
            id="register-password-confirmation"
            label="Repeat password"
            name="passwordConfirmation"
            placeholder="Repeat your password"
            value={passwordConfirmation}
            invalid={invalidFields.passwordConfirmation === true}
            describedBy={formError ? "register-form-error" : undefined}
            onChange={(value) => {
              setPasswordConfirmation(value);
              clearFieldError("passwordConfirmation");
            }}
          />

          <p
            id="register-password-requirements"
            className="auth-register-requirements"
          >
            9+ characters, uppercase, number and special character.
          </p>

          <p
            id="register-form-error"
            className="auth-field-message auth-field-message--error auth-register-error"
            role="alert"
            aria-live="polite"
          >
            {formError ?? "\u00a0"}
          </p>

          <button
            className="auth-primary-button auth-register-submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending code..." : "Continue"}
          </button>
        </form>
      </section>
    </main>
  );
}
