import { useEffect, useState } from "react";

import { GoogleIcon } from "../../components/brand/GoogleIcon";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import type { GoogleAuthAction } from "./google-auth-api";
import { LegalAcceptanceCheckbox } from "./LegalAcceptanceCheckbox";
import { LegalNoticeScreen } from "./LegalNoticeScreen";

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
      description: `No account is linked to ${action.email}\nCreate one with Google?`,
      confirmLabel: "Create account",
      confirmingLabel: "Creating"
    };
  }

  if (action.action === "sign-in-with-google") {
    return {
      title: "Account already exists",
      description: `${action.email} is already linked with Google`,
      confirmLabel: "Sign in",
      confirmingLabel: "Signing in"
    };
  }

  return {
    title: "Use your password",
    description: `${action.email} already has an account, but Google is not linked`,
    confirmLabel: "Sign in with password",
    confirmingLabel: "Opening"
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
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false);
  const [isLegalScreenOpen, setIsLegalScreenOpen] = useState(false);
  const [isLegalScreenClosing, setIsLegalScreenClosing] = useState(false);

  useEffect(() => {
    setHasAcceptedLegal(false);
    setIsLegalScreenOpen(false);
    setIsLegalScreenClosing(false);
  }, [action?.email, action?.action]);

  if (!action) {
    return null;
  }

  const content = getDialogContent(action);
  const createsAccount = action.action === "create-account";

  function openLegalScreen() {
    setIsLegalScreenClosing(false);
    setIsLegalScreenOpen(true);
  }

  function closeLegalScreen() {
    setIsLegalScreenClosing(true);
  }

  return (
    <>
      <ConfirmDialog
        open
        title={content.title}
        description={content.description}
        confirmLabel={content.confirmLabel}
        confirmingLabel={content.confirmingLabel}
        icon={<GoogleIcon />}
        isConfirming={isConfirming}
        interactionLocked={isCancelling}
        confirmDisabled={createsAccount && !hasAcceptedLegal}
        error={error}
        onCancel={onCancel}
        onConfirm={onConfirm}
      >
        {createsAccount ? (
          <LegalAcceptanceCheckbox
            id="google-action-legal-acceptance"
            checked={hasAcceptedLegal}
            onChange={setHasAcceptedLegal}
            onOpenLegal={openLegalScreen}
          />
        ) : null}
      </ConfirmDialog>

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
    </>
  );
}
