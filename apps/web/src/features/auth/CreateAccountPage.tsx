import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  TriangleAlert
} from "lucide-react";

import {
  generateAccountPassword,
  getPasswordCharacterStatuses,
  getPasswordStrength,
  isAccountPasswordComplete,
  type PasswordCharacterStatus
} from "./password-assistance";
import { validateEmail } from "./email-validation";
import { getAccountPasswordRequirements } from "./password-validation";
import {
  checkUsernameAvailability,
  startRegistration,
  startUsernameRegistration,
  type UsernameRegistrationResult
} from "./registration-api";
import type { RegistrationMethod } from "./registration-method";
import {
  type RegistrationField,
  validateRegistration
} from "./registration-validation";
import { validateUserName } from "./user-name-validation";
import {
  getUsernameValidationMessage,
  isReservedUsername,
  validateUsername
} from "./username-validation";

type CreateAccountPageProps = {
  method: RegistrationMethod;
  onBack: () => void;
  onRegistrationStarted: (email: string) => void;
  onUsernameRegistrationCreated: (
    registration: UsernameRegistrationResult
  ) => void;
};

type CreateAccountField = RegistrationField | "username";
type InvalidFields = Partial<Record<CreateAccountField, boolean>>;
type CopyableField =
  | "email"
  | "username"
  | "name"
  | "passwordConfirmation";
type CopyReadyFields = Partial<Record<CopyableField, boolean>>;
type UsernameAvailability =
  | "idle"
  | "checking"
  | "available"
  | "unavailable"
  | "error";

type FieldCopyAction = {
  copied: boolean;
  label: string;
  onCopy: () => void;
};

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
  generating?: boolean;
  characterStatuses?: PasswordCharacterStatus[];
  copyAction?: FieldCopyAction;
  generated?: boolean;
  onAutofill?: () => void;
  onBlur?: () => void;
  onChange: (value: string, autofilled: boolean) => void;
};

const generatedPasswordCharacterDelayMs = 11;
const generatedPasswordFieldDelayMs = 24;
const usernameAvailabilityDelayMs = 250;

function isBrowserAutofilled(input: HTMLInputElement) {
  try {
    return input.matches(":-webkit-autofill");
  } catch {
    return false;
  }
}

