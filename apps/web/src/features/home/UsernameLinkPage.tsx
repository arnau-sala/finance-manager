import { useState, type FormEvent } from "react";
import { AtSign, ChevronLeft } from "lucide-react";

import { ActionButton } from "../../components/ui/ActionButton";
import { formatErrorMessage } from "../../components/ui/error-message";
import { ApiRequestError, linkUsername } from "../auth/auth-api";
import { NewPasswordFields } from "../auth/NewPasswordFields";
import { isAccountPasswordComplete } from "../auth/password-assistance";
import { validateAccountPassword } from "../auth/password-validation";
import { UsernameAvailabilityField } from "../auth/UsernameAvailabilityField";

type UsernameLinkPageProps = {
  requiresPassword: boolean;
  onBack: () => void;
  onLinked: (result: Awaited<ReturnType<typeof linkUsername>>) => void;
  onSessionExpired: () => void;
};

export function UsernameLinkPage({
  requiresPassword,
  onBack,
  onLinked,
  onSessionExpired,
}: UsernameLinkPageProps) {
  const [username, setUsername] = useState("");
  const [validUsername, setValidUsername] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [unavailableUsername, setUnavailableUsername] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [arePasswordFieldsInvalid, setArePasswordFieldsInvalid] =
    useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordComplete =
    !requiresPassword ||
    (password === passwordConfirmation &&
      isAccountPasswordComplete(password) &&
      isAccountPasswordComplete(passwordConfirmation));
  const canSubmit = validUsername !== null && passwordComplete && !isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || !validUsername) {
      return;
    }

    if (requiresPassword) {
      const parsedPassword = validateAccountPassword(password);
      if (!parsedPassword.success || password !== passwordConfirmation) {
        setArePasswordFieldsInvalid(true);
        setError("Choose a valid matching password");
        return;
      }
    }

    setError(null);
    setArePasswordFieldsInvalid(false);
    setUnavailableUsername(null);
    setIsSubmitting(true);

    try {
      const result = await linkUsername({
        username: validUsername,
        ...(requiresPassword
          ? { password, passwordConfirmation }
          : {}),
      });
      onLinked(result);
    } catch (submitError) {
      if (submitError instanceof ApiRequestError && submitError.status === 401) {
        onSessionExpired();
        return;
      }

      if (submitError instanceof ApiRequestError && submitError.status === 409) {
        setUnavailableUsername(validUsername);
      }

      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to link username",
      );
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
        disabled={isSubmitting}
        aria-label="Go back"
      >
        <ChevronLeft aria-hidden="true" strokeWidth={1.8} />
      </ActionButton>

      <section
        className="auth-panel auth-register-panel username-link-panel"
        aria-labelledby="username-link-title"
      >
        <header className="auth-header auth-password-reset-header">
          <span className="auth-recovery-code-icon" aria-hidden="true">
            <AtSign strokeWidth={1.7} />
          </span>
          <div className="auth-message">
            <h1 id="username-link-title">Link a username</h1>
            <p className="auth-subtitle">
              {requiresPassword
                ? "Choose your username and create a password"
                : "Add another way to sign in"}
            </p>
          </div>
        </header>

        <form
          className="auth-login-form auth-register-form username-link-form"
          noValidate
          onSubmit={handleSubmit}
        >
          <UsernameAvailabilityField
            idPrefix="account-username-link"
            value={username}
            disabled={isSubmitting}
            serverUnavailableUsername={unavailableUsername}
            onChange={(value) => {
              setUsername(value);
              setUnavailableUsername(null);
              setError(null);
            }}
            onValidUsernameChange={setValidUsername}
          />

          {requiresPassword ? (
            <NewPasswordFields
              idPrefix="account-username-link"
              password={password}
              passwordConfirmation={passwordConfirmation}
              invalid={arePasswordFieldsInvalid}
              disabled={isSubmitting}
              errorId="account-username-link-error"
              onPasswordChange={(value) => {
                setPassword(value);
                setArePasswordFieldsInvalid(false);
                setError(null);
              }}
              onPasswordConfirmationChange={(value) => {
                setPasswordConfirmation(value);
                setArePasswordFieldsInvalid(false);
                setError(null);
              }}
              onError={(message) => {
                setError(message);
                if (!message) {
                  setArePasswordFieldsInvalid(false);
                }
              }}
            />
          ) : null}

          <p
            id="account-username-link-error"
            className="auth-field-message auth-field-message--error auth-register-error"
            role="alert"
            aria-live="polite"
          >
            {error ? formatErrorMessage(error) : "\u00a0"}
          </p>

          <ActionButton
            className="auth-primary-button auth-register-submit"
            type="submit"
            disabled={!canSubmit}
          >
            {isSubmitting ? "Linking" : "Continue"}
          </ActionButton>
        </form>
      </section>
    </main>
  );
}
