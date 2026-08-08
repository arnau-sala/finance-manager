import { useLayoutEffect, useState } from "react";

import { RecoveryCodePage } from "../auth/RecoveryCodePage";
import type { SessionUser, UsernameLinkResult } from "../auth/auth-api";
import { UsernameLinkPage } from "./UsernameLinkPage";

type UsernameLinkFlowProps = {
  open: boolean;
  user: SessionUser;
  onProfileUpdated: (user: SessionUser) => void;
  onClose: () => void;
  onSessionExpired: () => void;
};

export function UsernameLinkFlow({
  open,
  user,
  onProfileUpdated,
  onClose,
  onSessionExpired,
}: UsernameLinkFlowProps) {
  const [result, setResult] = useState<UsernameLinkResult | null>(null);
  const [isCodeEntering, setIsCodeEntering] = useState(false);
  const requiresPassword = user.authProvider === "GOOGLE";

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    setResult(null);
    setIsCodeEntering(false);
  }, [open]);

  return (
    <div
      className={`account-flow-layer username-link-flow-layer${
        open ? " is-open" : ""
      }`}
      aria-hidden={!open}
      inert={!open}
    >
      <div
        className="email-link-stage"
        aria-hidden={result !== null}
        inert={result !== null}
      >
        <UsernameLinkPage
          requiresPassword={requiresPassword}
          onBack={onClose}
          onSessionExpired={onSessionExpired}
          onLinked={(linkedResult) => {
            setResult(linkedResult);
            onProfileUpdated(linkedResult.user);
            setIsCodeEntering(true);
          }}
        />
      </div>

      {result ? (
        <div
          className={`email-link-stage${isCodeEntering ? " is-entering" : ""}`}
          style={{ zIndex: 2 }}
        >
          <RecoveryCodePage
            username={result.user.username!}
            recoveryCode={result.recoveryCode}
            context="username-link"
            onContinue={onClose}
          />
        </div>
      ) : null}
    </div>
  );
}
