import type { MouseEvent, ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { ActionButton } from "./ActionButton";
import { formatErrorMessage } from "./error-message";

type ConfirmDialogProps = {
  open: boolean;
  className?: string;
  role?: "alertdialog" | "dialog";
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  icon: ReactNode;
  isConfirming?: boolean;
  interactionLocked?: boolean;
  error?: string | null;
  tone?: "default" | "danger" | "warning";
  confirmTone?: "default" | "danger";
  confirmDisabled?: boolean;
  confirmingLabel?: string;
  showCancel?: boolean;
  dismissible?: boolean;
  children?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  className,
  role = "alertdialog",
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  icon,
  isConfirming = false,
  interactionLocked = false,
  error = null,
  tone = "default",
  confirmTone = "default",
  confirmDisabled = false,
  confirmingLabel = "Please wait",
  showCancel = true,
  dismissible = true,
  children,
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const interactionLockedRef = useRef(isConfirming || interactionLocked);
  const dismissibleRef = useRef(dismissible);

  onCancelRef.current = onCancel;
  interactionLockedRef.current = isConfirming || interactionLocked;
  dismissibleRef.current = dismissible;

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const appRoot = document.getElementById("root");
    const rootWasInert = appRoot?.hasAttribute("inert") ?? false;
    const focusFrame = requestAnimationFrame(() => {
      dialogRef.current?.focus({ preventScroll: true });
    });

    appRoot?.setAttribute("inert", "");

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();

        if (dismissibleRef.current && !interactionLockedRef.current) {
          onCancelRef.current();
        }

        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input:not(:disabled), textarea:not(:disabled)"
      );

      if (!controls?.length) {
        event.preventDefault();
        return;
      }

      const firstControl = controls[0];
      const lastControl = controls[controls.length - 1];

      if (event.shiftKey && document.activeElement === firstControl) {
        event.preventDefault();
        lastControl.focus();
      } else if (!event.shiftKey && document.activeElement === lastControl) {
        event.preventDefault();
        firstControl.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);

      if (!rootWasInert) {
        appRoot?.removeAttribute("inert");
      }

      previousActiveElement?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) {
    return null;
  }

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (
      dismissible &&
      event.target === event.currentTarget &&
      !isConfirming &&
      !interactionLocked
    ) {
      onCancel();
    }
  }

  function preventDialogMouseDown(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  return createPortal(
    <div className="confirm-dialog-backdrop" onMouseDown={handleBackdropMouseDown}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`confirm-dialog confirm-dialog--${tone} confirm-dialog--confirm-${confirmTone}${
          className ? ` ${className}` : ""
        }`}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onMouseDown={preventDialogMouseDown}
      >
        <div className="confirm-dialog__icon" aria-hidden="true">
          {icon}
        </div>

        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>

        {children}

        {error ? (
          <p className="confirm-dialog__error" role="alert">
            {formatErrorMessage(error)}
          </p>
        ) : null}

        <div
          className={`confirm-dialog__actions${
            showCancel ? "" : " confirm-dialog__actions--single"
          }`}
        >
          {showCancel ? (
            <ActionButton
              ref={cancelButtonRef}
              className="confirm-dialog__button confirm-dialog__button--cancel"
              type="button"
              onClick={onCancel}
              disabled={isConfirming || interactionLocked}
            >
              {cancelLabel}
            </ActionButton>
          ) : null}
          <ActionButton
            ref={confirmButtonRef}
            className="confirm-dialog__button confirm-dialog__button--confirm"
            type="button"
            onClick={() => void onConfirm()}
            disabled={isConfirming || interactionLocked || confirmDisabled}
          >
            {isConfirming ? confirmingLabel : confirmLabel}
          </ActionButton>
        </div>
      </div>
    </div>,
    document.body
  );
}
