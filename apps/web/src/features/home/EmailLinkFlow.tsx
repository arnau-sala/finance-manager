import { useLayoutEffect, useRef, useState } from "react";

import {
  ApiRequestError,
  beginEmailLink,
  cancelEmailLink,
  resendEmailLinkCode,
  type SessionUser,
  verifyEmailLinkCode
} from "../auth/auth-api";
import { EmailVerificationPage } from "../auth/EmailVerificationPage";
import { EmailLinkEmailPage } from "./EmailLinkEmailPage";
import { EmailLinkIntroPage } from "./EmailLinkIntroPage";
import { EmailLinkPasswordPage } from "./EmailLinkPasswordPage";
import { EmailLinkSuccessPage } from "./EmailLinkSuccessPage";

type EmailLinkStageType = "email" | "intro" | "password" | "code" | "success";

type EmailLinkStage = {
  id: number;
  type: EmailLinkStageType;
};

type EmailLinkFlowProps = {
  open: boolean;
  user: SessionUser;
  onProfileUpdated: (user: SessionUser) => void;
  onClose: () => void;
  onSessionExpired: () => void;
};

const stageTransitionMs = 460;

function getInitialStageType(user: SessionUser): EmailLinkStageType {
  return user.email ? "intro" : "email";
}

export function EmailLinkFlow({
  open,
  user,
  onProfileUpdated,
  onClose,
  onSessionExpired
}: EmailLinkFlowProps) {
  const nextStageIdRef = useRef(1);
  const leaveTimerRef = useRef<number | null>(null);
  const [stages, setStages] = useState<EmailLinkStage[]>([
    { id: 0, type: getInitialStageType(user) }
  ]);
  const [leavingStageId, setLeavingStageId] = useState<number | null>(null);
  const [targetEmail, setTargetEmail] = useState(user.email ?? "");
  const [linkedUser, setLinkedUser] = useState<SessionUser | null>(null);
  const requiresPassword = user.authProvider === "GOOGLE";

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }

    nextStageIdRef.current = 1;
    setStages([{ id: 0, type: getInitialStageType(user) }]);
    setLeavingStageId(null);
    setTargetEmail(user.email ?? "");
    setLinkedUser(null);
    return () => {
      if (leaveTimerRef.current !== null) {
        window.clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = null;
      }
    };
  }, [open]);

  function handleRequestError(error: unknown) {
    if (error instanceof ApiRequestError && error.status === 401) {
      onSessionExpired();
    }

    throw error;
  }

  function pushStage(type: EmailLinkStageType) {
    if (leavingStageId !== null) {
      return;
    }

    const nextStage = { id: nextStageIdRef.current, type };
    nextStageIdRef.current += 1;
    setStages((current) => [...current, nextStage]);
  }

  function leaveFlow() {
    void cancelEmailLink().catch(() => undefined);
    onClose();
  }

  function popStage() {
    if (leavingStageId !== null) {
      return;
    }

    if (stages.length <= 1) {
      leaveFlow();
      return;
    }

    const topStage = stages[stages.length - 1];
    setLeavingStageId(topStage.id);
    leaveTimerRef.current = window.setTimeout(() => {
      setStages((current) => current.slice(0, -1));
      setLeavingStageId(null);
      leaveTimerRef.current = null;
    }, stageTransitionMs);
  }

  async function prepareEmailLink(input: {
    email?: string;
    password?: string;
    passwordConfirmation?: string;
  }) {
    try {
      await beginEmailLink(input);
    } catch (error) {
      handleRequestError(error);
    }
  }

  async function verifyCode(code: string) {
    try {
      const updatedUser = await verifyEmailLinkCode(code);
      setLinkedUser(updatedUser);
      onProfileUpdated(updatedUser);
      pushStage("success");
    } catch (error) {
      handleRequestError(error);
    }
  }

  async function resendCode() {
    try {
      await resendEmailLinkCode();
    } catch (error) {
      handleRequestError(error);
    }
  }

  function renderStage(stage: EmailLinkStage) {
    if (stage.type === "email") {
      return (
        <EmailLinkEmailPage
          onBack={popStage}
          onSubmit={async (email) => {
            await prepareEmailLink({ email });
            setTargetEmail(email);
            pushStage("code");
          }}
        />
      );
    }

    if (stage.type === "intro") {
      return (
        <EmailLinkIntroPage
          email={targetEmail}
          requiresPassword={requiresPassword}
          onBack={popStage}
          onContinue={async () => {
            if (requiresPassword) {
              pushStage("password");
              return;
            }

            await prepareEmailLink({});
            pushStage("code");
          }}
        />
      );
    }

    if (stage.type === "password") {
      return (
        <EmailLinkPasswordPage
          email={targetEmail}
          onBack={popStage}
          onSubmit={async (password, passwordConfirmation) => {
            await prepareEmailLink({ password, passwordConfirmation });
            pushStage("code");
          }}
        />
      );
    }

    if (stage.type === "code") {
      return (
        <EmailVerificationPage
          email={targetEmail}
          idPrefix="account-email-link"
          title="Verify your email"
          verifyLabel="Link email"
          verifyingLabel="Linking..."
          onBack={popStage}
          onVerifyCode={verifyCode}
          onResendCode={resendCode}
        />
      );
    }

    return linkedUser ? (
      <EmailLinkSuccessPage user={linkedUser} onDone={onClose} />
    ) : null;
  }

  const topStageId = stages[stages.length - 1]?.id;

  return (
    <div
      className={`account-flow-layer email-link-flow-layer${
        open ? " is-open" : ""
      }`}
      aria-hidden={!open}
      inert={!open}
    >
      {stages.map((stage, index) => {
        const isTopStage = stage.id === topStageId;
        const isLeaving = stage.id === leavingStageId;

        return (
          <div
            key={stage.id}
            className={`email-link-stage${
              index > 0 ? " is-entering" : ""
            }${isLeaving ? " is-leaving" : ""}`}
            style={{ zIndex: index + 1 }}
            aria-hidden={!isTopStage}
            inert={!isTopStage}
          >
            {renderStage(stage)}
          </div>
        );
      })}
    </div>
  );
}
