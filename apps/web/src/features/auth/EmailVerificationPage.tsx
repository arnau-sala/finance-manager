import { useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";

import { ActionButton } from "../../components/ui/ActionButton";
import { formatErrorMessage } from "../../components/ui/error-message";
import {
  EMAIL_VERIFICATION_CODE_LENGTH,
  EmailVerificationCodeInput,
  EmailVerificationResendButton
} from "./EmailVerificationCodeInput";

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
  const [formError, setFormError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const titleId = `${idPrefix}-title`;
  const codeInputId = `${idPrefix}-code`;
  const feedbackId = `${idPrefix}-feedback`;
  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isVerifying || code.length !== EMAIL_VERIFICATION_CODE_LENGTH) {
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

  return (
    <main className="auth-screen auth-screen--login auth-screen--verification">
      <ActionButton
        shape="icon"
        className="auth-back-button"
        type="button"
        onClick={onBack}
        disabled={isVerifying || isResending}
        aria-label="Go back"
      >
        <ChevronLeft aria-hidden="true" strokeWidth={1.8} />
      </ActionButton>

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
          <EmailVerificationCodeInput
            ref={codeInputRef}
            id={codeInputId}
            value={code}
            invalid={formError !== null}
            disabled={isVerifying || isResending}
            describedBy={feedbackId}
            onChange={(value) => {
              setCode(value);
              setFormError(null);
              setStatusMessage(null);
            }}
          />

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

          <ActionButton
            className="auth-primary-button auth-verification-submit"
            type="submit"
            disabled={
              isVerifying ||
              isResending ||
              code.length !== EMAIL_VERIFICATION_CODE_LENGTH
            }
          >
            {isVerifying ? verifyingLabel : verifyLabel}
          </ActionButton>

          <EmailVerificationResendButton
            disabled={isVerifying}
            onResend={onResendCode}
            onResendStart={() => {
              setFormError(null);
              setStatusMessage(null);
            }}
            onResendSuccess={() =>
              setStatusMessage("A new code has been sent")
            }
            onResendError={(error) =>
              setFormError(
                error instanceof Error
                  ? error.message
                  : "Unable to resend the code. Please try again"
              )
            }
            onBusyChange={setIsResending}
          />
        </form>
      </section>
    </main>
  );
}
