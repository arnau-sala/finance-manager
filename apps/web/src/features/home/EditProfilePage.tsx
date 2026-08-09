import { useLayoutEffect, useState, type FormEvent } from "react";
import { ChevronLeft, Pencil, TriangleAlert } from "lucide-react";

import { prefetchScheduler } from "../../cache/prefetch-scheduler";
import { ActionButton } from "../../components/ui/ActionButton";
import { formatErrorMessage } from "../../components/ui/error-message";
import {
  isEditableStartingNetWorth,
  parseStartingNetWorth,
  STARTING_NET_WORTH_ERROR,
} from "../../money/starting-net-worth-validation";
import {
  ApiRequestError,
  updateProfile,
  type SessionUser,
  type UpdateProfileInput,
} from "../auth/auth-api";
import { UsernameAvailabilityField } from "../auth/UsernameAvailabilityField";
import { revealTrailingCaret } from "../auth/AuthPasswordField";
import { validateUserName } from "../auth/user-name-validation";

type EditProfilePageProps = {
  open: boolean;
  user: SessionUser;
  onBack: () => void;
  onProfileUpdated: (user: SessionUser) => void;
  onSessionExpired: () => void;
};

const userNameMaxLength = 20;
const userNameCharacterCountRevealLength = 15;

function formatStartingNetWorthInput(value: string | null) {
  if (value === null) {
    return "0";
  }

  const amount = Number(value);
  return Number.isFinite(amount) ? String(amount).replace(".", ",") : "0";
}

