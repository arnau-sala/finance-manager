import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, TriangleAlert } from "lucide-react";

import { ActionButton } from "../../components/ui/ActionButton";
import { formatErrorMessage } from "../../components/ui/error-message";
import {
  generateAccountPassword,
  getPasswordCharacterStatuses,
  isAccountPasswordComplete
} from "./password-assistance";
import {
  AuthPasswordField,
  FieldCopyButton,
  revealTrailingCaret
} from "./AuthPasswordField";
import { copyTextToClipboard } from "./clipboard";
import { validateEmail } from "./email-validation";
import { LegalAcceptanceCheckbox } from "./LegalAcceptanceCheckbox";
import { LegalNoticeScreen } from "./LegalNoticeScreen";
import { PasswordSecuritySummary } from "./PasswordSecuritySummary";
import {
  checkUsernameAvailability,
  startRegistration,
  startUsernameRegistration,
  type UsernameRegistrationResult
} from "./registration-api";
import type { CredentialRegistrationMethod } from "./registration-method";
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
  method: CredentialRegistrationMethod;
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

const generatedPasswordCharacterDelayMs = 11;
const generatedPasswordFieldDelayMs = 24;
const usernameAvailabilityDelayMs = 250;
const usernameMaxLength = 15;
const usernameCharacterCountRevealLength = 10;
const userNameMaxLength = 20;
const userNameCharacterCountRevealLength = 15;

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
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false);
  const [isLegalScreenOpen, setIsLegalScreenOpen] = useState(false);
  const [isLegalScreenClosing, setIsLegalScreenClosing] = useState(false);
  const copyFeedbackTimeoutRef = useRef<number | null>(null);
  const passwordGenerationRunRef = useRef(0);
  const usernameAvailabilityRequestRef = useRef(0);
  const usernameAvailabilityAbortRef = useRef<AbortController | null>(null);
  const usernameAvailabilityTimerRef = useRef<number | null>(null);
  const emailValidation = validateEmail(email);
  const usernameValidation = validateUsername(username);
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
    isAccountPasswordComplete(passwordConfirmation) &&
    hasAcceptedLegal;

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
      setFormError("Unable to copy this field\nPlease try again");
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
          : "Unable to generate a secure password"
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

  function openLegalScreen() {
    setIsLegalScreenClosing(false);
    setIsLegalScreenOpen(true);
  }

  function closeLegalScreen() {
    setIsLegalScreenClosing(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!hasAcceptedLegal) {
      setFormError("Accept Privacy & Terms to create your account");
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
          passwordConfirmation,
          legalAccepted: true
        });

        onUsernameRegistrationCreated(registration);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to create your account\nPlease try again";

        if (message === "Username is unavailable") {
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
        result.error.issues[0]?.message ?? "Check the information you entered"
      );
      return;
    }

    setInvalidFields({});
    setFormError(null);
    setIsSubmitting(true);

    try {
      await startRegistration({ ...result.data, legalAccepted: true });
      onRegistrationStarted(result.data.email);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to start registration\nPlease try again"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-screen auth-screen--login auth-screen--register">
      <ActionButton
        shape="icon"
        className="auth-back-button"
        type="button"
        onClick={onBack}
        aria-label="Go back"
      >
        <ChevronLeft aria-hidden="true" strokeWidth={1.8} />
      </ActionButton>

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
                ? "Enter your details and verify your email"
                : "No email needed"}
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
                <span className="text-field-label" id="register-email-label">
                  Email address
                </span>
                {emailError ? (
                  <p
                    id="register-email-error"
                    className="auth-register-field-error"
                    role="alert"
                    aria-live="polite"
                  >
                    <TriangleAlert aria-hidden="true" strokeWidth={1.8} />
                    <span>{formatErrorMessage(emailError)}</span>
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
                className="text-field auth-warning-input"
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
                <span className="text-field-label" id="register-username-label">
                  Username
                </span>
                <span className="auth-register-field-actions">
                  {username.length >= usernameCharacterCountRevealLength ? (
                    <span
                      className="transaction-composer__character-count"
                      aria-live="polite"
                    >
                      {username.length}/{usernameMaxLength}
                    </span>
                  ) : null}
                  {usernameDisplayedError ? (
                    <p
                      id="register-username-error"
                      className="auth-register-field-error"
                      role="alert"
                      aria-live="polite"
                    >
                      <TriangleAlert aria-hidden="true" strokeWidth={1.8} />
                      <span>{formatErrorMessage(usernameDisplayedError)}</span>
                    </p>
                  ) : isUsernameAvailabilityVisible &&
                    usernameAvailability === "available" ? (
                    <FieldCopyButton
                      label="username"
                      copied={copiedField === "username"}
                      onCopy={() => handleCopyField("username", username)}
                    />
                  ) : null}
                </span>
              </div>
              <div className="auth-input-with-action auth-username-input">
                <input
                  id="register-username"
                  className="text-field auth-warning-input"
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
                  maxLength={usernameMaxLength}
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
              <span className="text-field-label" id="register-name-label">
                Name
              </span>
              <span className="auth-register-field-actions">
                {name.length >= userNameCharacterCountRevealLength ? (
                  <span
                    className="transaction-composer__character-count"
                    aria-live="polite"
                  >
                    {name.length}/{userNameMaxLength}
                  </span>
                ) : null}
                {copyReadyFields.name ? (
                  <FieldCopyButton
                    label="name"
                    copied={copiedField === "name"}
                    onCopy={() => handleCopyField("name", name)}
                  />
                ) : null}
              </span>
            </div>
            <input
              id="register-name"
              className="text-field"
              aria-labelledby="register-name-label"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Enter your name"
              value={name}
              maxLength={userNameMaxLength}
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

          <AuthPasswordField
            id="register-password"
            label="Password"
            name="password"
            placeholder="Create a password"
            value={password}
            invalid={invalidFields.password === true}
            autoComplete="new-password"
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

          <AuthPasswordField
            id="register-password-confirmation"
            label="Repeat password"
            name="passwordConfirmation"
            placeholder="Repeat your password"
            value={passwordConfirmation}
            invalid={invalidFields.passwordConfirmation === true}
            autoComplete="new-password"
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

          <PasswordSecuritySummary
            password={password}
            requirementsId="register-password-requirements"
          />

          <LegalAcceptanceCheckbox
            id="register-legal-acceptance"
            checked={hasAcceptedLegal}
            onChange={setHasAcceptedLegal}
            onOpenLegal={openLegalScreen}
          />

          <p
            id="register-form-error"
            className="auth-field-message auth-field-message--error auth-register-error"
            role="alert"
            aria-live="polite"
          >
            {formError ? formatErrorMessage(formError) : "\u00a0"}
          </p>

          <ActionButton
            className="auth-primary-button auth-register-submit"
            type="submit"
            disabled={isSubmitting || !canSubmitRegistration}
          >
            {isSubmitting
              ? method === "email"
                ? "Sending code"
                : "Creating account"
              : "Continue"}
          </ActionButton>
        </form>
      </section>

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
    </main>
  );
}
