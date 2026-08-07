import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ClipboardPaste,
  KeyRound,
  TriangleAlert,
  UserRoundCheck
} from "lucide-react";

import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { formatErrorMessage } from "../../components/ui/error-message";
import { verifyPasswordResetRecoveryCode } from "./password-recovery-api";

type PasswordRecoveryCodePageProps = {
  username: string | null;
  onBack: () => void;
  onVerified: (username: string) => void;
};

const RECOVERY_CODE_LENGTH = 16;
const RECOVERY_CODE_DISPLAY_LENGTH = 19;
const PASTED_CODE_CHARACTER_DELAY_MS = 11;
const PASTE_WARNING_DURATION_MS = 5000;
const RECOVERY_CODE_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function canonicalRecoveryCode(value: string) {
  return Array.from(value)
    .filter((character) => RECOVERY_CODE_ALPHABET.includes(character))
    .join("");
}

function formatRecoveryCode(value: string) {
  const canonical = canonicalRecoveryCode(value).slice(
    0,
    RECOVERY_CODE_LENGTH
  );

  return canonical.match(/.{1,4}/g)?.join("-") ?? canonical;
}

function getUnsupportedRecoveryCodeCharacters(value: string) {
  return [
    ...new Set(
      Array.from(value).filter(
        (character) =>
          !RECOVERY_CODE_ALPHABET.includes(character) &&
          character !== "-" &&
          !/\s/u.test(character)
      )
    )
  ];
}

function isClipboardPasteCancelled(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "AbortError")
  );
}

