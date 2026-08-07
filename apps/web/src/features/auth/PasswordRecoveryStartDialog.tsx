import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";

import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { requestPasswordResetEmail } from "./password-recovery-api";
import { validateLoginIdentifier } from "./login-identifier-validation";

type PasswordRecoveryStartDialogProps = {
  open: boolean;
  initialIdentifier: string;
  onCancel: () => void;
  onEmailSelected: (email: string) => void;
  onRecoveryCodeSelected: (username: string | null) => void;
};

export function PasswordRecoveryStartDialog({
  open,
  initialIdentifier,
  onCancel,
  onEmailSelected,
  onRecoveryCodeSelected
}: PasswordRecoveryStartDialogProps) {
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setIdentifier(initialIdentifier);
    setError(null);
    setIsSubmitting(false);
  }, [initialIdentifier, open]);

  async function handleContinue() {
    if (isSubmitting) {
      return;
    }

    const validation = validateLoginIdentifier(identifier);

    if (!validation.success) {
      setError(validation.message);
      return;
    }

    setError(null);

    if (!validation.data.includes("@")) {
      onRecoveryCodeSelected(validation.data);
      return;
    }

    setIsSubmitting(true);

    try {
      await requestPasswordResetEmail(validation.data);
      onEmailSelected(validation.data);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to start account recovery. Please try again"
      );
      setIsSubmitting(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      title="Recover your account"
      description="Enter your email or username"
      confirmLabel="Continue"
      confirmingLabel="Checking..."
      icon={<KeyRound />}
      isConfirming={isSubmitting}
      error={error}
      confirmDisabled={identifier.trim().length === 0}
      onCancel={onCancel}
      onConfirm={handleContinue}
    >
      <form
        className="confirm-dialog__form password-recovery-start-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleContinue();
        }}
      >
        <div className="confirm-dialog__field">
          <label
            className="text-field-label"
            htmlFor="password-recovery-identifier"
          >
            Email or username
          </label>
          <input
            id="password-recovery-identifier"
            className="text-field text-field--dialog"
            name="username"
            type="text"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={identifier}
            aria-invalid={error !== null}
            onChange={(event) => {
              setIdentifier(event.target.value);
              setError(null);
            }}
          />
        </div>

        <button
          className="password-recovery-forgot-username"
          type="button"
          onClick={() => onRecoveryCodeSelected(null)}
        >
          Forgot your username?
        </button>
      </form>
    </ConfirmDialog>
  );
}
