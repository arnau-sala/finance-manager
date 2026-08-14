import { useLayoutEffect, useState } from "react";
import { Check, ChevronLeft } from "lucide-react";

import { prefetchScheduler } from "../../cache/prefetch-scheduler";
import { ActionButton } from "../../components/ui/ActionButton";
import { formatErrorMessage } from "../../components/ui/error-message";
import {
  ApiRequestError,
  changePassword
} from "../auth/auth-api";
import { AuthPasswordField } from "../auth/AuthPasswordField";
import {
  isClipboardReadCancelled,
  readTextFromClipboard
} from "../auth/clipboard";
import { NewPasswordFields } from "../auth/NewPasswordFields";
import { isAccountPasswordComplete } from "../auth/password-assistance";
import { validateAccountPassword } from "../auth/password-validation";

type ChangePasswordPageProps = {
  open: boolean;
  onBack: () => void;
};

type ChangePasswordPageMode = "form" | "success";

export function ChangePasswordPage({
  open,
  onBack
}: ChangePasswordPageProps) {
  const [mode, setMode] = useState<ChangePasswordPageMode>("form");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const fieldsFilled =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    newPasswordConfirmation.length > 0;

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    setMode("form");
    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirmation("");
    setError(null);
    setIsSubmitting(false);
    setFormVersion((version) => version + 1);
  }, [open]);

  async function handlePasteCurrentPassword() {
    try {
      const pastedPassword = await readTextFromClipboard();
      setCurrentPassword(pastedPassword.slice(0, 128));
      setError(null);
    } catch (clipboardError) {
      if (isClipboardReadCancelled(clipboardError)) {
        return;
      }

      setError("Unable to read the clipboard");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting || !fieldsFilled) {
      return;
    }

    if (currentPassword.length > 128) {
      setError("Incorrect current password");
      return;
    }

    const parsedNewPassword = validateAccountPassword(newPassword);

    if (!parsedNewPassword.success) {
      setError(
        parsedNewPassword.error.issues[0]?.message ??
          "Enter a valid new password"
      );
      return;
    }

    if (
      !isAccountPasswordComplete(newPasswordConfirmation) ||
      parsedNewPassword.data !== newPasswordConfirmation
    ) {
      setError("New passwords do not match");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    prefetchScheduler.prioritizeUserRequest();

    try {
      await changePassword({
        currentPassword,
        newPassword: parsedNewPassword.data,
        newPasswordConfirmation
      });
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirmation("");
      setMode("success");
    } catch (submitError) {
      if (submitError instanceof ApiRequestError && submitError.status === 429) {
        setError(
          `Too many password changes\nTry again in ${
            submitError.retryAfter ?? "15 minutes"
          }`
        );
      } else {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Unable to change password"
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className={`account-flow-layer change-password-layer${
        open ? " is-open" : ""
      }`}
      aria-hidden={!open}
      inert={!open}
    >
      <section className="auth-screen auth-screen--login auth-screen--password-reset">
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
          className="auth-panel auth-password-reset-panel"
          aria-labelledby="account-password-title"
        >
          <header className="auth-header auth-password-reset-header">
            {mode === "success" ? (
              <span
                className="auth-recovery-code-icon success-check-icon"
                aria-hidden="true"
              >
                <Check strokeWidth={1.7} />
              </span>
            ) : (
              <div
                className="auth-logo auth-logo--verification"
                aria-hidden="true"
              >
                <img draggable={false}
                  src="/icons/app-icon-512.png"
                  width={512}
                  height={512}
                  alt=""
                  decoding="sync"
                />
              </div>
            )}

            <div className="auth-message">
              <h1 id="account-password-title">
                {mode === "success"
                  ? "Password changed"
                  : "Change your password"}
              </h1>
              <p className="auth-subtitle">
                {mode === "success"
                  ? "Your password has been updated successfully"
                  : "All existing sessions will be signed out"}
              </p>
            </div>
          </header>

          {mode === "form" ? (
            <form
              className="auth-login-form auth-register-form"
              noValidate
              onSubmit={handleSubmit}
            >
              <AuthPasswordField
                id="account-current-password"
                label="Current password"
                name="currentPassword"
                placeholder="Enter your current password"
                value={currentPassword}
                invalid={error !== null}
                autoComplete="off"
                describedBy="account-password-error"
                disabled={isSubmitting}
                characterStatuses={Array.from(
                  { length: currentPassword.length },
                  () => "match" as const
                )}
                pasteAction={{
                  label: "Paste current password",
                  disabled: isSubmitting,
                  onPaste: () => void handlePasteCurrentPassword()
                }}
                onChange={(value) => {
                  setCurrentPassword(value);
                  setError(null);
                }}
              />

              <NewPasswordFields
                key={formVersion}
                idPrefix="account-new-password"
                password={newPassword}
                passwordConfirmation={newPasswordConfirmation}
                invalid={error !== null}
                disabled={isSubmitting}
                errorId="account-password-error"
                onPasswordChange={setNewPassword}
                onPasswordConfirmationChange={setNewPasswordConfirmation}
                onError={setError}
              />

              <p
                id="account-password-error"
                className="auth-field-message auth-field-message--error auth-register-error"
                role="alert"
                aria-live="polite"
              >
                {error ? formatErrorMessage(error) : "\u00a0"}
              </p>

              <ActionButton
                className="auth-primary-button auth-register-submit"
                type="submit"
                disabled={!fieldsFilled || isSubmitting}
              >
                {isSubmitting ? "Updating" : "Change password"}
              </ActionButton>
            </form>
          ) : (
            <ActionButton
              className="auth-primary-button change-password-success-button"
              type="button"
              onClick={onBack}
            >
              Done
            </ActionButton>
          )}
        </section>
      </section>
    </div>
  );
}