export function PasswordRecoveryCodePage({
  username,
  onBack,
  onVerified
}: PasswordRecoveryCodePageProps) {
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const [unsupportedPasteCharacters, setUnsupportedPasteCharacters] =
    useState<string[]>([]);
  const [verifiedUsername, setVerifiedUsername] = useState<string | null>(null);
  const [isAccountConfirmationOpen, setIsAccountConfirmationOpen] =
    useState(false);
  const pasteRunRef = useRef(0);
  const pasteWarningTimerRef = useRef<number | null>(null);
  const codeLength = canonicalRecoveryCode(recoveryCode).length;
  const canSubmit = codeLength === RECOVERY_CODE_LENGTH;

  useEffect(() => {
    return () => {
      pasteRunRef.current += 1;

      if (pasteWarningTimerRef.current !== null) {
        window.clearTimeout(pasteWarningTimerRef.current);
      }
    };
  }, []);

  function updatePasteWarning(value: string) {
    const unsupportedCharacters =
      getUnsupportedRecoveryCodeCharacters(value);

    if (pasteWarningTimerRef.current !== null) {
      window.clearTimeout(pasteWarningTimerRef.current);
      pasteWarningTimerRef.current = null;
    }

    setUnsupportedPasteCharacters(unsupportedCharacters);

    if (unsupportedCharacters.length === 0) {
      return;
    }

    pasteWarningTimerRef.current = window.setTimeout(() => {
      setUnsupportedPasteCharacters([]);
      pasteWarningTimerRef.current = null;
    }, PASTE_WARNING_DURATION_MS);
  }

  function cancelPasteAnimation() {
    if (!isPasting) {
      return;
    }

    pasteRunRef.current += 1;
    setIsPasting(false);
  }

  function waitForPasteStep(delay: number) {
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, delay);
    });
  }

  async function handlePasteFromClipboard() {
    if (isPasting) {
      return;
    }

    if (!navigator.clipboard || !window.isSecureContext) {
      setError("Clipboard access is unavailable");
      return;
    }

    try {
      const clipboardValue = await navigator.clipboard.readText();
      const unsupportedCharacters =
        getUnsupportedRecoveryCodeCharacters(clipboardValue);
      updatePasteWarning(clipboardValue);
      const canonical = canonicalRecoveryCode(clipboardValue).slice(
        0,
        RECOVERY_CODE_LENGTH
      );

      if (
        canonical.length !== RECOVERY_CODE_LENGTH &&
        unsupportedCharacters.length === 0
      ) {
        setError("Clipboard does not contain a valid recovery code");
        return;
      }

      const runId = pasteRunRef.current + 1;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      const characterDelay = reduceMotion ? 0 : PASTED_CODE_CHARACTER_DELAY_MS;

      pasteRunRef.current = runId;
      setVerifiedUsername(null);
      setIsAccountConfirmationOpen(false);
      setIsPasting(true);
      setRecoveryCode("");
      setError(null);

      for (let index = 1; index <= canonical.length; index += 1) {
        await waitForPasteStep(characterDelay);

        if (pasteRunRef.current !== runId) {
          return;
        }

        setRecoveryCode(formatRecoveryCode(canonical.slice(0, index)));
      }

      if (pasteRunRef.current === runId) {
        setIsPasting(false);
      }
    } catch (clipboardError) {
      setIsPasting(false);

      if (isClipboardPasteCancelled(clipboardError)) {
        return;
      }

      setError("Unable to read the clipboard");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || isSubmitting) {
      return;
    }

    if (username === null && verifiedUsername) {
      setIsAccountConfirmationOpen(true);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const verifiedUsername = await verifyPasswordResetRecoveryCode({
        username,
        recoveryCode
      });

      if (username === null) {
        setVerifiedUsername(verifiedUsername);
        setIsAccountConfirmationOpen(true);
        setIsSubmitting(false);
        return;
      }

      onVerified(verifiedUsername);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to verify the recovery code. Please try again"
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-screen auth-screen--login auth-screen--password-recovery-code">
      <button
        className="auth-back-button"
        type="button"
        onClick={onBack}
        aria-label="Go back"
      >
        <ChevronLeft aria-hidden="true" strokeWidth={1.8} />
      </button>

      <section
        className="auth-panel auth-password-recovery-code-panel"
        aria-labelledby="password-recovery-code-title"
      >
        <header className="auth-header auth-password-recovery-code-header">
          <span className="auth-recovery-code-icon" aria-hidden="true">
            <KeyRound strokeWidth={1.7} />
          </span>
          <div className="auth-message">
            {username ? (
              <p className="auth-recovery-code-eyebrow">@{username}</p>
            ) : null}
            <h1 id="password-recovery-code-title">
              {username ? "Enter recovery code" : "Find your username"}
            </h1>
            <p className="auth-subtitle auth-password-recovery-code-subtitle">
              Enter the 16-character code shown when you created your account
            </p>
          </div>
        </header>

        <form
          className="auth-register-form auth-password-recovery-code-form"
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="auth-form-field">
            <div className="auth-register-field-heading">
              <span id="password-recovery-code-label">Recovery code</span>
              {unsupportedPasteCharacters.length > 0 ? (
                <p
                  className="auth-register-field-error auth-password-recovery-code-paste-warning"
                  role="status"
                  aria-live="polite"
                >
                  <TriangleAlert aria-hidden="true" strokeWidth={1.8} />
                  <span>
                    Could not paste: {unsupportedPasteCharacters.join(", ")}
                  </span>
                </p>
              ) : (
                <button
                  className="auth-password-recovery-code-paste"
                  type="button"
                  aria-disabled={isPasting}
                  onClick={() => void handlePasteFromClipboard()}
                >
                  <ClipboardPaste aria-hidden="true" strokeWidth={1.8} />
                  Paste
                </button>
              )}
            </div>
            <input
              id="password-recovery-code"
              aria-labelledby="password-recovery-code-label"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={recoveryCode}
              maxLength={RECOVERY_CODE_DISPLAY_LENGTH}
              aria-invalid={error !== null}
              aria-describedby="password-recovery-code-error"
              onChange={(event) => {
                cancelPasteAnimation();
                setVerifiedUsername(null);
                setIsAccountConfirmationOpen(false);
                setRecoveryCode(formatRecoveryCode(event.target.value));
                setError(null);
              }}
              onPaste={(event) => {
                event.preventDefault();
                cancelPasteAnimation();
                setVerifiedUsername(null);
                setIsAccountConfirmationOpen(false);
                const pastedValue = event.clipboardData.getData("text");
                updatePasteWarning(pastedValue);
                setRecoveryCode(formatRecoveryCode(pastedValue));
                setError(null);
              }}
            />
          </div>

          <p className="auth-password-recovery-code-note">
            Separators do not matter, but letters are case-sensitive
          </p>

          <p
            id="password-recovery-code-error"
            className="auth-field-message auth-field-message--error auth-password-recovery-error"
            role="alert"
            aria-live="polite"
          >
            {error ? formatErrorMessage(error) : "\u00a0"}
          </p>

          <button
            className="auth-primary-button"
            type="submit"
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? "Verifying..." : "Continue"}
          </button>
        </form>
      </section>

      <ConfirmDialog
        open={isAccountConfirmationOpen && verifiedUsername !== null}
        title="Account found"
        description={`This code belongs to @${verifiedUsername ?? ""}\nContinue recovering this account?`}
        confirmLabel="Continue"
        icon={<UserRoundCheck />}
        onCancel={() => setIsAccountConfirmationOpen(false)}
        onConfirm={() => {
          if (verifiedUsername) {
            onVerified(verifiedUsername);
          }
        }}
      />
    </main>
  );
}
