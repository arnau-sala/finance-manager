import {
  forwardRef,
  useEffect,
  useState,
  type ChangeEvent
} from "react";

export const EMAIL_VERIFICATION_CODE_LENGTH = 6;
const RESEND_COOLDOWN_MS = 60_000;

function sanitizeCode(value: string) {
  return value.replace(/\D/g, "").slice(0, EMAIL_VERIFICATION_CODE_LENGTH);
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

type EmailVerificationCodeInputProps = {
  id: string;
  value: string;
  invalid: boolean;
  disabled?: boolean;
  tone?: "default" | "danger";
  describedBy?: string;
  onChange: (value: string) => void;
};

export const EmailVerificationCodeInput = forwardRef<
  HTMLInputElement,
  EmailVerificationCodeInputProps
>(function EmailVerificationCodeInput(
  {
    id,
    value,
    invalid,
    disabled = false,
    tone = "default",
    describedBy,
    onChange
  },
  ref
) {
  const [isFocused, setIsFocused] = useState(false);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(sanitizeCode(event.target.value));
  }

  return (
    <>
      <label className="sr-only" htmlFor={id}>
        Verification code
      </label>
      <div
        className={`auth-verification-code${
          isFocused ? " is-focused" : ""
        }${invalid ? " is-invalid" : ""}${
          tone === "danger" ? " auth-verification-code--danger" : ""
        }`}
      >
        <input
          ref={ref}
          id={id}
          name="one-time-code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          enterKeyHint="done"
          value={value}
          maxLength={EMAIL_VERIFICATION_CODE_LENGTH}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          disabled={disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={handleChange}
        />

        <div className="auth-verification-boxes" aria-hidden="true">
          {Array.from(
            { length: EMAIL_VERIFICATION_CODE_LENGTH },
            (_, index) => {
              const digit = value[index] ?? "";
              const isActive =
                isFocused &&
                index ===
                  Math.min(value.length, EMAIL_VERIFICATION_CODE_LENGTH - 1);

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
            }
          )}
        </div>
      </div>
    </>
  );
});

type EmailVerificationResendButtonProps = {
  disabled?: boolean;
  tone?: "default" | "danger";
  onResend: () => void | Promise<void>;
  onResendStart?: () => void;
  onResendSuccess?: () => void;
  onResendError: (error: unknown) => void;
  onBusyChange?: (busy: boolean) => void;
};

export function EmailVerificationResendButton({
  disabled = false,
  tone = "default",
  onResend,
  onResendStart,
  onResendSuccess,
  onResendError,
  onBusyChange
}: EmailVerificationResendButtonProps) {
  const [isResending, setIsResending] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(
    () => Date.now() + RESEND_COOLDOWN_MS
  );
  const [now, setNow] = useState(() => Date.now());
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

  async function handleResend() {
    if (disabled || isResending || remainingSeconds > 0) {
      return;
    }

    onResendStart?.();
    setIsResending(true);
    onBusyChange?.(true);

    try {
      await onResend();
      setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
      setNow(Date.now());
      onResendSuccess?.();
    } catch (error) {
      onResendError(error);
    } finally {
      setIsResending(false);
      onBusyChange?.(false);
    }
  }

  return (
    <button
      className={`auth-verification-resend${
        tone === "danger" ? " auth-verification-resend--danger" : ""
      }`}
      type="button"
      disabled={disabled || isResending || remainingSeconds > 0}
      onClick={handleResend}
    >
      {isResending
        ? "Sending"
        : remainingSeconds > 0
          ? `Resend code in ${formatCountdown(remainingSeconds)}`
          : "Resend code"}
    </button>
  );
}
