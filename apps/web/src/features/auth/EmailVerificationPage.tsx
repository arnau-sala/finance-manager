import { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";

import { formatErrorMessage } from "../../components/ui/error-message";

type EmailVerificationPageProps = {
  email: string;
  idPrefix?: string;
  title: string;
  verifyLabel: string;
  verifyingLabel?: string;
  onBack: () => void;
  onVerifyCode: (code: string) => void | Promise<void>;
  onResendCode: () => void | Promise<void>;
};

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_MS = 60_000;

function sanitizeCode(value: string) {
  return value.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function EmailVerificationPage({
  email,
  idPrefix = "email-verification",
  title,
  verifyLabel,
  verifyingLabel = "Verifying...",
  onBack,
  onVerifyCode,
  onResendCode
}: EmailVerificationPageProps) {
  const [code, setCode] = useState("");
  const [isCodeFocused, setIsCodeFocused] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(
    () => Date.now() + RESEND_COOLDOWN_MS
  );
  const [now, setNow] = useState(() => Date.now());
  const codeInputRef = useRef<HTMLInputElement>(null);
  const titleId = `${idPrefix}-title`;
  const codeInputId = `${idPrefix}-code`;
  const feedbackId = `${idPrefix}-feedback`;
  const remainingSeconds = Math.max(
    0,
    Math.ceil((resendAvailableAt - now) / 1_000)
  );

  useEffect(() => {
    if (remainingSeconds === 0) {
      return;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [remainingSeconds]);

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isVerifying || code.length !== CODE_LENGTH) {
      return;
    }

    setFormError(null);
    setStatusMessage(null);
    setIsVerifying(true);

    try {
      await onVerifyCode(code);
    } catch (error) {
      setCode("");
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to verify the code. Please try again"
      );
      window.requestAnimationFrame(() => {
        codeInputRef.current?.focus({ preventScroll: true });
      });
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    if (isResending || remainingSeconds > 0) {
      return;
    }

    setFormError(null);
    setStatusMessage(null);
    setIsResending(true);

    try {
      await onResendCode();
      setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
      setNow(Date.now());
      setStatusMessage("A new code has been sent");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to resend the code. Please try again"
      );
    } finally {
      setIsResending(false);
    }
  }

  return (
    <main className="auth-screen auth-screen--login auth-screen--verification">
      <button
        className="auth-back-button"
        type="button"
        onClick={onBack}
        aria-label="Go back"
      >
        <ChevronLeft aria-hidden="true" strokeWidth={1.8} />
      </button>

      <section
        className="auth-panel auth-verification-panel"
        aria-labelledby={titleId}
      >
        <header className="auth-header auth-verification-header">
          <div className="auth-logo auth-logo--verification" aria-hidden="true">
            <img
              src="/icons/app-icon-512.png"
              width={512}
              height={512}
              alt=""
              decoding="sync"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
            <span>FM</span>
          </div>

          <div className="auth-message">
            <h1 id={titleId}>{title}</h1>
            <p className="auth-subtitle auth-verification-subtitle">
              Enter the 6-digit code sent to
              <strong>{email}</strong>
            </p>
          </div>
        </header>

        <form className="auth-verification-form" noValidate onSubmit={handleVerify}>
          <label className="sr-only" htmlFor={codeInputId}>
            Verification code
          </label>
          <div
            className={`auth-verification-code${
              isCodeFocused ? " is-focused" : ""
            }${formError ? " is-invalid" : ""}`}
          >
            <input
              ref={codeInputRef}
              id={codeInputId}
              name="one-time-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              enterKeyHint="done"
              value={code}
              maxLength={CODE_LENGTH}
              aria-invalid={formError !== null}
              aria-describedby={feedbackId}
              onFocus={() => setIsCodeFocused(true)}
              onBlur={() => setIsCodeFocused(false)}
              onChange={(event) => {
                setCode(sanitizeCode(event.target.value));
                setFormError(null);
                setStatusMessage(null);
              }}
            />

            <div className="auth-verification-boxes" aria-hidden="true">
              {Array.from({ length: CODE_LENGTH }, (_, index) => {
                const digit = code[index] ?? "";
                const isActive =
                  isCodeFocused &&
                  index === Math.min(code.length, CODE_LENGTH - 1);

                return (
                  <span
                    key={index}
                    className={`${digit ? "is-filled" : ""}${
                      isActive ? " is-active" : ""
                    }`}
                  >
                    {digit}
                  </span>
                );
              })}
            </div>
          </div>

          <p className="auth-verification-expiry">
            The code expires in 10 minutes
          </p>

          <p
            id={feedbackId}
            className={`auth-field-message auth-verification-feedback${
              formError ? " auth-field-message--error" : ""
            }`}
            role={formError ? "alert" : "status"}
            aria-live="polite"
          >
            {formError
              ? formatErrorMessage(formError)
              : (statusMessage ?? "\u00a0")}
          </p>

          <button
            className="auth-primary-button auth-verification-submit"
            type="submit"
            disabled={isVerifying || code.length !== CODE_LENGTH}
          >
            {isVerifying ? verifyingLabel : verifyLabel}
          </button>

          <button
            className="auth-verification-resend"
            type="button"
            disabled={isResending || remainingSeconds > 0}
            onClick={handleResend}
          >
            {isResending
              ? "Sending..."
              : remainingSeconds > 0
                ? `Resend code in ${formatCountdown(remainingSeconds)}`
                : "Resend code"}
          </button>
        </form>
      </section>
    </main>
  );
}