function revealTrailingCaret(
  input: HTMLInputElement,
  afterReveal?: () => void
) {
  window.requestAnimationFrame(() => {
    if (
      document.activeElement !== input ||
      input.selectionStart !== input.value.length ||
      input.selectionEnd !== input.value.length
    ) {
      return;
    }

    input.scrollLeft = input.scrollWidth;
    afterReveal?.();
  });
}

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
  generating = false,
  characterStatuses = [],
  copyAction,
  generated = false,
  onAutofill,
  onBlur,
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

  function handleCaretVisibility(event: React.SyntheticEvent<HTMLInputElement>) {
    revealTrailingCaret(event.currentTarget, syncCharacterFeedbackScroll);
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
            className={`auth-password-generate${
              generating ? " is-generating" : ""
            }`}
            type="button"
            onClick={onGenerate}
            aria-disabled={generating}
          >
            <RefreshCw aria-hidden="true" strokeWidth={1.8} />
            Generate
          </button>
        ) : copyAction ? (
          <FieldCopyButton {...copyAction} />
        ) : null}
      </div>
      <div
        className={`auth-input-with-action${
          showCharacterFeedback ? " has-character-feedback" : ""
        }`}
      >
        <input
          ref={inputRef}
          id={id}
          aria-labelledby={`${id}-label`}
          name={name}
          type={isVisible ? "text" : "password"}
          className={`auth-password-input auth-password-input--${
            isVisible ? "visible" : "masked"
          }${showCharacterFeedback ? " has-character-feedback" : ""}${
            generated && value.length > 0 ? " is-generated" : ""
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
          onChange={(event) => {
            const autofilled = isBrowserAutofilled(event.currentTarget);
            onChange(event.target.value, autofilled);

            if (autofilled) {
              onAutofill?.();
            }
          }}
          onAnimationStart={(event) => {
            if (event.animationName === "auth-password-autofill-detected") {
              window.requestAnimationFrame(() => onAutofill?.());
            }
          }}
          onFocus={handleCaretVisibility}
          onClick={handleCaretVisibility}
          onScroll={syncCharacterFeedbackScroll}
          onBlur={onBlur}
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
          className="auth-password-visibility"
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

function FieldCopyButton({ copied, label, onCopy }: FieldCopyAction) {
  return (
    <button
      className={`auth-field-copy-action${copied ? " is-copied" : ""}`}
      type="button"
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
      onPointerDown={(event) => event.preventDefault()}
      onClick={onCopy}
    >
      <span className="auth-field-copy-action__icons" aria-hidden="true">
        <Copy className="auth-field-copy-action__copy" strokeWidth={1.8} />
        <Check className="auth-field-copy-action__check" strokeWidth={1.8} />
      </span>
    </button>
  );
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.append(textArea);
  textArea.select();

  const copied = document.execCommand("copy");
  textArea.remove();

  if (!copied) {
    throw new Error("Clipboard access is unavailable.");
  }
}

export function CreateAccountPage({
  method,
  onBack,
  onRegistrationStarted,
  onUsernameRegistrationCreated
}: CreateAccountPageProps) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [invalidFields, setInvalidFields] = useState<InvalidFields>({});
  const [copyReadyFields, setCopyReadyFields] = useState<CopyReadyFields>({});
  const [copiedField, setCopiedField] = useState<CopyableField | null>(null);
  const [passwordAutofillDetected, setPasswordAutofillDetected] =
    useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [usernameLocalError, setUsernameLocalError] = useState<string | null>(
    null
  );
  const [usernameAvailabilityError, setUsernameAvailabilityError] = useState<
    string | null
  >(null);
  const [usernameAvailability, setUsernameAvailability] =
    useState<UsernameAvailability>("idle");
  const [isUsernameAvailabilityVisible, setIsUsernameAvailabilityVisible] =
    useState(false);
  const [usernameAvailabilityRevealId, setUsernameAvailabilityRevealId] =
    useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPassword, setIsGeneratingPassword] = useState(false);
  const [isAppGeneratedPassword, setIsAppGeneratedPassword] = useState(false);
  const copyFeedbackTimeoutRef = useRef<number | null>(null);
  const passwordGenerationRunRef = useRef(0);
  const usernameAvailabilityRequestRef = useRef(0);
  const usernameAvailabilityAbortRef = useRef<AbortController | null>(null);
  const usernameAvailabilityTimerRef = useRef<number | null>(null);
  const emailValidation = validateEmail(email);
  const usernameValidation = validateUsername(username);
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
  const identifierComplete =
    method === "email"
      ? emailValidation.success
      : usernameValidation.success &&
        usernameAvailability === "available" &&
        isUsernameAvailabilityVisible;
  const usernameRemoteError =
    isUsernameAvailabilityVisible && usernameAvailability === "unavailable"
      ? "Username already exists"
      : isUsernameAvailabilityVisible && usernameAvailability === "error"
        ? usernameAvailabilityError
        : null;
  const usernameDisplayedError = usernameLocalError ?? usernameRemoteError;
  const canSubmitRegistration =
    identifierComplete &&
    name.trim().length > 0 &&
    passwordPairComplete &&
    isAccountPasswordComplete(passwordConfirmation);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }

      if (usernameAvailabilityTimerRef.current !== null) {
        window.clearTimeout(usernameAvailabilityTimerRef.current);
      }

      usernameAvailabilityAbortRef.current?.abort();
      passwordGenerationRunRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!passwordAutofillDetected || !passwordPairComplete) {
      return;
    }

    setCopyStateAfterValidation(
      "passwordConfirmation",
      passwordConfirmation,
      isAccountPasswordComplete(passwordConfirmation)
    );
    setPasswordAutofillDetected(false);
  }, [
    password,
    passwordAutofillDetected,
    passwordConfirmation,
    passwordPairComplete
  ]);

  function resetCopyState(field: CopyableField) {
    setCopyReadyFields((current) => ({ ...current, [field]: false }));

    if (copiedField === field) {
      setCopiedField(null);
    }
  }

  function setCopyStateAfterValidation(
    field: CopyableField,
    value: string,
    valid: boolean
  ) {
    setCopyReadyFields((current) => ({
      ...current,
      [field]: value.length > 1 && valid
    }));
  }

  async function handleCopyField(field: CopyableField, value: string) {
    try {
      await copyTextToClipboard(value);
      setCopiedField(field);

      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }

      copyFeedbackTimeoutRef.current = window.setTimeout(() => {
        setCopiedField((current) => (current === field ? null : current));
        copyFeedbackTimeoutRef.current = null;
      }, 1400);
    } catch {
      setFormError("Unable to copy this field. Please try again.");
    }
  }

  function clearPasswordErrors() {
    setInvalidFields((current) => ({
      ...current,
      password: false,
      passwordConfirmation: false
    }));
    setFormError(null);
  }

  function waitForGeneratedPasswordStep(delay: number) {
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, delay);
    });
  }

  function cancelGeneratedPasswordAnimation() {
    if (!isGeneratingPassword) {
      return;
    }

    passwordGenerationRunRef.current += 1;
    setIsGeneratingPassword(false);
  }

  async function handleGeneratePassword() {
    if (isGeneratingPassword) {
      return;
    }

    try {
      const generatedPassword = generateAccountPassword();
      const runId = passwordGenerationRunRef.current + 1;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      const characterDelay = reduceMotion
        ? 0
        : generatedPasswordCharacterDelayMs;
      const fieldDelay = reduceMotion ? 0 : generatedPasswordFieldDelayMs;

      passwordGenerationRunRef.current = runId;
      setIsGeneratingPassword(true);
      setIsAppGeneratedPassword(true);
      setPassword("");
      setPasswordConfirmation("");
      resetCopyState("passwordConfirmation");
      setPasswordAutofillDetected(false);
      clearPasswordErrors();

      for (let index = 1; index <= generatedPassword.length; index += 1) {
        await waitForGeneratedPasswordStep(characterDelay);

        if (passwordGenerationRunRef.current !== runId) {
          return;
        }

        setPassword(generatedPassword.slice(0, index));
      }

      await waitForGeneratedPasswordStep(fieldDelay);

      for (let index = 1; index <= generatedPassword.length; index += 1) {
        await waitForGeneratedPasswordStep(characterDelay);

        if (passwordGenerationRunRef.current !== runId) {
          return;
        }

        setPasswordConfirmation(generatedPassword.slice(0, index));
      }

      if (passwordGenerationRunRef.current === runId) {
        setCopyStateAfterValidation(
          "passwordConfirmation",
          generatedPassword,
          isAccountPasswordComplete(generatedPassword)
        );
        setIsGeneratingPassword(false);
      }
    } catch (error) {
      setIsGeneratingPassword(false);
      setIsAppGeneratedPassword(false);
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to generate a secure password."
      );
    }
  }

  function clearFieldError(field: CreateAccountField) {
    if (invalidFields[field]) {
      setInvalidFields((current) => ({ ...current, [field]: false }));
    }

    if (formError) {
      setFormError(null);
    }
  }

  function validateEmailField() {
    if (email.trim().length === 0) {
      setInvalidFields((current) => ({ ...current, email: false }));
      setEmailError(null);
      setCopyStateAfterValidation("email", email, false);
      return;
    }

    const result = validateEmail(email);

    if (result.success) {
      setInvalidFields((current) => ({ ...current, email: false }));
      setEmailError(null);
      setCopyStateAfterValidation("email", email, true);
      return;
    }

    setInvalidFields((current) => ({ ...current, email: true }));
    setEmailError("Email is not valid");
    setCopyStateAfterValidation("email", email, false);
  }

  function cancelUsernameAvailabilityCheck() {
    if (usernameAvailabilityTimerRef.current !== null) {
      window.clearTimeout(usernameAvailabilityTimerRef.current);
      usernameAvailabilityTimerRef.current = null;
    }

    usernameAvailabilityAbortRef.current?.abort();
    usernameAvailabilityAbortRef.current = null;
    usernameAvailabilityRequestRef.current += 1;
  }

  async function runUsernameAvailabilityCheck(
    normalizedUsername: string,
    requestId: number
  ) {
    const controller = new AbortController();
    usernameAvailabilityAbortRef.current = controller;
    usernameAvailabilityTimerRef.current = null;
    setUsernameAvailabilityError(null);
    setUsernameAvailability("checking");

    try {
      const available = await checkUsernameAvailability(
        normalizedUsername,
        controller.signal
      );

      if (usernameAvailabilityRequestRef.current !== requestId) {
        return;
      }

      setUsernameAvailability(available ? "available" : "unavailable");
    } catch (error) {
      if (
        controller.signal.aborted ||
        usernameAvailabilityRequestRef.current !== requestId
      ) {
        return;
      }

      setUsernameAvailability("error");
      setUsernameAvailabilityError(
        (error instanceof Error
          ? error.message
          : "Unable to check username availability"
        ).replace(/\.$/, "")
      );
    } finally {
      if (usernameAvailabilityAbortRef.current === controller) {
        usernameAvailabilityAbortRef.current = null;
      }
    }
  }

  function scheduleUsernameAvailabilityCheck(normalizedUsername: string) {
    const requestId = usernameAvailabilityRequestRef.current;

    usernameAvailabilityTimerRef.current = window.setTimeout(() => {
      void runUsernameAvailabilityCheck(normalizedUsername, requestId);
    }, usernameAvailabilityDelayMs);
  }

  function handleUsernameChange(value: string) {
    const normalizedValue = value.toLowerCase();
    const result = validateUsername(normalizedValue);

    setUsername(normalizedValue);
    setUsernameAvailability("idle");
    setUsernameAvailabilityError(null);
    setIsUsernameAvailabilityVisible(false);
    cancelUsernameAvailabilityCheck();
    clearFieldError("username");

    if (normalizedValue.trim().length === 0) {
      setUsernameLocalError(null);
      setInvalidFields((current) => ({ ...current, username: false }));
      return;
    }

    if (!result.success) {
      const reserved = isReservedUsername(normalizedValue);

      setUsernameLocalError(
        reserved
          ? (result.error.issues[0]?.message ?? "This username is reserved")
          : null
      );
      setInvalidFields((current) => ({
        ...current,
        username: reserved
      }));
      return;
    }

    setUsernameLocalError(null);
    setInvalidFields((current) => ({ ...current, username: false }));
    scheduleUsernameAvailabilityCheck(result.data);
  }

  function handleUsernameBlur() {
    const result = validateUsername(username);

    if (!result.success) {
      if (username.trim().length > 0) {
        setUsernameLocalError(
          getUsernameValidationMessage(username) ?? "Username is not valid"
        );
        setInvalidFields((current) => ({ ...current, username: true }));
      }

      return;
    }

    if (!isUsernameAvailabilityVisible) {
      setUsernameAvailabilityRevealId((current) => current + 1);
    }

    setIsUsernameAvailabilityVisible(true);

    if (usernameAvailabilityTimerRef.current !== null) {
      window.clearTimeout(usernameAvailabilityTimerRef.current);
      usernameAvailabilityTimerRef.current = null;
      void runUsernameAvailabilityCheck(
        result.data,
        usernameAvailabilityRequestRef.current
      );
    }
  }

  function validateNameField() {
    setCopyStateAfterValidation(
      "name",
      name,
      validateUserName(name).success
    );
  }

  function validatePasswordConfirmationField() {
    setCopyStateAfterValidation(
      "passwordConfirmation",
      passwordConfirmation,
      passwordPairComplete && isAccountPasswordComplete(passwordConfirmation)
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (method === "username") {
      const parsedUsername = validateUsername(username);
      const parsedName = validateUserName(name);
      const usernameIsAvailable =
        usernameAvailability === "available" &&
        isUsernameAvailabilityVisible;
      const passwordIsValid = isAccountPasswordComplete(password);
      const confirmationIsValid =
        isAccountPasswordComplete(passwordConfirmation) &&
        password === passwordConfirmation;

      if (
        !parsedUsername.success ||
        !usernameIsAvailable ||
        !parsedName.success ||
        !passwordIsValid ||
        !confirmationIsValid
      ) {
        setInvalidFields({
          username: !parsedUsername.success || !usernameIsAvailable,
          name: !parsedName.success,
          password: !passwordIsValid,
          passwordConfirmation: !confirmationIsValid
        });
        setFormError(
          !parsedUsername.success
            ? (getUsernameValidationMessage(username) ??
              "Enter a valid username")
            : !usernameIsAvailable
              ? "Choose an available username"
              : !parsedName.success
                ? (parsedName.error.issues[0]?.message ?? "Enter your name")
                : !passwordIsValid
                  ? "Choose a password that meets every requirement"
                  : "Passwords do not match"
        );
        return;
      }

      setInvalidFields({});
      setFormError(null);
      setIsSubmitting(true);

      try {
        const registration = await startUsernameRegistration({
          username: parsedUsername.data,
          name: parsedName.data,
          password,
          passwordConfirmation
        });

        onUsernameRegistrationCreated(registration);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to create your account. Please try again.";

        if (message === "Username is unavailable.") {
          setUsernameAvailability("unavailable");
          setIsUsernameAvailabilityVisible(true);
          setInvalidFields((current) => ({ ...current, username: true }));
        }

        setFormError(message);
      } finally {
        setIsSubmitting(false);
      }

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
              {method === "email"
                ? "Enter your details and verify your email."
                : "No email needed. Choose a secure username."}
            </p>
          </div>
        </header>

        <form
          className="auth-login-form auth-register-form"
          data-registration-credential-form
          action="/api/auth/login/browser"
          method="post"
          autoComplete="on"
          noValidate
          onSubmit={handleSubmit}
        >
          {method === "email" ? (
            <div className="auth-form-field">
              <div className="auth-register-field-heading">
                <span id="register-email-label">Email address</span>
                {emailError ? (
                  <p
                    id="register-email-error"
                    className="auth-register-field-error"
                    role="alert"
                    aria-live="polite"
                  >
                    <TriangleAlert aria-hidden="true" strokeWidth={1.8} />
                    <span>{emailError}</span>
                  </p>
                ) : copyReadyFields.email ? (
                  <FieldCopyButton
                    label="email address"
                    copied={copiedField === "email"}
                    onCopy={() => handleCopyField("email", email)}
                  />
                ) : null}
              </div>
              <input
                id="register-email"
                className="auth-warning-input"
                aria-labelledby="register-email-label"
                name="username"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Enter your email address"
                value={email}
                maxLength={254}
                aria-invalid={invalidFields.email === true}
                aria-describedby={
                  emailError
                    ? "register-email-error"
                    : formError
                      ? "register-form-error"
                      : undefined
                }
                onChange={(event) => {
                  setEmail(event.target.value);
                  setEmailError(null);
                  resetCopyState("email");
                  clearFieldError("email");
                }}
                onFocus={(event) => revealTrailingCaret(event.currentTarget)}
                onClick={(event) => revealTrailingCaret(event.currentTarget)}
                onBlur={validateEmailField}
              />
            </div>
          ) : (
            <div className="auth-form-field">
              <div className="auth-register-field-heading">
                <span id="register-username-label">Username</span>
                {usernameDisplayedError ? (
                  <p
                    id="register-username-error"
                    className="auth-register-field-error"
                    role="alert"
                    aria-live="polite"
                  >
                    <TriangleAlert aria-hidden="true" strokeWidth={1.8} />
                    <span>{usernameDisplayedError}</span>
                  </p>
                ) : isUsernameAvailabilityVisible &&
                  usernameAvailability === "available" ? (
                  <FieldCopyButton
                    label="username"
                    copied={copiedField === "username"}
                    onCopy={() => handleCopyField("username", username)}
                  />
                ) : null}
              </div>
              <div className="auth-input-with-action auth-username-input">
                <input
                  id="register-username"
                  className="auth-warning-input"
                  aria-labelledby="register-username-label"
                  name="username"
                  type="text"
                  inputMode="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Choose a username"
                  value={username}
                  maxLength={30}
                  aria-invalid={
                    invalidFields.username === true ||
                    usernameRemoteError !== null
                  }
                  aria-describedby={
                    usernameDisplayedError
                      ? "register-username-error"
                      : formError
                        ? "register-form-error"
                        : undefined
                  }
                  onChange={(event) => {
                    resetCopyState("username");
                    handleUsernameChange(event.target.value);
                  }}
                  onFocus={(event) => revealTrailingCaret(event.currentTarget)}
                  onClick={(event) => revealTrailingCaret(event.currentTarget)}
                  onBlur={handleUsernameBlur}
                />
                {isUsernameAvailabilityVisible &&
                usernameAvailability === "available" ? (
                  <span
                    key={usernameAvailabilityRevealId}
                    className="auth-username-input__status"
                    role="status"
                    aria-label="Username is available"
                  >
                    <Check aria-hidden="true" strokeWidth={2} />
                  </span>
                ) : null}
              </div>
            </div>
          )}

          <div className="auth-form-field">
            <div className="auth-register-field-heading">
              <span id="register-name-label">Name</span>
              {copyReadyFields.name ? (
                <FieldCopyButton
                  label="name"
                  copied={copiedField === "name"}
                  onCopy={() => handleCopyField("name", name)}
                />
              ) : null}
            </div>
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
                resetCopyState("name");
                clearFieldError("name");
              }}
              onFocus={(event) => revealTrailingCaret(event.currentTarget)}
              onClick={(event) => revealTrailingCaret(event.currentTarget)}
              onBlur={validateNameField}
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
            generating={isGeneratingPassword}
            generated={isAppGeneratedPassword}
            characterStatuses={characterStatuses.password}
            onAutofill={() => setPasswordAutofillDetected(true)}
            onChange={(value, autofilled) => {
              cancelGeneratedPasswordAnimation();
              setIsAppGeneratedPassword(false);
              setPassword(value);

              if (autofilled) {
                setPasswordAutofillDetected(true);
              } else {
                setPasswordAutofillDetected(false);
                resetCopyState("passwordConfirmation");
              }

              clearPasswordErrors();
            }}
          />

          <PasswordField
            id="register-password-confirmation"
            label="Repeat password"
            name="passwordConfirmation"
            placeholder="Repeat your password"
            value={passwordConfirmation}
            invalid={invalidFields.passwordConfirmation === true}
            complete={passwordPairComplete}
            generated={isAppGeneratedPassword}
            describedBy={formError ? "register-form-error" : undefined}
            characterStatuses={characterStatuses.confirmation}
            copyAction={
              copyReadyFields.passwordConfirmation
                ? {
                    label: "repeated password",
                    copied: copiedField === "passwordConfirmation",
                    onCopy: () =>
                      handleCopyField(
                        "passwordConfirmation",
                        passwordConfirmation
                      )
                  }
                : undefined
            }
            onAutofill={() => setPasswordAutofillDetected(true)}
            onBlur={validatePasswordConfirmationField}
            onChange={(value, autofilled) => {
              cancelGeneratedPasswordAnimation();
              setIsAppGeneratedPassword(false);
              setPasswordConfirmation(value);

              if (autofilled) {
                setPasswordAutofillDetected(true);
              } else {
                setPasswordAutofillDetected(false);
                resetCopyState("passwordConfirmation");
              }

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
            disabled={isSubmitting || !canSubmitRegistration}
          >
            {isSubmitting
              ? method === "email"
                ? "Sending code..."
                : "Creating account..."
              : "Continue"}
          </button>
        </form>
      </section>
    </main>
  );
}
