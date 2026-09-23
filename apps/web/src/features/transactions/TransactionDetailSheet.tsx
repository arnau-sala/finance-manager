import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Ellipsis,
  Layers,
  Pencil,
  Share,
  Trash2,
  X
} from "lucide-react";
import { createPortal } from "react-dom";

import { ActionButton } from "../../components/ui/ActionButton";
import { SkeletonBlock } from "../../components/ui/SkeletonBlock";
import { SlidingSegmentedControl } from "../../components/ui/SlidingSegmentedControl";
import { formatErrorMessage } from "../../components/ui/error-message";
import { prefetchScheduler } from "../../cache/prefetch-scheduler";
import { parseLocalDateOnly } from "../../dates/date-only";
import {
  formatEuroAmount,
  formatMoneyAmount
} from "../../money/format-euro";
import { getCategoryIcon } from "./category-catalog";
import {
  deleteTransaction,
  transactionDetailQueryOptions,
  TransactionApiError,
  type TransactionDetail,
  type TransactionDetailContext,
  type TransactionPreview
} from "./transaction-api";
import { shareTransaction } from "./transaction-share";

type TransactionDetailSheetProps = {
  ownerId: string;
  transaction: TransactionPreview | null;
  suspended: boolean;
  onClose: () => void;
  onDeleted: () => void;
  onEdit: (transaction: TransactionPreview) => void;
  onAddRelatedTransactions: (transaction: TransactionPreview) => void;
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
const DELETE_CONFIRM_EXIT_ANIMATION_MS = 120;

const detailScopeOptions = [
  { value: "MONTH", label: "Month" },
  { value: "YEAR", label: "Year" },
  { value: "ALL", label: "All" }
] as const;

function addSoftHyphens(value: string) {
  return Array.from(value).join("\u00ad");
}

function TransactionDetailTitle({
  id,
  value
}: {
  id: string;
  value: string;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [displayValue, setDisplayValue] = useState(value);

  useLayoutEffect(() => {
    const title = titleRef.current;
    const container = title?.parentElement;

    if (!title || !container) {
      setDisplayValue(value);
      return;
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      setDisplayValue(value);
      return;
    }

    const titleElement = title;
    const containerElement = container;
    const measurementContext = context;
    let active = true;

    function updateTitle() {
      if (!active) {
        return;
      }

      const styles = window.getComputedStyle(titleElement);
      const availableWidth =
        containerElement.getBoundingClientRect().width;

      if (availableWidth <= 0) {
        return;
      }

      measurementContext.font = [
        styles.fontStyle,
        styles.fontWeight,
        styles.fontSize,
        styles.fontFamily
      ].join(" ");

      const nextValue = value
        .split(/(\s+)/)
        .map((part) =>
          /\s+/.test(part) ||
          measurementContext.measureText(part).width <= availableWidth
            ? part
            : addSoftHyphens(part)
        )
        .join("");

      setDisplayValue(nextValue);
    }

    updateTitle();

    const resizeObserver = new ResizeObserver(updateTitle);
    resizeObserver.observe(containerElement);

    void document.fonts?.ready.then(updateTitle);

    return () => {
      active = false;
      resizeObserver.disconnect();
    };
  }, [value]);

  return (
    <h2 ref={titleRef} id={id} aria-label={value}>
      {displayValue}
    </h2>
  );
}

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

function TransactionContextSkeleton() {
  return (
    <dl
      className="transaction-detail-context__rows transaction-detail-context__rows--skeleton"
      aria-label="Loading transaction context"
      aria-busy="true"
    >
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index}>
          <dt>
            <SkeletonBlock width={index === 2 ? 82 : 96} height={13} />
            <SkeletonBlock width={index === 2 ? 150 : 186} height={11} />
          </dt>
          <dd>
            <SkeletonBlock width={42} height={18} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function TransactionBalanceValue({
  value,
  unavailable
}: {
  value: number | string | undefined;
  unavailable: boolean;
}) {
  if (value !== undefined) {
    return formatEuroAmount(value);
  }

  if (unavailable) {
    return "Unavailable";
  }

  return (
    <SkeletonBlock
      className="transaction-detail-skeleton__balance"
      width={84}
      height={18}
    />
  );
}

function getTransactionDisplayAmount(transaction: TransactionPreview | null) {
  if (!transaction) {
    return 0;
  }

  return transaction.currency === "USD"
    ? transaction.originalAmount ?? transaction.amount
    : transaction.amount;
}

function getUsdTransactionEuroEquivalent(
  transaction: TransactionPreview | null
) {
  if (!transaction || transaction.currency !== "USD") {
    return null;
  }

  const equivalent = Number(transaction.baseAmount ?? transaction.amount);

  return Number.isFinite(equivalent) ? equivalent : null;
}

function formatRateDecimal(value: string | number) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "unavailable";
  }

  const formattedValue = numericValue.toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
    useGrouping: false
  });

  if (!formattedValue.includes(",")) {
    return formattedValue;
  }

  return formattedValue.replace(/0+$/, "").replace(/,$/, "");
}

