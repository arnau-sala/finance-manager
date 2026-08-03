import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Eye, EyeOff, RefreshCw } from "lucide-react";

import {
  generateAccountPassword,
  getPasswordCharacterStatuses,
  getPasswordStrength,
  isAccountPasswordComplete,
  type PasswordCharacterStatus
} from "./password-assistance";
import { getAccountPasswordRequirements } from "./password-validation";
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
  complete?: boolean;
  describedBy?: string;
  onGenerate?: () => void;
  characterStatuses?: PasswordCharacterStatus[];
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
  complete = false,
  describedBy,
  onGenerate,
  characterStatuses = [],
  onChange
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const characterFeedbackRef = useRef<HTMLDivElement>(null);
  const showCharacterFeedback =
    !isVisible && value.length > 0 && characterStatuses.length > 0;

  function syncCharacterFeedbackScroll() {
    if (inputRef.current && characterFeedbackRef.current) {
      characterFeedbackRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  }

  useEffect(() => {
    if (!showCharacterFeedback) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(
      syncCharacterFeedbackScroll
    );

    return () => window.cancelAnimationFrame(animationFrame);
  }, [showCharacterFeedback, value]);

  function toggleVisibility() {
    setIsVisible((current) => !current);

    window.requestAnimationFrame(() => {
      const input = inputRef.current;

      if (!input) {
        return;
      }

      input.focus({ preventScroll: true });
      input.setSelectionRange(value.length, value.length);
      window.requestAnimationFrame(syncCharacterFeedbackScroll);
    });
  }

  return (
    <div
      className={`auth-form-field auth-password-field${
        complete ? " is-complete" : ""
      }`}
    >
      <div className="auth-password-field-heading">
        <span id={`${id}-label`}>{label}</span>
        {onGenerate ? (
          <button
            className="auth-password-generate"
            type="button"
            onClick={onGenerate}
          >
            <RefreshCw aria-hidden="true" strokeWidth={1.8} />
            Generate
          </button>
        ) : null}
      </div>
      <div
        className={`auth-input-with-action${
          showCharacterFeedback ? " has-character-feedback" : ""
        }`}
      >
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
          }${showCharacterFeedback ? " has-character-feedback" : ""}`}
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
          onScroll={syncCharacterFeedbackScroll}
        />
        {showCharacterFeedback ? (
          <div
            ref={characterFeedbackRef}
            className="auth-password-character-feedback"
            aria-hidden="true"
          >
            <div
              className="auth-password-character-feedback__track"
              style={{
                width: `${characterStatuses.length * 12}px`,
                gridTemplateColumns: `repeat(${characterStatuses.length}, 12px)`
              }}
            >
              {characterStatuses.map((status, index) => (
                <span key={index} className={`is-${status}`} />
              ))}
            </div>
          </div>
        ) : null}
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
  const passwordRequirements = getAccountPasswordRequirements(password);
  const passwordStrength = getPasswordStrength(password);
  const characterStatuses = getPasswordCharacterStatuses(
    password,
    passwordConfirmation
  );
  const passwordsMatch =
    password.length > 0 && password === passwordConfirmation;
  const passwordPairComplete =
    passwordsMatch && isAccountPasswordComplete(password);

  function clearPasswordErrors() {
    setInvalidFields((current) => ({
      ...current,
      password: false,
      passwordConfirmation: false
    }));
    setFormError(null);
  }

  function handleGeneratePassword() {
    try {
      const generatedPassword = generateAccountPassword();
      setPassword(generatedPassword);
      setPasswordConfirmation(generatedPassword);
      clearPasswordErrors();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to generate a secure password."
      );
    }
  }

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
            complete={passwordPairComplete}
            describedBy={
              formError
                ? "register-form-error"
                : "register-password-requirements"
            }
            onGenerate={handleGeneratePassword}
            characterStatuses={characterStatuses.password}
            onChange={(value) => {
              setPassword(value);
              clearPasswordErrors();
            }}
          />

          <div className="auth-password-assistance">
            <div className="auth-password-strength">
              <div
                className="auth-password-strength__track"
                role="progressbar"
                aria-label="Password strength"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={passwordStrength.percentage}
                aria-valuetext={passwordStrength.label}
              >
                <span
                  className={`is-${passwordStrength.level}`}
                  style={{ width: `${passwordStrength.percentage}%` }}
                />
              </div>
              <span
                className={`auth-password-strength__label is-${passwordStrength.level}`}
              >
                {passwordStrength.label}
              </span>
            </div>

            <div
              id="register-password-requirements"
              className="auth-password-requirements"
              aria-label="Password requirements"
            >
              {passwordRequirements.map((requirement) => (
                <span
                  key={requirement.id}
                  className={requirement.met ? "is-met" : undefined}
                >
                  {requirement.label}
                </span>
              ))}
            </div>
          </div>

          <PasswordField
            id="register-password-confirmation"
            label="Repeat password"
            name="passwordConfirmation"
            placeholder="Repeat your password"
            value={passwordConfirmation}
            invalid={invalidFields.passwordConfirmation === true}
            complete={passwordPairComplete}
            describedBy={formError ? "register-form-error" : undefined}
            characterStatuses={characterStatuses.confirmation}
            onChange={(value) => {
              setPasswordConfirmation(value);
              clearPasswordErrors();
            }}
          />

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
