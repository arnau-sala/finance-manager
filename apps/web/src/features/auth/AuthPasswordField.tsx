import { useEffect, useRef, useState } from "react";
import {
  Check,
  ClipboardPaste,
  Copy,
  Eye,
  EyeOff,
  RefreshCw
} from "lucide-react";

import type { PasswordCharacterStatus } from "./password-assistance";

export type FieldCopyAction = {
  copied: boolean;
  disabled?: boolean;
  label: string;
  onCopy: () => void;
};

export type FieldPasteAction = {
  disabled?: boolean;
  label: string;
  onPaste: () => void;
};

type AuthPasswordFieldProps = {
  id: string;
  label: string;
  name: string;
  placeholder: string;
  value: string;
  invalid: boolean;
  autoComplete: "current-password" | "new-password" | "off";
  describedBy?: string;
  onGenerate?: () => void;
  generating?: boolean;
  characterStatuses?: PasswordCharacterStatus[];
  copyAction?: FieldCopyAction;
  pasteAction?: FieldPasteAction;
  generated?: boolean;
  variant?: "standard" | "dialog";
  disabled?: boolean;
  onAutofill?: () => void;
  onBlur?: () => void;
  onFocus?: () => void;
  onChange: (value: string, autofilled: boolean) => void;
};

function isBrowserAutofilled(input: HTMLInputElement) {
  try {
    return input.matches(":-webkit-autofill");
  } catch {
    return false;
  }
}

export function revealTrailingCaret(
  input: HTMLInputElement,
  afterReveal?: () => void
) {
  window.requestAnimationFrame(() => {
    if (
      document.activeElement !== input ||
      input.selectionStart !== input.value.length ||
      input.selectionEnd !== input.value.length
    ) {
      return;
    }

    input.scrollLeft = input.scrollWidth;
    afterReveal?.();
  });
}

export function AuthPasswordField({
  id,
  label,
  name,
  placeholder,
  value,
  invalid,
  autoComplete,
  describedBy,
  onGenerate,
  generating = false,
  characterStatuses = [],
  copyAction,
  pasteAction,
  generated = false,
  variant = "standard",
  disabled = false,
  onAutofill,
  onBlur,
  onFocus,
  onChange
}: AuthPasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const characterFeedbackRef = useRef<HTMLDivElement>(null);
  const valueCharacters = Array.from(value);
  const displayedCharacterStatuses =
    characterStatuses.length === valueCharacters.length
      ? characterStatuses
      : valueCharacters.map(() => "match" as const);
  const showCharacterFeedback = !isVisible && valueCharacters.length > 0;

  function syncCharacterFeedbackScroll() {
    if (inputRef.current && characterFeedbackRef.current) {
      characterFeedbackRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  }

  function handleCaretVisibility(event: React.SyntheticEvent<HTMLInputElement>) {
    onFocus?.();
    revealTrailingCaret(event.currentTarget, syncCharacterFeedbackScroll);
  }

  useEffect(() => {
    if (!showCharacterFeedback) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(
      syncCharacterFeedbackScroll
    );

    return () => window.cancelAnimationFrame(animationFrame);
  }, [showCharacterFeedback, value]);

  return (
    <div
      className={`auth-form-field auth-password-field auth-password-field--${variant}`}
    >
      <div className="auth-password-field-heading">
        <span className="text-field-label" id={`${id}-label`}>
          {label}
        </span>
        {onGenerate ? (
          <button
            className={`auth-password-generate${
              generating ? " is-generating" : ""
            }`}
            type="button"
            onClick={onGenerate}
            aria-disabled={generating}
            disabled={disabled}
          >
            <RefreshCw aria-hidden="true" strokeWidth={1.8} />
            Generate
          </button>
        ) : copyAction ? (
          <FieldCopyButton {...copyAction} />
        ) : pasteAction ? (
          <button
            className="auth-password-paste"
            type="button"
            aria-label={pasteAction.label}
            disabled={disabled || pasteAction.disabled}
            onPointerDown={(event) => event.preventDefault()}
            onClick={pasteAction.onPaste}
          >
            <ClipboardPaste aria-hidden="true" strokeWidth={1.8} />
            Paste
          </button>
        ) : null}
      </div>
      <div
        className={`auth-input-with-action${
          showCharacterFeedback ? " has-character-feedback" : ""
        }`}
      >
        <input
          ref={inputRef}
          id={id}
          aria-labelledby={`${id}-label`}
          name={name}
          type={isVisible ? "text" : "password"}
          className={`text-field${
            variant === "dialog" ? " text-field--dialog" : ""
          } auth-password-input auth-password-input--${
            isVisible ? "visible" : "masked"
          }${showCharacterFeedback ? " has-character-feedback" : ""}${
            generated && value.length > 0 ? " is-generated" : ""
          }`}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          maxLength={128}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          disabled={disabled}
          onChange={(event) => {
            const autofilled = isBrowserAutofilled(event.currentTarget);
            onChange(event.target.value, autofilled);

            if (autofilled) {
              onAutofill?.();
            }
          }}
          onAnimationStart={(event) => {
            if (event.animationName === "auth-password-autofill-detected") {
              window.requestAnimationFrame(() => onAutofill?.());
            }
          }}
          onFocus={handleCaretVisibility}
          onClick={handleCaretVisibility}
          onScroll={syncCharacterFeedbackScroll}
          onBlur={onBlur}
        />
        {showCharacterFeedback ? (
          <div
            ref={characterFeedbackRef}
            className="auth-password-character-feedback"
            aria-hidden="true"
          >
            <div
              className="auth-password-character-feedback__track"
              style={{
                width: `${displayedCharacterStatuses.length * 12}px`,
                gridTemplateColumns: `repeat(${displayedCharacterStatuses.length}, 12px)`
              }}
            >
              {displayedCharacterStatuses.map((status, index) => (
                <span key={index} className={`is-${status}`} />
              ))}
            </div>
          </div>
        ) : null}
        <button
          className="auth-password-visibility"
          type="button"
          disabled={disabled}
          onClick={() => setIsVisible((current) => !current)}
          aria-label={
            isVisible
              ? `Hide ${label.toLowerCase()}`
              : `Show ${label.toLowerCase()}`
          }
          aria-pressed={isVisible}
        >
          {isVisible ? (
            <EyeOff aria-hidden="true" strokeWidth={1.8} />
          ) : (
            <Eye aria-hidden="true" strokeWidth={1.8} />
          )}
        </button>
      </div>
    </div>
  );
}

export function FieldCopyButton({
  copied,
  disabled = false,
  label,
  onCopy
}: FieldCopyAction) {
  return (
    <button
      className={`auth-field-copy-action${copied ? " is-copied" : ""}`}
      type="button"
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
      disabled={disabled}
      onPointerDown={(event) => event.preventDefault()}
      onClick={onCopy}
    >
      <span className="auth-field-copy-action__icons" aria-hidden="true">
        <Copy className="auth-field-copy-action__copy" strokeWidth={1.8} />
        <Check className="auth-field-copy-action__check" strokeWidth={1.8} />
      </span>
    </button>
  );
}
