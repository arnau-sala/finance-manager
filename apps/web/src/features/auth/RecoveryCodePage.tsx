import { useEffect, useRef, useState } from "react";
import { Check, Copy, KeyRound, ShieldCheck } from "lucide-react";

import { formatErrorMessage } from "../../components/ui/error-message";
type RecoveryCodePageProps = {
  username: string;
  recoveryCode: string;
  onContinue: () => void | Promise<void>;
};

type RecoveryCodeFeedback = {
  message: string;
  tone: "error" | "warning";
};

const continueDelayMs = 3_000;
const readCarefullyMessage =
  "Read this information carefully and save your recovery code";

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.append(textArea);
  textArea.select();

  const copied = document.execCommand("copy");
  textArea.remove();

  if (!copied) {
    throw new Error("Clipboard access is unavailable");
  }
}

export function RecoveryCodePage({
  username,
  recoveryCode,
  onContinue
}: RecoveryCodePageProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [isContinueReady, setIsContinueReady] = useState(false);
  const [feedback, setFeedback] = useState<RecoveryCodeFeedback | null>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const recoveryCodeGroups = recoveryCode.split("-");

  useEffect(() => {
    const continueTimer = window.setTimeout(() => {
      setIsContinueReady(true);
      setFeedback((current) =>
        current?.tone === "warning" ? null : current
      );
    }, continueDelayMs);

    return () => {
      window.clearTimeout(continueTimer);

      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    try {
      await copyText(recoveryCode.replace(/[\s-]/g, ""));
      setFeedback(null);
      setIsCopied(true);

      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }

      copyFeedbackTimerRef.current = window.setTimeout(() => {
        setIsCopied(false);
        copyFeedbackTimerRef.current = null;
      }, 1600);
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
          ? error.message
          : "Unable to copy the recovery code",
        tone: "error"
      });
    }
  }

  async function handleContinue() {
    if (isContinuing) {
      return;
    }

    if (!isContinueReady) {
      setFeedback({ message: readCarefullyMessage, tone: "warning" });
      return;
    }

    setFeedback(null);
    setIsContinuing(true);

    try {
      await onContinue();
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
          ? error.message
          : "Unable to open your account. Please try again",
        tone: "error"
      });
      setIsContinuing(false);
    }
  }

  return (
    <main className="auth-screen auth-screen--recovery-code">
      <section
        className="auth-panel auth-recovery-code-panel"
        aria-labelledby="recovery-code-title"
      >
        <header className="auth-recovery-code-header">
          <span className="auth-recovery-code-icon" aria-hidden="true">
            <ShieldCheck strokeWidth={1.7} />
          </span>
          <div className="auth-message">
            <p className="auth-recovery-code-eyebrow">@{username}</p>
            <h1 id="recovery-code-title">Save your recovery code</h1>
            <p className="auth-subtitle auth-recovery-code-subtitle">
              Use this code to recover your account if you forget your
              password
            </p>
          </div>
        </header>

        <div className="auth-recovery-code-card">
          <div className="auth-recovery-code-card__heading">
            <span>
              <KeyRound aria-hidden="true" strokeWidth={1.8} />
              Recovery code
            </span>
            <span>Shown once</span>
          </div>

          <p className="auth-recovery-code-value" aria-label={recoveryCode}>
            {recoveryCodeGroups.map((group, index) => (
              <span key={`${group}-${index}`}>{group}</span>
            ))}
          </p>

          <button
            className={`auth-recovery-code-copy${
              isCopied ? " is-copied" : ""
            }`}
            type="button"
            onClick={handleCopy}
          >
            {isCopied ? (
              <Check aria-hidden="true" strokeWidth={2} />
            ) : (
              <Copy aria-hidden="true" strokeWidth={1.8} />
            )}
            {isCopied ? "Copied" : "Copy code"}
          </button>
        </div>

        <div className="auth-recovery-code-notice">
          <strong>Keep it somewhere safe</strong>
          <span>
            It cannot be shown again
            <br />
            Anyone with this code could reset your password
          </span>
        </div>

        <div className="auth-recovery-code-action">
          <button
            className={`auth-primary-button auth-recovery-code-continue${
              isContinueReady ? "" : " is-waiting"
            }`}
            type="button"
            disabled={isContinuing}
            aria-disabled={!isContinueReady || isContinuing}
            onClick={handleContinue}
          >
            {isContinuing ? "Opening account..." : "Continue"}
          </button>

          <p
            className={`auth-field-message auth-recovery-code-feedback${
              feedback ? ` is-${feedback.tone}` : ""
            }`}
            role={feedback?.tone === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {feedback?.tone === "error"
              ? formatErrorMessage(feedback.message)
              : (feedback?.message ?? "\u00a0")}
          </p>
        </div>
      </section>
    </main>
  );
}