export function EditProfilePage({
  open,
  user,
  onBack,
  onProfileUpdated,
  onSessionExpired,
}: EditProfilePageProps) {
  const [username, setUsername] = useState(user.username ?? "");
  const [validUsername, setValidUsername] = useState<string | null>(null);
  const [unavailableUsername, setUnavailableUsername] = useState<string | null>(
    null,
  );
  const [name, setName] = useState(user.name);
  const [startingNetWorth, setStartingNetWorth] = useState(
    formatStartingNetWorthInput(user.startingNetWorth),
  );
  const [hasNameBlurred, setHasNameBlurred] = useState(false);
  const [hasStartingNetWorthBlurred, setHasStartingNetWorthBlurred] =
    useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedUsername = username.trim().toLowerCase();
  const usernameChanged =
    user.username !== null && normalizedUsername !== user.username;
  const usernameIsValid =
    user.username === null || !usernameChanged || validUsername === normalizedUsername;
  const parsedName = validateUserName(name);
  const nameChanged = parsedName.success && parsedName.data !== user.name;
  const nameError =
    hasNameBlurred && !parsedName.success
      ? (parsedName.error.issues[0]?.message ?? "Enter a valid name")
      : null;
  const parsedStartingNetWorth = parseStartingNetWorth(startingNetWorth);
  const startingNetWorthChanged =
    parsedStartingNetWorth !== null &&
    Number(parsedStartingNetWorth) !== Number(user.startingNetWorth ?? 0);
  const startingNetWorthError =
    hasStartingNetWorthBlurred && parsedStartingNetWorth === null
      ? STARTING_NET_WORTH_ERROR
      : null;
  const canSubmit =
    usernameIsValid &&
    parsedName.success &&
    parsedStartingNetWorth !== null &&
    (usernameChanged || nameChanged || startingNetWorthChanged) &&
    !isSubmitting;

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    setUsername(user.username ?? "");
    setValidUsername(null);
    setUnavailableUsername(null);
    setName(user.name);
    setStartingNetWorth(formatStartingNetWorthInput(user.startingNetWorth));
    setHasNameBlurred(false);
    setHasStartingNetWorthBlurred(false);
    setError(null);
    setIsSubmitting(false);
  }, [open, user.name, user.startingNetWorth, user.username]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || parsedStartingNetWorth === null) {
      return;
    }

    const input: UpdateProfileInput = {};

    if (usernameChanged) {
      input.username = normalizedUsername;
    }

    if (nameChanged && parsedName.success) {
      input.name = parsedName.data;
    }

    if (startingNetWorthChanged) {
      input.startingNetWorth = parsedStartingNetWorth;
    }

    setError(null);
    setUnavailableUsername(null);
    setIsSubmitting(true);
    prefetchScheduler.prioritizeUserRequest();

    try {
      const updatedUser = await updateProfile(input);
      onProfileUpdated(updatedUser);
      onBack();
    } catch (submitError) {
      if (submitError instanceof ApiRequestError && submitError.status === 401) {
        onSessionExpired();
        return;
      }

      if (submitError instanceof ApiRequestError && submitError.status === 409) {
        setUnavailableUsername(normalizedUsername);
      }

      setError(
        submitError instanceof ApiRequestError && submitError.status === 429
          ? `Too many profile updates. Try again in ${
              submitError.retryAfter ?? "15 minutes"
            }`
          : submitError instanceof Error
            ? submitError.message
            : "Unable to update profile",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className={`account-flow-layer edit-profile-layer${
        open ? " is-open" : ""
      }`}
      aria-hidden={!open}
      inert={!open}
    >
      <section className="auth-screen auth-screen--login auth-screen--register">
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
          className="auth-panel auth-register-panel edit-profile-panel"
          aria-labelledby="edit-profile-title"
        >
          <header className="auth-header auth-password-reset-header">
            <span className="auth-recovery-code-icon" aria-hidden="true">
              <Pencil strokeWidth={1.7} />
            </span>
            <div className="auth-message">
              <h1 id="edit-profile-title">Edit profile</h1>
              <p className="auth-subtitle">
                Update the details shown in your account
              </p>
            </div>
          </header>

          <form
            className="auth-login-form auth-register-form edit-profile-form"
            noValidate
            onSubmit={handleSubmit}
          >
            {user.username ? (
              <UsernameAvailabilityField
                idPrefix="edit-profile-username"
                value={username}
                currentUsername={user.username}
                disabled={isSubmitting}
                serverUnavailableUsername={unavailableUsername}
                onChange={(value) => {
                  setUsername(value);
                  setUnavailableUsername(null);
                  setError(null);
                }}
                onValidUsernameChange={setValidUsername}
              />
            ) : null}

            <div className="auth-form-field">
              <div className="auth-register-field-heading">
                <span className="text-field-label" id="edit-profile-name-label">
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
                  {nameError ? (
                    <p
                      id="edit-profile-name-error"
                      className="auth-register-field-error"
                      role="alert"
                      aria-live="polite"
                    >
                      <TriangleAlert aria-hidden="true" strokeWidth={1.8} />
                      <span>{formatErrorMessage(nameError)}</span>
                    </p>
                  ) : null}
                </span>
              </div>
              <input
                id="edit-profile-name"
                className="text-field"
                aria-labelledby="edit-profile-name-label"
                type="text"
                autoComplete="name"
                placeholder="Enter your name"
                value={name}
                maxLength={userNameMaxLength}
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? "edit-profile-name-error" : undefined}
                disabled={isSubmitting}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(null);
                }}
                onFocus={(event) => {
                  setHasNameBlurred(false);
                  revealTrailingCaret(event.currentTarget);
                }}
                onClick={(event) => revealTrailingCaret(event.currentTarget)}
                onBlur={() => setHasNameBlurred(true)}
              />
            </div>

            <div className="auth-form-field">
              <div className="auth-register-field-heading">
                <span
                  className="text-field-label"
                  id="edit-profile-starting-net-worth-label"
                >
                  Starting net worth
                </span>
                {startingNetWorthError ? (
                  <p
                    id="edit-profile-starting-net-worth-error"
                    className="auth-register-field-error"
                    role="alert"
                    aria-live="polite"
                  >
                    <TriangleAlert aria-hidden="true" strokeWidth={1.8} />
                    <span>{formatErrorMessage(startingNetWorthError)}</span>
                  </p>
                ) : null}
              </div>
              <div className="auth-input-with-action edit-profile-money-field">
                <input
                  id="edit-profile-starting-net-worth"
                  className="text-field edit-profile-money-field__input"
                  aria-labelledby="edit-profile-starting-net-worth-label"
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  autoComplete="off"
                  placeholder="0"
                  value={startingNetWorth}
                  maxLength={12}
                  aria-invalid={Boolean(startingNetWorthError)}
                  aria-describedby={
                    startingNetWorthError
                      ? "edit-profile-starting-net-worth-error"
                      : undefined
                  }
                  disabled={isSubmitting}
                  onChange={(event) => {
                    const nextValue = event.target.value;

                    if (isEditableStartingNetWorth(nextValue)) {
                      setStartingNetWorth(nextValue);
                      setError(null);
                    }
                  }}
                  onFocus={(event) => {
                    setHasStartingNetWorthBlurred(false);
                    revealTrailingCaret(event.currentTarget);
                  }}
                  onClick={(event) => revealTrailingCaret(event.currentTarget)}
                onBlur={() => {
                  if (startingNetWorth.trim().length === 0) {
                    setStartingNetWorth("0");
                  }

                  setHasStartingNetWorthBlurred(true);
                }}
              />
                <span className="edit-profile-money-field__currency" aria-hidden="true">
                  €
                </span>
              </div>
            </div>

            <p
              id="edit-profile-error"
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
              {isSubmitting ? "Saving..." : "Save changes"}
            </ActionButton>
          </form>
        </section>
      </section>
    </div>
  );
}
