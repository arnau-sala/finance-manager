import { type ReactNode, useEffect, useState } from "react";

import { EmailVerificationPage } from "./EmailVerificationPage";
import {
  cancelPasswordReset,
  resendPasswordResetEmail,
  verifyPasswordResetEmailCode
} from "./password-recovery-api";
import { PasswordRecoveryCodePage } from "./PasswordRecoveryCodePage";
import { RecoveryCodePage } from "./RecoveryCodePage";
import {
  PasswordResetPage,
  type PasswordResetResult
} from "./PasswordResetPage";

export type PasswordRecoveryStart =
  | { method: "email"; identifier: string }
  | { method: "recovery-code"; username: string | null };

type PasswordRecoveryStage =
  | { type: "email-code"; email: string }
  | { type: "recovery-code"; username: string | null }
  | {
      type: "new-password";
      method: "email" | "recovery-code";
      identifier: string;
      username: string | null;
    }
  | { type: "replacement-code"; username: string; recoveryCode: string };

type StoredPasswordRecovery = {
  expiresAt: number;
  stage: Exclude<PasswordRecoveryStage, { type: "replacement-code" }>;
};

const storageKey = "finance-manager-password-recovery";
const storedFlowTtlMs = 10 * 60 * 1_000;

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isStoredRecoveryStage(
  value: unknown
): value is StoredPasswordRecovery["stage"] {
  if (!value || typeof value !== "object" || !("type" in value)) {
    return false;
  }

  if (value.type === "email-code") {
    return "email" in value && typeof value.email === "string";
  }

  if (value.type === "recovery-code") {
    return "username" in value && isNullableString(value.username);
  }

  return (
    value.type === "new-password" &&
    "method" in value &&
    (value.method === "email" || value.method === "recovery-code") &&
    "identifier" in value &&
    typeof value.identifier === "string" &&
    "username" in value &&
    isNullableString(value.username)
  );
}

function readStoredPasswordRecovery() {
  try {
    const raw = window.sessionStorage.getItem(storageKey);

    if (!raw) {
      return null;
    }

    const stored = JSON.parse(raw) as Partial<StoredPasswordRecovery>;

    if (
      typeof stored.expiresAt !== "number" ||
      stored.expiresAt <= Date.now() ||
      !isStoredRecoveryStage(stored.stage)
    ) {
      window.sessionStorage.removeItem(storageKey);
      return null;
    }

    return stored.stage;
  } catch {
    window.sessionStorage.removeItem(storageKey);
    return null;
  }
}

function writeStoredPasswordRecovery(stage: PasswordRecoveryStage) {
  if (stage.type === "replacement-code") {
    window.sessionStorage.removeItem(storageKey);
    return;
  }

  const stored: StoredPasswordRecovery = {
    stage,
    expiresAt: Date.now() + storedFlowTtlMs
  };
  window.sessionStorage.setItem(storageKey, JSON.stringify(stored));
}

export function hasStoredPasswordRecovery() {
  return readStoredPasswordRecovery() !== null;
}

export function clearStoredPasswordRecovery() {
  window.sessionStorage.removeItem(storageKey);
}

function stageFromStart(start: PasswordRecoveryStart | null) {
  if (!start) {
    return readStoredPasswordRecovery();
  }

  return start.method === "email"
    ? ({ type: "email-code", email: start.identifier } as const)
    : ({ type: "recovery-code", username: start.username } as const);
}

type PasswordRecoveryFlowProps = {
  start: PasswordRecoveryStart | null;
  returnTarget: "landing" | "login";
  onReturnToLanding: () => void;
  onReturnToLogin: (identifier: string) => void;
};

export function PasswordRecoveryFlow({
  start,
  returnTarget,
  onReturnToLanding,
  onReturnToLogin
}: PasswordRecoveryFlowProps) {
  const [stage, setStage] = useState<PasswordRecoveryStage | null>(() =>
    stageFromStart(start)
  );
  const [stageTransitionVersion, setStageTransitionVersion] = useState(0);

  useEffect(() => {
    if (stage) {
      writeStoredPasswordRecovery(stage);
    }
  }, [stage]);

  function leaveRecovery(identifier: string) {
    clearStoredPasswordRecovery();
    void cancelPasswordReset().catch(() => undefined);
    onReturnToLogin(identifier);
  }

  function leaveRecoveryToLanding() {
    clearStoredPasswordRecovery();
    void cancelPasswordReset().catch(() => undefined);
    onReturnToLanding();
  }

  function showNextStage(nextStage: PasswordRecoveryStage) {
    setStage(nextStage);
    setStageTransitionVersion((version) => version + 1);
  }

  function handlePasswordResetComplete(result: PasswordResetResult) {
    if (result.recoveryCode && result.username) {
      showNextStage({
        type: "replacement-code",
        username: result.username,
        recoveryCode: result.recoveryCode
      });
      return;
    }

    const identifier =
      result.username ??
      (stage?.type === "new-password" ? stage.identifier : "");
    clearStoredPasswordRecovery();
    onReturnToLogin(identifier);
  }

  if (!stage) {
    return null;
  }

  const currentStage = stage;

  function renderStage(content: ReactNode) {
    return (
      <div
        key={`${currentStage.type}:${stageTransitionVersion}`}
        className={`password-recovery-stage${
          stageTransitionVersion > 0 ? " is-entering" : ""
        }`}
      >
        {content}
      </div>
    );
  }

  if (currentStage.type === "email-code") {
    return renderStage(
      <EmailVerificationPage
        email={currentStage.email}
        idPrefix="password-reset-verification"
        title="Check your email"
        verifyLabel="Continue"
        onBack={() => leaveRecovery(currentStage.email)}
        onResendCode={async () => {
          await resendPasswordResetEmail(currentStage.email);
        }}
        onVerifyCode={async (code) => {
          await verifyPasswordResetEmailCode(currentStage.email, code);
          showNextStage({
            type: "new-password",
            method: "email",
            identifier: currentStage.email,
            username: null
          });
        }}
      />
    );
  }

  if (currentStage.type === "recovery-code") {
    return renderStage(
      <PasswordRecoveryCodePage
        username={currentStage.username}
        onBack={() => {
          if (currentStage.username === null && returnTarget === "landing") {
            leaveRecoveryToLanding();
            return;
          }

          leaveRecovery(currentStage.username ?? "");
        }}
        onVerified={(username) => {
          showNextStage({
            type: "new-password",
            method: "recovery-code",
            identifier: username,
            username
          });
        }}
      />
    );
  }

  if (currentStage.type === "new-password") {
    return renderStage(
      <PasswordResetPage
        onBack={() => leaveRecovery(currentStage.identifier)}
        onComplete={handlePasswordResetComplete}
      />
    );
  }

  return renderStage(
    <RecoveryCodePage
      username={currentStage.username}
      recoveryCode={currentStage.recoveryCode}
      context="password-reset"
      onContinue={() => leaveRecovery(currentStage.username)}
    />
  );
}