function getUsdTransactionRateLabels(transaction: TransactionPreview | null) {
  if (!transaction || transaction.currency !== "USD") {
    return null;
  }

  const explicitRate =
    transaction.exchangeRateBasePerUsd === null ||
    transaction.exchangeRateBasePerUsd === undefined
      ? null
      : Number(transaction.exchangeRateBasePerUsd);
  const originalAmount = Number(transaction.originalAmount);
  const baseAmount = Number(transaction.baseAmount ?? transaction.amount);
  const calculatedRate =
    Number.isFinite(originalAmount) &&
    originalAmount > 0 &&
    Number.isFinite(baseAmount) &&
    baseAmount > 0
      ? baseAmount / originalAmount
      : null;
  const basePerUsd =
    explicitRate !== null && Number.isFinite(explicitRate) && explicitRate > 0
      ? explicitRate
      : calculatedRate;

  if (basePerUsd === null || !Number.isFinite(basePerUsd) || basePerUsd <= 0) {
    return null;
  }

  return {
    exchangeRate: `1$ = ${formatRateDecimal(basePerUsd)}\u20ac`,
    reverse: `1\u20ac = ${formatRateDecimal(1 / basePerUsd)}$`
  };
}

export function TransactionDetailSheet({
  ownerId,
  transaction,
  suspended,
  onClose,
  onDeleted,
  onEdit,
  onAddRelatedTransactions,
  onSessionExpired
}: TransactionDetailSheetProps) {
  const open = transaction !== null;
  const titleId = useId();
  const dateId = useId();
  const deleteTitleId = useId();
  const sheetRef = useRef<HTMLElement>(null);
  const deleteConfirmRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const dragGesture = useRef<DragGesture | null>(null);
  const dismissSwipeGesture = useRef<DismissSwipeGesture | null>(null);
  const suppressClickUntil = useRef(0);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const suspendedRef = useRef(suspended);
  const deleteConfirmOpenRef = useRef(false);
  const isDeletingRef = useRef(false);
  const deleteConfirmCloseTimerRef = useRef<number | null>(null);
  const shareNoticeTimerRef = useRef<number | null>(null);
  const renderedTransactionRef = useRef<TransactionPreview | null>(null);
  const [scope, setScope] = useState<TransactionDetailScope>("MONTH");
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsRendered, setActionsRendered] = useState(false);
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const [actionsInteractive, setActionsInteractive] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmClosing, setDeleteConfirmClosing] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!deleteConfirmOpen || deleteConfirmClosing) {
      return;
    }

    const focusFrame = requestAnimationFrame(() => {
      deleteConfirmRef.current?.focus({ preventScroll: true });
    });

    return () => cancelAnimationFrame(focusFrame);
  }, [deleteConfirmClosing, deleteConfirmOpen]);
  const transactionId = transaction?.id ?? "";
  const detailQuery = useQuery({
    ...transactionDetailQueryOptions(ownerId, transactionId),
    enabled: transaction !== null
  });
  const detail = detailQuery.data ?? null;

  if (transaction) {
    renderedTransactionRef.current = transaction;
  }

  const renderedTransaction = transaction ?? renderedTransactionRef.current;
  const matchingDetail =
    detail && detail.transaction.id === renderedTransaction?.id ? detail : null;
  const matchingError =
    detailQuery.isError && transactionId === renderedTransaction?.id
      ? detailQuery.error instanceof Error
        ? detailQuery.error.message
        : "Unable to load the transaction details"
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
  const displayedAmount = Number(getTransactionDisplayAmount(displayedTransaction));
  const displayedCurrency = displayedTransaction?.currency ?? "EUR";
  const signedAmount =
    displayedTransaction?.type === "INCOME"
      ? Math.abs(displayedAmount)
      : -Math.abs(displayedAmount);
  const euroEquivalent = getUsdTransactionEuroEquivalent(displayedTransaction);
  const usdRateLabels = getUsdTransactionRateLabels(displayedTransaction);

  onCloseRef.current = onClose;
  suspendedRef.current = suspended;
  deleteConfirmOpenRef.current = deleteConfirmOpen;
  isDeletingRef.current = isDeleting;

  function openDeleteConfirm() {
    if (deleteConfirmCloseTimerRef.current !== null) {
      window.clearTimeout(deleteConfirmCloseTimerRef.current);
      deleteConfirmCloseTimerRef.current = null;
    }

    setDeleteError(null);
    setDeleteConfirmClosing(false);
    setDeleteConfirmOpen(true);
  }

  function closeDeleteConfirm({ immediate = false } = {}) {
    if (deleteConfirmCloseTimerRef.current !== null) {
      window.clearTimeout(deleteConfirmCloseTimerRef.current);
      deleteConfirmCloseTimerRef.current = null;
    }

    if (immediate || !deleteConfirmOpenRef.current) {
      setDeleteConfirmClosing(false);
      setDeleteConfirmOpen(false);
      setDeleteError(null);
      return;
    }

    setDeleteConfirmClosing(true);
    deleteConfirmCloseTimerRef.current = window.setTimeout(() => {
      deleteConfirmCloseTimerRef.current = null;
      setDeleteConfirmClosing(false);
      setDeleteConfirmOpen(false);
      setDeleteError(null);
    }, DELETE_CONFIRM_EXIT_ANIMATION_MS);
  }

  useEffect(() => {
    if (!open) {
      dragGesture.current = null;
      dismissSwipeGesture.current = null;
      setActionsOpen(false);
      closeDeleteConfirm({ immediate: true });
      setIsDeleting(false);
      setIsSharing(false);
      setShareNotice(null);
      setDragOffset(0);
      setIsDragging(false);
      return;
    }

    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setActionsOpen(false);
    closeDeleteConfirm({ immediate: true });
    setIsDeleting(false);
    setIsSharing(false);
    setShareNotice(null);
    setScope("MONTH");

    const focusFrame = requestAnimationFrame(() => {
      sheetRef.current?.focus({ preventScroll: true });
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (suspendedRef.current) {
        return;
      }

      if (event.key === "Escape" && deleteConfirmOpenRef.current) {
        event.preventDefault();

        if (!isDeletingRef.current) {
          closeDeleteConfirm();
        }

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
        deleteConfirmOpenRef.current
          ? ".transaction-detail-delete-confirm button:not(:disabled)"
          : "button:not(:disabled)"
      );

      if (!controls?.length) {
        event.preventDefault();
        return;
      }

      const firstControl = controls[0];
      const lastControl = controls[controls.length - 1];

      if (
        deleteConfirmOpenRef.current &&
        !Array.from(controls).includes(
          document.activeElement as HTMLElement
        )
      ) {
        event.preventDefault();
        (event.shiftKey ? lastControl : firstControl).focus();
      } else if (
        event.shiftKey &&
        document.activeElement === firstControl
      ) {
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
      if (shareNoticeTimerRef.current !== null) {
        window.clearTimeout(shareNoticeTimerRef.current);
        shareNoticeTimerRef.current = null;
      }
      if (deleteConfirmCloseTimerRef.current !== null) {
        window.clearTimeout(deleteConfirmCloseTimerRef.current);
        deleteConfirmCloseTimerRef.current = null;
      }
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
    if (
      detailQuery.error instanceof TransactionApiError &&
      detailQuery.error.status === 401
    ) {
      onSessionExpired();
    }
  }, [detailQuery.error, onSessionExpired]);

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
      target.closest(".transaction-detail-sheet__action-menu") ||
      target.closest(".transaction-detail-delete-confirm") ||
      target.closest(".transaction-detail-sheet__delete-dismiss-layer") ||
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

  async function confirmDeleteTransaction() {
    if (!displayedTransaction || isDeleting) {
      return;
    }

    setDeleteError(null);
    setIsDeleting(true);
    prefetchScheduler.prioritizeUserRequest();

    try {
      await deleteTransaction(displayedTransaction.id);
      closeDeleteConfirm({ immediate: true });
      setActionsOpen(false);
      onDeleted();
    } catch (error) {
      if (error instanceof TransactionApiError && error.status === 401) {
        closeDeleteConfirm({ immediate: true });
        onSessionExpired();
        return;
      }

      setDeleteError(
        error instanceof Error
          ? error.message
          : "Unable to delete the transaction\nPlease try again"
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function showShareNotice(
    kind: "success" | "error",
    message: string
  ) {
    if (shareNoticeTimerRef.current !== null) {
      window.clearTimeout(shareNoticeTimerRef.current);
    }

    setShareNotice({ kind, message });
    shareNoticeTimerRef.current = window.setTimeout(() => {
      setShareNotice(null);
      shareNoticeTimerRef.current = null;
    }, 2800);
  }

  async function shareDisplayedTransaction() {
    if (!displayedTransaction || isSharing) {
      return;
    }

    setIsSharing(true);
    setShareNotice(null);

    try {
      const result = await shareTransaction(displayedTransaction);

      if (result === "shared" || result === "copied") {
        setActionsOpen(false);
      }

      if (result === "copied") {
        showShareNotice("success", "Transaction copied to clipboard");
      }
    } catch {
      setActionsOpen(false);
      showShareNotice(
        "error",
        "Unable to share this transaction\nPlease try again"
      );
    } finally {
      setIsSharing(false);
    }
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

          if (deleteConfirmOpen) {
            if (!isDeleting) {
              closeDeleteConfirm();
            }
          } else {
            onClose();
          }
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
        {deleteConfirmOpen ? (
          <div
            className="transaction-detail-sheet__delete-dismiss-layer"
            aria-hidden="true"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();

              if (!isDeleting) {
                closeDeleteConfirm();
              }
            }}
          />
        ) : null}

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
            <ActionButton
              shape="icon"
              type="button"
              className="transaction-detail-sheet__action-button"
              aria-label="More transaction actions"
              aria-haspopup="menu"
              aria-expanded={actionsOpen}
              title="More"
              disabled={isDeleting}
              onClick={() => {
                closeDeleteConfirm();
                setActionsOpen((current) => !current);
              }}
            >
              <Ellipsis aria-hidden="true" />
            </ActionButton>

            {actionsRendered ? (
              <div
                className={`transaction-detail-sheet__action-menu${
                  actionsExpanded ? " is-open" : ""
                }${actionsInteractive ? " is-interactive" : ""}`}
                role="menu"
                aria-label="Transaction actions"
              >
                <ActionButton
                  shape="icon"
                  type="button"
                  className="transaction-detail-sheet__floating-action transaction-detail-sheet__floating-action--share"
                  role="menuitem"
                  aria-label="Share transaction"
                  title="Share"
                  disabled={
                    !actionsInteractive || deleteConfirmOpen || isSharing
                  }
                  onClick={shareDisplayedTransaction}
                >
                  <Share aria-hidden="true" />
                </ActionButton>
                <ActionButton
                  shape="icon"
                  type="button"
                  className="transaction-detail-sheet__floating-action transaction-detail-sheet__floating-action--group"
                  role="menuitem"
                  aria-label="Edit transaction"
                  title="Edit"
                  disabled={!actionsInteractive || deleteConfirmOpen}
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
                </ActionButton>
                <ActionButton
                  shape="icon"
                  type="button"
                  className="transaction-detail-sheet__floating-action transaction-detail-sheet__floating-action--edit"
                  role="menuitem"
                  aria-label="Add related transactions"
                  title="Add related"
                  disabled={!actionsInteractive || deleteConfirmOpen}
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
                    onAddRelatedTransactions(displayedTransaction);
                  }}
                >
                  <Layers aria-hidden="true" />
                </ActionButton>
                <ActionButton
                  shape="icon"
                  type="button"
                  className="transaction-detail-sheet__floating-action transaction-detail-sheet__floating-action--delete"
                  role="menuitem"
                  aria-label="Delete transaction"
                  title="Delete"
                  disabled={!actionsInteractive || deleteConfirmOpen}
                  onClick={() => {
                    openDeleteConfirm();
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </ActionButton>
              </div>
            ) : null}

            {deleteConfirmOpen && displayedTransaction ? (
              <div
                ref={deleteConfirmRef}
                className={`transaction-detail-delete-confirm${
                  deleteConfirmClosing
                    ? " transaction-detail-delete-confirm--closing"
                    : ""
                }`}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={deleteTitleId}
                tabIndex={-1}
              >
                <strong id={deleteTitleId}>Delete permanently?</strong>
                <span className="transaction-detail-delete-confirm__summary">
                  <span>{displayedTransaction.description}</span>
                  <b>
                    {formatMoneyAmount(signedAmount, {
                      currency: displayedCurrency,
                      showSign: true
                    })}
                  </b>
                </span>

                {deleteError ? (
                  <p
                    className="transaction-detail-delete-confirm__error"
                    role="alert"
                  >
                    {formatErrorMessage(deleteError)}
                  </p>
                ) : null}

                <div className="transaction-detail-delete-confirm__actions">
                  <ActionButton
                    type="button"
                    disabled={isDeleting}
                    onClick={() => {
                      closeDeleteConfirm();
                    }}
                  >
                    Cancel
                  </ActionButton>
                  <ActionButton
                    type="button"
                    className="transaction-detail-delete-confirm__submit"
                    disabled={isDeleting}
                    onClick={confirmDeleteTransaction}
                  >
                    {isDeleting ? "Deleting" : "Delete"}
                  </ActionButton>
                </div>
              </div>
            ) : null}
          </div>

          <ActionButton
            shape="icon"
            type="button"
            className="transaction-detail-sheet__close"
            aria-label="Close transaction details"
            title="Close"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </ActionButton>
        </div>

        {shareNotice ? (
          <p
            className={`transaction-detail-sheet__share-notice transaction-detail-sheet__share-notice--${shareNotice.kind}`}
            role={shareNotice.kind === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {shareNotice.kind === "error"
              ? formatErrorMessage(shareNotice.message)
              : shareNotice.message}
          </p>
        ) : null}

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
                  <TransactionDetailTitle
                    id={titleId}
                    value={displayedTransaction.description}
                  />
                  <strong>
                    {formatMoneyAmount(signedAmount, {
                      currency: displayedCurrency,
                      showSign: true
                    })}
                  </strong>
                  {euroEquivalent !== null ? (
                    <span className="transaction-detail-hero__secondary-amount">
                      {formatMoneyAmount(Math.abs(euroEquivalent), {
                        currency: "EUR"
                      })}
                    </span>
                  ) : null}
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
                        <TransactionBalanceValue
                          value={matchingDetail?.trackedBalance.before}
                          unavailable={Boolean(matchingError)}
                        />
                      </strong>
                    </span>
                    <ArrowRight aria-hidden="true" />
                    <span>
                      <small>After</small>
                      <strong>
                        <TransactionBalanceValue
                          value={matchingDetail?.trackedBalance.after}
                          unavailable={Boolean(matchingError)}
                        />
                      </strong>
                    </span>
                  </div>
                </section>

                {usdRateLabels ? (
                  <section
                    className="transaction-detail-section"
                    aria-label="Exchange rates"
                  >
                    <div className="currency-exchange-rates">
                      <span>
                        <small>Exchange rate</small>
                        <strong>{usdRateLabels.exchangeRate}</strong>
                      </span>
                      <span>
                        <small>Reverse</small>
                        <strong>{usdRateLabels.reverse}</strong>
                      </span>
                    </div>
                  </section>
                ) : null}

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
                      {formatErrorMessage(matchingError)}
                    </p>
                  ) : !context ? (
                    <TransactionContextSkeleton />
                  ) : (
                    <dl className="transaction-detail-context__rows">
                      <div>
                        <dt>
                          Category rank
                          <span>
                            Among {context.categoryRank.total}{" "}
                            {displayedTransaction.category.name.toLowerCase()}{" "}
                            transactions
                          </span>
                        </dt>
                        <dd>#{context.categoryRank.position}</dd>
                      </div>
                      <div>
                        <dt>
                          {typeLabel} rank
                          <span>
                            Among {context.typeRank.total} {typeRankCollection}
                          </span>
                        </dt>
                        <dd>#{context.typeRank.position}</dd>
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
                          {formatPeriodImpact(
                            context.periodImpactPercentage
                          )}
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
