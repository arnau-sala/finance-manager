import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useRef,
  useState
} from "react";
import {
  ArrowRight,
  Ellipsis,
  Pencil,
  Share,
  Trash2,
  X
} from "lucide-react";
import { createPortal } from "react-dom";

import { SlidingSegmentedControl } from "../../components/ui/SlidingSegmentedControl";
import { parseLocalDateOnly } from "../../dates/date-only";
import { formatEuroAmount } from "../../money/format-euro";
import { getCategoryIcon } from "./category-catalog";
import {
  getTransactionDetail,
  TransactionApiError,
  type TransactionDetail,
  type TransactionDetailContext,
  type TransactionPreview
} from "./transaction-api";

type TransactionDetailSheetProps = {
  ownerId: string;
  transaction: TransactionPreview | null;
  refreshKey: number;
  suspended: boolean;
  onClose: () => void;
  onEdit: (transaction: TransactionPreview) => void;
  onSessionExpired: () => void;
};

type TransactionDetailScope = "MONTH" | "YEAR" | "ALL";

type DragGesture = {
  pointerId: number;
  startY: number;
  startedAt: number;
};

type DismissSwipeGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  startedAt: number;
};

const CLOSE_DISTANCE_PX = 88;
const CLOSE_VELOCITY_PX_PER_MS = 0.55;
const DISMISS_SWIPE_DISTANCE_PX = 48;
const DISMISS_SWIPE_MAX_DURATION_MS = 700;
const ACTIONS_ANIMATION_MS = 220;

const detailScopeOptions = [
  { value: "MONTH", label: "Month" },
  { value: "YEAR", label: "Year" },
  { value: "ALL", label: "All" }
] as const;

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

