import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject
} from "react";

const closeAnimationMs = 190;
const popoverGap = 9;
const viewportMargin = 12;

export type PickerPopoverPosition = {
  top: number;
  left: number;
  originX: number;
};

type UseAnchoredPickerOptions = {
  open: boolean;
  anchorRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  positionKey?: string | number;
};

export function useAnchoredPicker({
  open,
  anchorRef,
  onClose,
  positionKey
}: UseAnchoredPickerOptions) {
  const [isClosing, setIsClosing] = useState(false);
  const [position, setPosition] = useState<PickerPopoverPosition | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const closingRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);

  const requestClose = useCallback(() => {
    if (closingRef.current) {
      return;
    }

    closingRef.current = true;
    setIsClosing(true);
    const animationDuration = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
      ? 1
      : closeAnimationMs;

    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      closingRef.current = false;
      setIsClosing(false);
      onClose();
    }, animationDuration);
  }, [onClose]);

  useLayoutEffect(() => {
    if (open && !wasOpenRef.current) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      requestAnimationFrame(() => dialogRef.current?.focus());
    }

    if (!open && wasOpenRef.current) {
      requestAnimationFrame(() =>
        previousFocusRef.current?.focus({ preventScroll: true })
      );
    }

    wasOpenRef.current = open;
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    function updatePosition() {
      const anchor = anchorRef.current;
      const dialog = dialogRef.current;

      if (!anchor || !dialog) {
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      const dialogWidth = dialog.offsetWidth;
      const dialogHeight = dialog.offsetHeight;
      const left = Math.max(
        viewportMargin,
        (window.innerWidth - dialogWidth) / 2
      );
      const maximumTop = window.innerHeight - dialogHeight - viewportMargin;
      const top = Math.min(
        Math.max(anchorRect.bottom + popoverGap, viewportMargin),
        Math.max(viewportMargin, maximumTop)
      );
      const originX = Math.min(
        Math.max(
          anchorRect.left + anchorRect.width / 2 - left,
          viewportMargin
        ),
        dialogWidth - viewportMargin
      );

      setPosition((currentPosition) =>
        currentPosition?.top === top &&
        currentPosition.left === left &&
        currentPosition.originX === originX
          ? currentPosition
          : { top, left, originX }
      );
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [anchorRef, open, positionKey]);

  useEffect(() => {
    if (!open) {
      return;
    }

    document.body.classList.add("stats-picker-open");

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        requestClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const controls = dialogRef.current?.querySelectorAll<HTMLButtonElement>(
        'button:not(:disabled):not([tabindex="-1"])'
      );

      if (!controls || controls.length === 0) {
        event.preventDefault();
        return;
      }

      const firstControl = controls[0];
      const lastControl = controls[controls.length - 1];

      if (
        event.shiftKey &&
        (document.activeElement === firstControl ||
          document.activeElement === dialogRef.current)
      ) {
        event.preventDefault();
        lastControl.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === lastControl ||
          document.activeElement === dialogRef.current)
      ) {
        event.preventDefault();
        firstControl.focus();
      }
    }

    window.addEventListener("keydown", closeWithEscape);
    return () => {
      document.body.classList.remove("stats-picker-open");
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [open, requestClose]);

  useEffect(() => {
    if (open) {
      return;
    }

    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    closingRef.current = false;
    setIsClosing(false);
    setPosition(null);
  }, [open]);

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    },
    []
  );

  function handleBackdropPointerDown(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    if (event.target === event.currentTarget) {
      requestClose();
    }
  }

  return {
    dialogRef,
    isClosing,
    position,
    requestClose,
    handleBackdropPointerDown
  };
}
