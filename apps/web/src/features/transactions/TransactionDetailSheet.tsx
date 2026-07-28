import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useRef,
  useState
} from "react";
import { ArrowRight, X } from "lucide-react";
import { createPortal } from "react-dom";

import { SlidingSegmentedControl } from "../../components/ui/SlidingSegmentedControl";
import { parseLocalDateOnly } from "../../dates/date-only";
import { formatEuroAmount } from "../../money/format-euro";
import { getCategoryIcon } from "./category-catalog";

type TransactionDetailSheetProps = {
  transactionId: string | null;
  onClose: () => void;
};

type TransactionDetailScope = "MONTH" | "YEAR" | "ALL";

type DragGesture = {
  pointerId: number;
  startY: number;
  startedAt: number;
};

const CLOSE_DISTANCE_PX = 88;
const CLOSE_VELOCITY_PX_PER_MS = 0.55;

const detailScopeOptions = [
  { value: "MONTH", label: "Month" },
  { value: "YEAR", label: "Year" },
  { value: "ALL", label: "All" }
] as const;

const mockTransaction = {
  type: "EXPENSE" as const,
  categoryId: "expense-groceries",
  categoryName: "Groceries",
  title: "Weekly groceries",
  amount: -84.6,
  date: "2026-07-26",
  balanceBefore: 4286.4,
  balanceAfter: 4201.8,
  context: {
    MONTH: {
      period: "July 2026",
      categoryRank: 2,
      categoryTotal: 5,
      typeRank: 8,
      typeTotal: 31,
      periodImpact: 7
    },
    YEAR: {
      period: "2026",
      categoryRank: 5,
      categoryTotal: 42,
      typeRank: 24,
      typeTotal: 214,
      periodImpact: 0.8
    },
    ALL: {
      period: "All time",
      categoryRank: 14,
      categoryTotal: 126,
      typeRank: 63,
      typeTotal: 642,
      periodImpact: 0.3
    }
  }
};

function formatFullDate(value: string) {
  const date = parseLocalDateOnly(value);

  if (!date) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatPeriodImpact(value: number) {
  if (value > 0 && value < 1) {
    return `${value.toLocaleString("es-ES", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    })}%`;
  }

  return `${Math.round(value).toLocaleString("es-ES")}%`;
}

export function TransactionDetailSheet({
  transactionId,
  onClose
}: TransactionDetailSheetProps) {
  const open = transactionId !== null;
  const titleId = useId();
  const dateId = useId();
  const sheetRef = useRef<HTMLElement>(null);
  const dragGesture = useRef<DragGesture | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const [scope, setScope] = useState<TransactionDetailScope>("MONTH");
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const CategoryIcon = getCategoryIcon(
    mockTransaction.categoryId,
    mockTransaction.type
  );
  const context = mockTransaction.context[scope];

  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      dragGesture.current = null;
      setDragOffset(0);
      setIsDragging(false);
      return;
    }

    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setScope("MONTH");

    const focusFrame = requestAnimationFrame(() => {
      sheetRef.current?.focus({ preventScroll: true });
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const controls = sheetRef.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled)"
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
      previousFocus.current?.focus({ preventScroll: true });
    };
  }, [open, transactionId]);

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    dragGesture.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startedAt: performance.now()
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = dragGesture.current;

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    setDragOffset(Math.max(0, event.clientY - gesture.startY));
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = dragGesture.current;

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    const distance = Math.max(0, event.clientY - gesture.startY);
    const duration = Math.max(1, performance.now() - gesture.startedAt);
    const velocity = distance / duration;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragGesture.current = null;
    setIsDragging(false);
    setDragOffset(0);

    if (
      distance >= CLOSE_DISTANCE_PX ||
      (distance >= 24 && velocity >= CLOSE_VELOCITY_PX_PER_MS)
    ) {
      onClose();
    }
  }

  function cancelDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragGesture.current?.pointerId !== event.pointerId) {
      return;
    }

    dragGesture.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }

  return createPortal(
    <div
      className={`transaction-detail-backdrop${open ? " is-open" : ""}`}
      aria-hidden={!open}
      inert={!open}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <article
        ref={sheetRef}
        className={`transaction-detail-sheet transaction-detail-sheet--${mockTransaction.type.toLowerCase()}${
          isDragging ? " is-dragging" : ""
        }`}
        style={
          {
            "--transaction-detail-drag-offset": `${dragOffset}px`
          } as CSSProperties
        }
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={dateId}
      >
        <div
          className="transaction-detail-sheet__drag-region"
          aria-hidden="true"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={finishDrag}
          onPointerCancel={cancelDrag}
        >
          <span />
        </div>

        <div className="transaction-detail-sheet__toolbar">
          <span aria-hidden="true" />
          <button
            type="button"
            aria-label="Close transaction details"
            title="Close"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="transaction-detail-sheet__scroll-area">
          <div className="transaction-detail-sheet__content">
            <header className="transaction-detail-hero">
              <span className="transaction-detail-hero__icon" aria-hidden="true">
                <CategoryIcon />
              </span>
              <p>{mockTransaction.categoryName}</p>
              <h2 id={titleId}>{mockTransaction.title}</h2>
              <strong>
                {formatEuroAmount(mockTransaction.amount, { showSign: true })}
              </strong>
              <time id={dateId} dateTime={mockTransaction.date}>
                {formatFullDate(mockTransaction.date)}
              </time>
            </header>

            <section
              className="transaction-detail-section"
              aria-label="Balance impact"
            >
              <div className="transaction-balance-flow">
                <span>
                  <small>Before</small>
                  <strong>
                    {formatEuroAmount(mockTransaction.balanceBefore)}
                  </strong>
                </span>
                <ArrowRight aria-hidden="true" />
                <span>
                  <small>After</small>
                  <strong>{formatEuroAmount(mockTransaction.balanceAfter)}</strong>
                </span>
              </div>
            </section>

            <section
              className="transaction-detail-section transaction-detail-context"
              aria-labelledby="transaction-context-title"
            >
              <div className="transaction-detail-section__heading">
                <h3 id="transaction-context-title">Context</h3>
                <span>{context.period}</span>
              </div>

              <SlidingSegmentedControl
                className="transaction-detail-context__scope"
                value={scope}
                options={detailScopeOptions}
                label="Transaction ranking period"
                compact
                allowDrag={false}
                onChange={setScope}
              />

              <dl className="transaction-detail-context__rows">
                <div>
                  <dt>
                    Category rank
                    <span>
                      Among {context.categoryTotal}{" "}
                      {mockTransaction.categoryName.toLowerCase()} expenses
                    </span>
                  </dt>
                  <dd>#{context.categoryRank}</dd>
                </div>
                <div>
                  <dt>
                    Expense rank
                    <span>Among {context.typeTotal} expenses</span>
                  </dt>
                  <dd>#{context.typeRank}</dd>
                </div>
                <div>
                  <dt>
                    Period impact
                    <span>
                      Share of expenses during {context.period.toLowerCase()}
                    </span>
                  </dt>
                  <dd>{formatPeriodImpact(context.periodImpact)}</dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </article>
    </div>,
    document.body
  );
}
