import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
  type WheelEvent as ReactWheelEvent
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const closeAnimationMs = 190;
const popoverGap = 9;
const viewportMargin = 12;

const monthLabels = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
] as const;

type MonthPickerProps = {
  open: boolean;
  anchorRef: RefObject<HTMLButtonElement | null>;
  value: string;
  availableMonths: readonly string[];
  minimumMonth: string | null;
  maximumMonth: string;
  onSelect: (month: string) => void;
  onClose: () => void;
};

type PopoverPosition = {
  top: number;
  left: number;
  originX: number;
};

function getMonthKey(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function getYear(month: string) {
  return Number(month.slice(0, 4));
}

function clampYear(year: number, minimumYear: number, maximumYear: number) {
  return Math.min(Math.max(year, minimumYear), maximumYear);
}

export function MonthPicker({
  open,
  anchorRef,
  value,
  availableMonths,
  minimumMonth,
  maximumMonth,
  onSelect,
  onClose
}: MonthPickerProps) {
  const maximumYear = getYear(maximumMonth);
  const minimumYear = minimumMonth ? getYear(minimumMonth) : maximumYear;
  const [visibleYear, setVisibleYear] = useState(() =>
    clampYear(getYear(value), minimumYear, maximumYear)
  );
  const [isClosing, setIsClosing] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const closingRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);
  const availableMonthSet = useMemo(
    () => new Set(availableMonths),
    [availableMonths]
  );
  const years = useMemo(
    () =>
      Array.from(
        { length: maximumYear - minimumYear + 1 },
        (_, index) => minimumYear + index
      ),
    [maximumYear, minimumYear]
  );
  const today = new Date();
  const currentCalendarMonth = getMonthKey(
    today.getFullYear(),
    today.getMonth()
  );

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
      const initialYear = clampYear(
        getYear(value),
        minimumYear,
        maximumYear
      );

      previousFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setVisibleYear(initialYear);

      const viewport = viewportRef.current;
      if (viewport) {
        viewport.scrollLeft =
          (initialYear - minimumYear) * viewport.clientWidth;
      }

      requestAnimationFrame(() => dialogRef.current?.focus());
    }

    if (!open && wasOpenRef.current) {
      requestAnimationFrame(() =>
        previousFocusRef.current?.focus({ preventScroll: true })
      );
    }

    wasOpenRef.current = open;
  }, [maximumYear, minimumYear, open, value]);

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
  }, [anchorRef, open, value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    document.body.classList.add("month-picker-open");

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
      document.body.classList.remove("month-picker-open");
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

  if (!open) {
    return null;
  }

  function changeYear(direction: -1 | 1) {
    scrollToYear(visibleYear + direction);
  }

  function scrollToYear(year: number) {
    const nextYear = clampYear(year, minimumYear, maximumYear);
    const viewport = viewportRef.current;

    if (!viewport || nextYear === visibleYear) {
      return;
    }

    viewport.scrollTo({
      left: (nextYear - minimumYear) * viewport.clientWidth,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth"
    });
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    const primaryDelta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;

    if (Math.abs(primaryDelta) < 1) {
      return;
    }

    event.preventDefault();
    const deltaScale =
      event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? event.currentTarget.clientWidth
          : 1;

    event.currentTarget.scrollLeft += primaryDelta * deltaScale;
  }

  function handleScroll() {
    const viewport = viewportRef.current;
    if (!viewport || viewport.clientWidth === 0) {
      return;
    }

    const nearestIndex = Math.min(
      Math.max(Math.round(viewport.scrollLeft / viewport.clientWidth), 0),
      years.length - 1
    );
    const nearestYear = years[nearestIndex];

    setVisibleYear((currentYear) =>
      currentYear === nearestYear ? currentYear : nearestYear
    );
  }

  return (
    <div
      className="month-picker-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className={`month-picker${position ? " is-positioned" : ""}${
          isClosing ? " is-closing" : ""
        }`}
        style={
          position
            ? ({
                top: position.top,
                left: position.left,
                "--month-picker-origin-x": `${position.originX}px`
              } as CSSProperties)
            : undefined
        }
        role="dialog"
        aria-modal="true"
        aria-label="Choose month"
        tabIndex={-1}
      >
        <header className="month-picker__header">
          <strong aria-live="polite">{visibleYear}</strong>
          <div className="month-picker__header-actions">
            <button
              type="button"
              disabled={visibleYear <= minimumYear}
              aria-label="Previous year"
              onClick={() => changeYear(-1)}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={visibleYear >= maximumYear}
              aria-label="Next year"
              onClick={() => changeYear(1)}
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </header>

        <div
          ref={viewportRef}
          className="month-picker__viewport"
          onWheel={handleWheel}
          onScroll={handleScroll}
        >
          <div className="month-picker__track">
            {years.map((year) => (
              <div
                key={year}
                className="month-picker__grid"
                role="group"
                aria-label={`Months in ${year}`}
                aria-hidden={year !== visibleYear}
              >
                {monthLabels.map((label, monthIndex) => {
                  const month = getMonthKey(year, monthIndex);
                  const disabled =
                    month < (minimumMonth ?? maximumMonth) ||
                    month > maximumMonth ||
                    !availableMonthSet.has(month);
                  const selected = month === value;
                  const current = month === currentCalendarMonth;
                  const className = [
                    selected ? "is-selected" : "",
                    current ? "is-current" : ""
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <button
                      key={month}
                      type="button"
                      disabled={disabled}
                      tabIndex={year === visibleYear ? undefined : -1}
                      className={className || undefined}
                      aria-pressed={selected}
                      aria-current={current ? "date" : undefined}
                      onClick={() => {
                        if (year !== visibleYear) {
                          return;
                        }

                        onSelect(month);
                        requestClose();
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
