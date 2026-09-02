import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
  type WheelEvent as ReactWheelEvent
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  getTodayDateOnly,
  parseLocalDateOnly
} from "../../dates/date-only";
import { useAnchoredPicker } from "./useAnchoredPicker";

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
const monthLongLabels = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
] as const;
const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const sixWeekCalendarCellCount = 42;

type CalendarView = "days" | "months";

type CalendarDatePickerProps = {
  open: boolean;
  anchorRef: RefObject<HTMLButtonElement | null>;
  value: string;
  initialDate?: string;
  rangeStart?: string;
  rangeEnd?: string;
  minimumDate: string;
  maximumDate: string;
  onSelect: (date: string) => boolean | void;
  onClose: () => void;
  placement?: "above" | "below" | "auto";
};

function getDateParts(value: string) {
  const date = parseLocalDateOnly(value);

  if (!date) {
    return null;
  }

  return {
    year: date.getFullYear(),
    monthIndex: date.getMonth(),
    day: date.getDate()
  };
}

function getRequiredDateParts(value: string) {
  const parts = getDateParts(value);

  if (!parts) {
    throw new Error("CalendarDatePicker requires valid date boundaries");
  }

  return parts;
}

function getMonthIndex(year: number, monthIndex: number) {
  return year * 12 + monthIndex;
}

function getMonthParts(monthIndex: number) {
  return {
    year: Math.floor(monthIndex / 12),
    monthIndex: monthIndex % 12
  };
}

function getMonthKey(monthIndex: number) {
  const parts = getMonthParts(monthIndex);
  return `${parts.year}-${String(parts.monthIndex + 1).padStart(2, "0")}`;
}

function getDateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(
    day
  ).padStart(2, "0")}`;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getInitialMonthIndex(
  value: string,
  minimumMonthIndex: number,
  maximumMonthIndex: number
) {
  const valueParts = getDateParts(value);
  const requestedMonthIndex = valueParts
    ? getMonthIndex(valueParts.year, valueParts.monthIndex)
    : maximumMonthIndex;

  return clamp(
    requestedMonthIndex,
    minimumMonthIndex,
    maximumMonthIndex
  );
}

function getDayCells(year: number, monthIndex: number) {
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const visibleWeekCount = Math.max(
    5,
    Math.ceil((firstWeekday + daysInMonth) / 7)
  );

  return Array.from({ length: visibleWeekCount * 7 }, (_, cellIndex) => {
    const day = cellIndex - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
}

export function CalendarDatePicker({
  open,
  anchorRef,
  value,
  initialDate = value,
  rangeStart = "",
  rangeEnd = "",
  minimumDate,
  maximumDate,
  onSelect,
  onClose,
  placement = "below"
}: CalendarDatePickerProps) {
  const minimumParts = getRequiredDateParts(minimumDate);
  const maximumParts = getRequiredDateParts(maximumDate);

  const minimumMonthIndex = getMonthIndex(
    minimumParts.year,
    minimumParts.monthIndex
  );
  const maximumMonthIndex = getMonthIndex(
    maximumParts.year,
    maximumParts.monthIndex
  );
  const initialMonthIndex = getInitialMonthIndex(
    initialDate,
    minimumMonthIndex,
    maximumMonthIndex
  );
  const [view, setView] = useState<CalendarView>("days");
  const [visibleMonthIndex, setVisibleMonthIndex] =
    useState(initialMonthIndex);
  const [visibleYear, setVisibleYear] = useState(
    getMonthParts(initialMonthIndex).year
  );
  const dayViewportRef = useRef<HTMLDivElement>(null);
  const monthViewportRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const pendingDayPositionRef = useRef<number | null>(null);
  const pendingYearPositionRef = useRef<number | null>(null);
  const monthIndexes = useMemo(
    () =>
      Array.from(
        { length: maximumMonthIndex - minimumMonthIndex + 1 },
        (_, index) => minimumMonthIndex + index
      ),
    [maximumMonthIndex, minimumMonthIndex]
  );
  const years = useMemo(
    () =>
      Array.from(
        { length: maximumParts.year - minimumParts.year + 1 },
        (_, index) => minimumParts.year + index
      ),
    [maximumParts.year, minimumParts.year]
  );
  const today = getTodayDateOnly();
  const currentMonth = today.slice(0, 7);
  const hasCompleteRange =
    rangeStart.length > 0 &&
    rangeEnd.length > 0 &&
    rangeStart < rangeEnd;
  const visibleMonth = getMonthParts(visibleMonthIndex);
  const {
    dialogRef,
    isClosing,
    position,
    requestClose,
    handleBackdropPointerDown
  } = useAnchoredPicker({
    open,
    anchorRef,
    onClose,
    positionKey: view,
    anchorGap: 14,
    placement
  });

  useLayoutEffect(() => {
    if (open && !wasOpenRef.current) {
      const nextMonthIndex = getInitialMonthIndex(
        initialDate,
        minimumMonthIndex,
        maximumMonthIndex
      );

      pendingDayPositionRef.current = nextMonthIndex;
      setView("days");
      setVisibleMonthIndex(nextMonthIndex);
      setVisibleYear(getMonthParts(nextMonthIndex).year);
    }

    wasOpenRef.current = open;
  }, [
    initialDate,
    maximumMonthIndex,
    minimumMonthIndex,
    open
  ]);

  useLayoutEffect(() => {
    if (!open || view !== "days") {
      return;
    }

    const targetMonthIndex = pendingDayPositionRef.current;

    if (targetMonthIndex === null) {
      return;
    }

    pendingDayPositionRef.current = null;
    const frame = window.requestAnimationFrame(() => {
      const viewport = dayViewportRef.current;

      if (viewport) {
        viewport.scrollLeft =
          (targetMonthIndex - minimumMonthIndex) * viewport.clientWidth;
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [minimumMonthIndex, open, view]);

  useLayoutEffect(() => {
    if (!open || view !== "months") {
      return;
    }

    const targetYear = pendingYearPositionRef.current;

    if (targetYear === null) {
      return;
    }

    pendingYearPositionRef.current = null;
    const frame = window.requestAnimationFrame(() => {
      const viewport = monthViewportRef.current;

      if (viewport) {
        viewport.scrollLeft =
          (targetYear - minimumParts.year) * viewport.clientWidth;
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [minimumParts.year, open, view]);

  if (!open) {
    return null;
  }

  function scrollToMonth(monthIndex: number) {
    const nextMonthIndex = clamp(
      monthIndex,
      minimumMonthIndex,
      maximumMonthIndex
    );
    const viewport = dayViewportRef.current;

    if (!viewport || nextMonthIndex === visibleMonthIndex) {
      return;
    }

    viewport.scrollTo({
      left: (nextMonthIndex - minimumMonthIndex) * viewport.clientWidth,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth"
    });
  }

  function scrollToYear(year: number) {
    const nextYear = clamp(
      year,
      minimumParts.year,
      maximumParts.year
    );
    const viewport = monthViewportRef.current;

    if (!viewport || nextYear === visibleYear) {
      return;
    }

    viewport.scrollTo({
      left: (nextYear - minimumParts.year) * viewport.clientWidth,
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

  function handleDayScroll() {
    const viewport = dayViewportRef.current;

    if (!viewport || viewport.clientWidth === 0) {
      return;
    }

    const nearestIndex = clamp(
      Math.round(viewport.scrollLeft / viewport.clientWidth),
      0,
      monthIndexes.length - 1
    );
    const nextMonthIndex = monthIndexes[nearestIndex];

    setVisibleMonthIndex((current) =>
      current === nextMonthIndex ? current : nextMonthIndex
    );
    setVisibleYear(getMonthParts(nextMonthIndex).year);
  }

  function handleMonthScroll() {
    const viewport = monthViewportRef.current;

    if (!viewport || viewport.clientWidth === 0) {
      return;
    }

    const nearestIndex = clamp(
      Math.round(viewport.scrollLeft / viewport.clientWidth),
      0,
      years.length - 1
    );
    const nextYear = years[nearestIndex];

    setVisibleYear((current) =>
      current === nextYear ? current : nextYear
    );
  }

  function openMonthView() {
    pendingYearPositionRef.current = visibleMonth.year;
    setVisibleYear(visibleMonth.year);
    setView("months");
  }

  function selectMonth(monthIndex: number) {
    pendingDayPositionRef.current = monthIndex;
    setVisibleMonthIndex(monthIndex);
    setVisibleYear(getMonthParts(monthIndex).year);
    setView("days");
  }

  return createPortal(
    <div
      className="month-picker-backdrop"
      onPointerDown={handleBackdropPointerDown}
    >
      <div
        ref={dialogRef}
        className={`month-picker date-picker${
          position ? " is-positioned" : ""
        }${isClosing ? " is-closing" : ""}`}
        style={
          position
            ? ({
                top: position.top,
                left: position.left,
                "--picker-origin-x": `${position.originX}px`
              } as CSSProperties)
            : undefined
        }
        role="dialog"
        aria-modal="true"
        aria-label="Choose date"
        tabIndex={-1}
      >
        <header className="month-picker__header">
          {view === "days" ? (
            <button
              className="date-picker__period"
              type="button"
              aria-label={`Choose month, currently ${monthLongLabels[visibleMonth.monthIndex]} ${visibleMonth.year}`}
              onClick={openMonthView}
            >
              <span>
                {monthLongLabels[visibleMonth.monthIndex]} {visibleMonth.year}
              </span>
              <ChevronRight
                className="date-picker__period-disclosure"
                aria-hidden="true"
              />
            </button>
          ) : (
            <strong aria-live="polite">{visibleYear}</strong>
          )}

          <div className="month-picker__header-actions">
            <button
              type="button"
              disabled={
                view === "days"
                  ? visibleMonthIndex <= minimumMonthIndex
                  : visibleYear <= minimumParts.year
              }
              aria-label={
                view === "days" ? "Previous month" : "Previous year"
              }
              onClick={() =>
                view === "days"
                  ? scrollToMonth(visibleMonthIndex - 1)
                  : scrollToYear(visibleYear - 1)
              }
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={
                view === "days"
                  ? visibleMonthIndex >= maximumMonthIndex
                  : visibleYear >= maximumParts.year
              }
              aria-label={view === "days" ? "Next month" : "Next year"}
              onClick={() =>
                view === "days"
                  ? scrollToMonth(visibleMonthIndex + 1)
                  : scrollToYear(visibleYear + 1)
              }
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </header>

        {view === "days" ? (
          <>
            <div className="date-picker__weekdays" aria-hidden="true">
              {weekdayLabels.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>
            <div
              ref={dayViewportRef}
              className="month-picker__viewport"
              onWheel={handleWheel}
              onScroll={handleDayScroll}
            >
              <div className="month-picker__track">
                {monthIndexes.map((monthIndex) => {
                  const month = getMonthParts(monthIndex);
                  const monthKey = getMonthKey(monthIndex);
                  const dayCells = getDayCells(
                    month.year,
                    month.monthIndex
                  );

                  return (
                    <div
                      className={`date-picker__day-grid${
                        dayCells.length === sixWeekCalendarCellCount
                          ? " is-six-weeks"
                          : ""
                      }`}
                      key={monthKey}
                      role="grid"
                      aria-label={`${monthLabels[month.monthIndex]} ${month.year}`}
                      aria-hidden={monthIndex !== visibleMonthIndex}
                    >
                      {dayCells.map((day, cellIndex) => {
                        if (day === null) {
                          return (
                            <span
                              key={`empty-${cellIndex}`}
                              aria-hidden="true"
                            />
                          );
                        }

                        const date = getDateKey(
                          month.year,
                          month.monthIndex,
                          day
                        );
                        const disabled =
                          date < minimumDate || date > maximumDate;
                        const selected = date === value;
                        const rangeBoundary =
                          date === rangeStart || date === rangeEnd;
                        const inRange =
                          hasCompleteRange &&
                          date > rangeStart &&
                          date < rangeEnd;
                        const current = date === today;
                        const className = [
                          selected ? "is-selected" : "",
                          date === rangeStart ? "is-range-start" : "",
                          date === rangeEnd ? "is-range-end" : "",
                          rangeBoundary ? "is-range-boundary" : "",
                          hasCompleteRange ? "has-complete-range" : "",
                          inRange ? "is-in-range" : "",
                          current ? "is-current" : ""
                        ]
                          .filter(Boolean)
                          .join(" ");

                        return (
                          <button
                            key={date}
                            type="button"
                            role="gridcell"
                            disabled={disabled}
                            tabIndex={
                              monthIndex === visibleMonthIndex
                                ? undefined
                                : -1
                            }
                            className={className || undefined}
                            aria-selected={
                              selected || rangeBoundary || inRange
                            }
                            aria-current={current ? "date" : undefined}
                            onClick={() => {
                              if (monthIndex !== visibleMonthIndex) {
                                return;
                              }

                              const shouldClose = onSelect(date);

                              if (shouldClose !== false) {
                                requestClose();
                              }
                            }}
                          >
                            <span>{day}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div
            ref={monthViewportRef}
            className="month-picker__viewport"
            onWheel={handleWheel}
            onScroll={handleMonthScroll}
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
                    const month = getMonthIndex(year, monthIndex);
                    const monthKey = getMonthKey(month);
                    const disabled =
                      month < minimumMonthIndex ||
                      month > maximumMonthIndex;
                    const selected = month === visibleMonthIndex;
                    const current = monthKey === currentMonth;
                    const className = [
                      selected ? "is-selected" : "",
                      current ? "is-current" : ""
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <button
                        key={monthKey}
                        type="button"
                        disabled={disabled}
                        tabIndex={year === visibleYear ? undefined : -1}
                        className={className || undefined}
                        aria-pressed={selected}
                        aria-current={current ? "date" : undefined}
                        onClick={() => {
                          if (year === visibleYear) {
                            selectMonth(month);
                          }
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
        )}
      </div>
    </div>,
    document.body
  );
}