function formatContextPeriod(
  dateValue: string,
  scope: TransactionDetailScope
) {
  if (scope === "ALL") {
    return "All time";
  }

  const date = parseLocalDateOnly(dateValue);

  if (!date) {
    return "Unknown period";
  }

  if (scope === "YEAR") {
    return String(date.getFullYear());
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(date);
}

function getContext(
  detail: TransactionDetail | null,
  scope: TransactionDetailScope
): TransactionDetailContext | null {
  if (!detail) {
    return null;
  }

  if (scope === "MONTH") {
    return detail.contexts.month;
  }

  if (scope === "YEAR") {
    return detail.contexts.year;
  }

  return detail.contexts.all;
}

export function TransactionDetailSheet({
  ownerId,
  transaction,
  refreshKey,
  suspended,
  onClose,
  onEdit,
  onSessionExpired
}: TransactionDetailSheetProps) {
  const open = transaction !== null;
  const titleId = useId();
  const dateId = useId();
  const sheetRef = useRef<HTMLElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const dragGesture = useRef<DragGesture | null>(null);
  const dismissSwipeGesture = useRef<DismissSwipeGesture | null>(null);
  const suppressClickUntil = useRef(0);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const suspendedRef = useRef(suspended);
  const renderedTransactionRef = useRef<TransactionPreview | null>(null);
  const [scope, setScope] = useState<TransactionDetailScope>("MONTH");
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsRendered, setActionsRendered] = useState(false);
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const [actionsInteractive, setActionsInteractive] = useState(false);
  const [detailError, setDetailError] = useState<{
    transactionId: string;
    message: string;
  } | null>(null);

  if (transaction) {
    renderedTransactionRef.current = transaction;
  }

  const renderedTransaction = transaction ?? renderedTransactionRef.current;
  const matchingDetail =
    detail && detail.transaction.id === renderedTransaction?.id ? detail : null;
  const matchingError =
    detailError && detailError.transactionId === renderedTransaction?.id
      ? detailError.message
      : null;
  const displayedTransaction =
    matchingDetail?.transaction ?? renderedTransaction;
  const CategoryIcon = getCategoryIcon(
    displayedTransaction?.categoryId,
    displayedTransaction?.type ?? "EXPENSE"
  );
  const context = getContext(matchingDetail, scope);
  const contextPeriod = displayedTransaction
    ? formatContextPeriod(displayedTransaction.date, scope)
    : "";
  const typeLabel =
    displayedTransaction?.type === "INCOME" ? "Income" : "Expense";
  const typeRankCollection =
    displayedTransaction?.type === "INCOME"
      ? "income transactions"
      : "expenses";
  const typeImpactCollection =
    displayedTransaction?.type === "INCOME" ? "income" : "expenses";
  const displayedAmount = Number(displayedTransaction?.amount ?? 0);
  const signedAmount =
    displayedTransaction?.type === "INCOME"
      ? Math.abs(displayedAmount)
      : -Math.abs(displayedAmount);

  onCloseRef.current = onClose;
  suspendedRef.current = suspended;

  useEffect(() => {
    if (!open) {
      dragGesture.current = null;
      dismissSwipeGesture.current = null;
      setActionsOpen(false);
      setDragOffset(0);
      setIsDragging(false);
      return;
    }

    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setActionsOpen(false);
    setScope("MONTH");

    const focusFrame = requestAnimationFrame(() => {
      sheetRef.current?.focus({ preventScroll: true });
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (suspendedRef.current) {
        return;
      }

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
  }, [open, transaction?.id]);

  useEffect(() => {
    setActionsInteractive(false);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (actionsOpen) {
      setActionsRendered(true);

      if (reduceMotion) {
        setActionsExpanded(true);
        setActionsInteractive(true);
        return;
      }

      const expansionFrame = requestAnimationFrame(() => {
        setActionsExpanded(true);
      });
      const interactionTimer = window.setTimeout(() => {
        setActionsInteractive(true);
      }, ACTIONS_ANIMATION_MS);

      return () => {
        cancelAnimationFrame(expansionFrame);
        window.clearTimeout(interactionTimer);
      };
    }

    setActionsExpanded(false);

    if (!actionsRendered) {
      return;
    }

    if (reduceMotion) {
      setActionsRendered(false);
      return;
    }

    const unmountTimer = window.setTimeout(() => {
      setActionsRendered(false);
    }, ACTIONS_ANIMATION_MS);

    return () => window.clearTimeout(unmountTimer);
  }, [actionsOpen, actionsRendered]);

  useEffect(() => {
    if (!transaction) {
      return;
    }

    const controller = new AbortController();
    setDetail(null);
    setDetailError(null);

    getTransactionDetail(ownerId, transaction.id, controller.signal)
      .then((loadedDetail) => {
        setDetail(loadedDetail);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        if (error instanceof TransactionApiError && error.status === 401) {
          onSessionExpired();
          return;
        }

        setDetailError({
          transactionId: transaction.id,
          message:
            error instanceof Error
              ? error.message
              : "Unable to load the transaction details."
        });
      });

    return () => controller.abort();
  }, [onSessionExpired, ownerId, refreshKey, transaction?.id]);

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

  function startDismissSwipe(event: ReactPointerEvent<HTMLElement>) {
    const target = event.target;
    const scrollArea = scrollAreaRef.current;

    if (
      event.pointerType === "mouse" ||
      !(target instanceof Element) ||
      target.closest(".transaction-detail-sheet__drag-region") ||
      !scrollArea ||
      scrollArea.scrollHeight > scrollArea.clientHeight + 1
    ) {
      dismissSwipeGesture.current = null;
      return;
    }

    dismissSwipeGesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: performance.now()
    };
  }

  function finishDismissSwipe(event: ReactPointerEvent<HTMLElement>) {
    const gesture = dismissSwipeGesture.current;

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    dismissSwipeGesture.current = null;

    const horizontalDistance = event.clientX - gesture.startX;
    const verticalDistance = event.clientY - gesture.startY;
    const duration = performance.now() - gesture.startedAt;
    const isDownwardSwipe =
      verticalDistance >= DISMISS_SWIPE_DISTANCE_PX &&
      verticalDistance > Math.abs(horizontalDistance) &&
      duration <= DISMISS_SWIPE_MAX_DURATION_MS;

    if (!isDownwardSwipe) {
      return;
    }

    suppressClickUntil.current = performance.now() + 500;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  }

  return createPortal(
    <div
      className={`transaction-detail-backdrop${open ? " is-open" : ""}`}
      aria-hidden={!open || suspended}
      inert={!open || suspended}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <article
        ref={sheetRef}
        className={`transaction-detail-sheet transaction-detail-sheet--${(
          displayedTransaction?.type ?? "EXPENSE"
        ).toLowerCase()}${
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
        onPointerDownCapture={startDismissSwipe}
        onPointerUpCapture={finishDismissSwipe}
        onPointerCancel={() => {
          dismissSwipeGesture.current = null;
        }}
        onClickCapture={(event) => {
          if (performance.now() < suppressClickUntil.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
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
          <div className="transaction-detail-sheet__more">
            <button
              type="button"
              className="transaction-detail-sheet__action-button"
              aria-label="More transaction actions"
              aria-haspopup="menu"
              aria-expanded={actionsOpen}
              title="More"
              onClick={() => setActionsOpen((current) => !current)}
            >
              <Ellipsis aria-hidden="true" />
            </button>

            {actionsRendered ? (
              <div
                className={`transaction-detail-sheet__action-menu${
                  actionsExpanded ? " is-open" : ""
                }${actionsInteractive ? " is-interactive" : ""}`}
                role="menu"
                aria-label="Transaction actions"
              >
                <button
                  type="button"
                  className="transaction-detail-sheet__floating-action transaction-detail-sheet__floating-action--share"
                  role="menuitem"
                  aria-label="Share transaction"
                  title="Share"
                  disabled={!actionsInteractive}
                >
                  <Share aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="transaction-detail-sheet__floating-action transaction-detail-sheet__floating-action--edit"
                  role="menuitem"
                  aria-label="Edit transaction"
                  title="Edit"
                  disabled={!actionsInteractive}
                  onClick={() => {
                    if (!displayedTransaction) {
                      return;
                    }

                    sheetRef.current
                      ?.querySelector<HTMLElement>(
                        ".transaction-detail-sheet__action-button"
                      )
                      ?.focus({ preventScroll: true });
                    setActionsOpen(false);
                    onEdit(displayedTransaction);
                  }}
                >
                  <Pencil aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="transaction-detail-sheet__floating-action transaction-detail-sheet__floating-action--delete"
                  role="menuitem"
                  aria-label="Delete transaction"
                  title="Delete"
                  disabled={!actionsInteractive}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="transaction-detail-sheet__close"
            aria-label="Close transaction details"
            title="Close"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div
          ref={scrollAreaRef}
          className="transaction-detail-sheet__scroll-area"
        >
          <div className="transaction-detail-sheet__content">
            {displayedTransaction ? (
              <>
                <header className="transaction-detail-hero">
                  <span
                    className="transaction-detail-hero__icon"
                    aria-hidden="true"
                  >
                    <CategoryIcon />
                  </span>
                  <p>
                    {displayedTransaction.category.name} &middot; {typeLabel}
                  </p>
                  <h2 id={titleId}>{displayedTransaction.description}</h2>
                  <strong>
                    {formatEuroAmount(signedAmount, { showSign: true })}
                  </strong>
                  <time id={dateId} dateTime={displayedTransaction.date}>
                    {formatFullDate(displayedTransaction.date)}
                  </time>
                </header>

                <section
                  className="transaction-detail-section"
                  aria-label="Balance impact"
                  aria-busy={!matchingDetail && !matchingError}
                >
                  <div className="transaction-balance-flow">
                    <span>
                      <small>Before</small>
                      <strong>
                        {matchingDetail
                          ? formatEuroAmount(
                              matchingDetail.trackedBalance.before
                            )
                          : "--"}
                      </strong>
                    </span>
                    <ArrowRight aria-hidden="true" />
                    <span>
                      <small>After</small>
                      <strong>
                        {matchingDetail
                          ? formatEuroAmount(
                              matchingDetail.trackedBalance.after
                            )
                          : "--"}
                      </strong>
                    </span>
                  </div>
                </section>

                <section
                  className="transaction-detail-section transaction-detail-context"
                  aria-labelledby="transaction-context-title"
                  aria-busy={!matchingDetail && !matchingError}
                >
                  <div className="transaction-detail-section__heading">
                    <h3 id="transaction-context-title">Context</h3>
                    <span>{contextPeriod}</span>
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

                  {matchingError ? (
                    <p
                      className="transaction-detail-context__status"
                      role="alert"
                    >
                      {matchingError}
                    </p>
                  ) : (
                    <dl className="transaction-detail-context__rows">
                      <div>
                        <dt>
                          Category rank
                          <span>
                            {context
                              ? `Among ${context.categoryRank.total} ${displayedTransaction.category.name.toLowerCase()} transactions`
                              : "Loading category position"}
                          </span>
                        </dt>
                        <dd>
                          {context ? `#${context.categoryRank.position}` : "--"}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          {typeLabel} rank
                          <span>
                            {context
                              ? `Among ${context.typeRank.total} ${typeRankCollection}`
                              : `Loading ${typeRankCollection} position`}
                          </span>
                        </dt>
                        <dd>
                          {context ? `#${context.typeRank.position}` : "--"}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          Period impact
                          <span>
                            Share of {typeImpactCollection} during{" "}
                            {contextPeriod.toLowerCase()}
                          </span>
                        </dt>
                        <dd>
                          {context
                            ? formatPeriodImpact(
                                context.periodImpactPercentage
                              )
                            : "--"}
                        </dd>
                      </div>
                    </dl>
                  )}
                </section>
              </>
            ) : null}
          </div>
        </div>
      </article>
    </div>,
    document.body
  );
}
