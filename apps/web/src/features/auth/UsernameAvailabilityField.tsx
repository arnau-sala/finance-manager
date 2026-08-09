import { useEffect, useRef, useState } from "react";
import { Check, TriangleAlert } from "lucide-react";

import { formatErrorMessage } from "../../components/ui/error-message";
import { FieldCopyButton, revealTrailingCaret } from "./AuthPasswordField";
import { copyTextToClipboard } from "./clipboard";
import { checkUsernameAvailability } from "./registration-api";
import {
  getUsernameValidationMessage,
  isReservedUsername,
  validateUsername,
} from "./username-validation";

type UsernameAvailability =
  | "idle"
  | "checking"
  | "available"
  | "unavailable"
  | "error";

type UsernameAvailabilityFieldProps = {
  idPrefix: string;
  value: string;
  currentUsername?: string | null;
  disabled?: boolean;
  serverUnavailableUsername?: string | null;
  onChange: (value: string) => void;
  onValidUsernameChange: (username: string | null) => void;
};

const availabilityDelayMs = 250;

export function UsernameAvailabilityField({
  idPrefix,
  value,
  currentUsername = null,
  disabled = false,
  serverUnavailableUsername = null,
  onChange,
  onValidUsernameChange,
}: UsernameAvailabilityFieldProps) {
  const [availability, setAvailability] =
    useState<UsernameAvailability>("idle");
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null,
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [isAvailabilityVisible, setIsAvailabilityVisible] = useState(false);
  const [availabilityRevealId, setAvailabilityRevealId] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const availabilityVisibleRef = useRef(false);
  const remoteError =
    isAvailabilityVisible && availability === "unavailable"
      ? "Username already exists"
      : isAvailabilityVisible && availability === "error"
        ? availabilityError
        : null;
  const displayedError = localError ?? remoteError;
  const isAvailable =
    isAvailabilityVisible && availability === "available";
  const normalizedCurrentUsername = currentUsername?.trim().toLowerCase() ?? null;

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!serverUnavailableUsername || serverUnavailableUsername !== value) {
      return;
    }

    availabilityVisibleRef.current = true;
    setIsAvailabilityVisible(true);
    setAvailability("unavailable");
    onValidUsernameChange(null);
  }, [onValidUsernameChange, serverUnavailableUsername, value]);

  useEffect(() => {
    const result = validateUsername(value);

    if (!result.success || normalizedCurrentUsername !== result.data) {
      return;
    }

    cancelAvailabilityCheck();
    setLocalError(null);
    setAvailabilityError(null);
    setAvailability("available");
    setIsAvailabilityVisible(false);
    setIsCopied(false);
    onValidUsernameChange(result.data);
  }, [normalizedCurrentUsername, onValidUsernameChange, value]);

  function cancelAvailabilityCheck() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    abortRef.current?.abort();
    abortRef.current = null;
    requestRef.current += 1;
  }

  async function runAvailabilityCheck(
    normalizedUsername: string,
    requestId: number,
  ) {
    if (normalizedCurrentUsername === normalizedUsername) {
      setAvailability("available");
      onValidUsernameChange(
        availabilityVisibleRef.current ? normalizedUsername : null,
      );
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    timerRef.current = null;
    setAvailabilityError(null);
    setAvailability("checking");

    try {
      const available = await checkUsernameAvailability(
        normalizedUsername,
        controller.signal,
      );

      if (requestRef.current !== requestId) {
        return;
      }

      setAvailability(available ? "available" : "unavailable");
      onValidUsernameChange(
        available && availabilityVisibleRef.current
          ? normalizedUsername
          : null,
      );
    } catch (error) {
      if (controller.signal.aborted || requestRef.current !== requestId) {
        return;
      }

      setAvailability("error");
      setAvailabilityError(
        (error instanceof Error
          ? error.message
          : "Unable to check username availability"
        ).replace(/\.$/, ""),
      );
      onValidUsernameChange(null);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }

  function handleChange(nextValue: string) {
    const normalizedValue = nextValue.toLowerCase();
    const result = validateUsername(normalizedValue);

    cancelAvailabilityCheck();
    availabilityVisibleRef.current = false;
    setIsAvailabilityVisible(false);
    setAvailability("idle");
    setAvailabilityError(null);
    setIsCopied(false);
    onValidUsernameChange(null);
    onChange(normalizedValue);

    if (!normalizedValue.trim()) {
      setLocalError(null);
      return;
    }

    if (!result.success) {
      setLocalError(
        isReservedUsername(normalizedValue)
          ? (result.error.issues[0]?.message ?? "This username is reserved")
          : null,
      );
      return;
    }

    setLocalError(null);

    if (normalizedCurrentUsername === result.data) {
      setAvailability("available");
      return;
    }

    const requestId = requestRef.current;
    timerRef.current = window.setTimeout(() => {
      void runAvailabilityCheck(result.data, requestId);
    }, availabilityDelayMs);
  }

  function handleBlur() {
    const result = validateUsername(value);

    if (!result.success) {
      if (value.trim()) {
        setLocalError(
          getUsernameValidationMessage(value) ?? "Username is not valid",
        );
      }
      onValidUsernameChange(null);
      return;
    }

    availabilityVisibleRef.current = true;
    setIsAvailabilityVisible(true);
    setAvailabilityRevealId((current) => current + 1);

    if (normalizedCurrentUsername === result.data) {
      setAvailability("available");
      onValidUsernameChange(result.data);
      return;
    }

    if (availability === "available") {
      onValidUsernameChange(result.data);
      return;
    }

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
      void runAvailabilityCheck(result.data, requestRef.current);
    }
  }

  async function copyUsername() {
    try {
      await copyTextToClipboard(value);
      setIsCopied(true);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setIsCopied(false);
        copyTimerRef.current = null;
      }, 1400);
    } catch {
      setAvailabilityError("Unable to copy this field");
      setAvailability("error");
    }
  }

  return (
    <div className="auth-form-field">
      <div className="auth-register-field-heading">
        <span className="text-field-label" id={`${idPrefix}-label`}>
          Username
        </span>
        {displayedError ? (
          <p
            id={`${idPrefix}-error`}
            className="auth-register-field-error"
            role="alert"
            aria-live="polite"
          >
            <TriangleAlert aria-hidden="true" strokeWidth={1.8} />
            <span>{formatErrorMessage(displayedError)}</span>
          </p>
        ) : isAvailable ? (
          <FieldCopyButton
            label="username"
            copied={isCopied}
            disabled={disabled}
            onCopy={() => void copyUsername()}
          />
        ) : null}
      </div>

      <div className="auth-input-with-action auth-username-input">
        <input
          id={idPrefix}
          className="text-field auth-warning-input"
          aria-labelledby={`${idPrefix}-label`}
          name="username"
          type="text"
          inputMode="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Choose a username"
          value={value}
          maxLength={15}
          aria-invalid={displayedError !== null}
          aria-describedby={displayedError ? `${idPrefix}-error` : undefined}
          disabled={disabled}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={(event) => revealTrailingCaret(event.currentTarget)}
          onClick={(event) => revealTrailingCaret(event.currentTarget)}
          onBlur={handleBlur}
        />
        {isAvailable ? (
          <span
            key={availabilityRevealId}
            className="auth-username-input__status"
            role="status"
            aria-label="Username is available"
          >
            <Check aria-hidden="true" strokeWidth={2} />
          </span>
        ) : null}
      </div>
    </div>
  );
}
