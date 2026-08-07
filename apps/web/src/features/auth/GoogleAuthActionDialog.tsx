import { GoogleIcon } from "../../components/brand/GoogleIcon";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import type { GoogleAuthAction } from "./google-auth-api";

type GoogleAuthActionDialogProps = {
  action: GoogleAuthAction | null;
  isConfirming: boolean;
  isCancelling: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

function getDialogContent(action: GoogleAuthAction) {
  if (action.action === "create-account") {
    return {
      title: "No account found",
      description: `No account is linked to ${action.email}. Create one with Google?`,
      confirmLabel: "Create account",
      confirmingLabel: "Creating..."
    };
  }

  if (action.action === "sign-in-with-google") {
    return {
      title: "Account already exists",
      description: `${action.email} is already linked with Google`,
      confirmLabel: "Sign in",
      confirmingLabel: "Signing in..."
    };
  }

  return {
    title: "Use your password",
    description: `${action.email} already has an account, but Google is not linked`,
    confirmLabel: "Sign in with password",
    confirmingLabel: "Opening..."
  };
}

export function GoogleAuthActionDialog({
  action,
  isConfirming,
  isCancelling,
  error,
  onCancel,
  onConfirm
}: GoogleAuthActionDialogProps) {
  if (!action) {
    return null;
  }

  const content = getDialogContent(action);

  return (
    <ConfirmDialog
      open
      title={content.title}
      description={content.description}
      confirmLabel={content.confirmLabel}
      confirmingLabel={content.confirmingLabel}
      icon={<GoogleIcon />}
      initialFocus="dialog"
      isConfirming={isConfirming}
      interactionLocked={isCancelling}
      error={error}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
