import type { MouseEvent, ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  icon: ReactNode;
  isConfirming?: boolean;
  error?: string | null;
  tone?: "default" | "danger" | "warning";
  confirmTone?: "default" | "danger";
  confirmDisabled?: boolean;
  confirmingLabel?: string;
  initialFocus?: "cancel" | "dialog";
  showCancel?: boolean;
  children?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  icon,
  isConfirming = false,
  error = null,
  tone = "default",
  confirmTone = "default",
  confirmDisabled = false,
  confirmingLabel = "Please wait...",
  initialFocus = "cancel",
  showCancel = true,
  children,
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const isConfirmingRef = useRef(isConfirming);

  onCancelRef.current = onCancel;
  isConfirmingRef.current = isConfirming;

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const appRoot = document.getElementById("root");
    const rootWasInert = appRoot?.hasAttribute("inert") ?? false;
    const focusFrame = requestAnimationFrame(() => {
      const initialControl = dialogRef.current?.querySelector<HTMLElement>(
        "[data-dialog-autofocus]"
      );
      const fallbackControl =
        initialFocus === "dialog" ? dialogRef.current : cancelButtonRef.current;
      (initialControl ?? fallbackControl)?.focus();
    });

    appRoot?.setAttribute("inert", "");

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && !isConfirmingRef.current) {
        event.preventDefault();
        onCancelRef.current();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input:not(:disabled)"
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
  }, [initialFocus, open]);

  if (!open) {
    return null;
  }

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !isConfirming) {
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
        className={`confirm-dialog confirm-dialog--${tone} confirm-dialog--confirm-${confirmTone}`}
        role="alertdialog"
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
            {error}
          </p>
        ) : null}

        <div
          className={`confirm-dialog__actions${
            showCancel ? "" : " confirm-dialog__actions--single"
          }`}
        >
          {showCancel ? (
            <button
              ref={cancelButtonRef}
              className="confirm-dialog__button confirm-dialog__button--cancel"
              type="button"
              onClick={onCancel}
              disabled={isConfirming}
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            className="confirm-dialog__button confirm-dialog__button--confirm"
            type="button"
            onClick={() => void onConfirm()}
            disabled={isConfirming || confirmDisabled}
          >
            {isConfirming ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
