import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Ellipsis,
  Pencil,
  Share,
  Trash2,
  X
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { invalidateAfterTransactionWrite } from "../../cache/financial-cache";
import { ActionButton } from "../../components/ui/ActionButton";
import { SkeletonBlock } from "../../components/ui/SkeletonBlock";
import { SlidingSegmentedControl } from "../../components/ui/SlidingSegmentedControl";
import { formatErrorMessage } from "../../components/ui/error-message";
import { parseLocalDateOnly } from "../../dates/date-only";
import {
  formatEuroAmount,
  formatMoneyAmount,
  type MoneyCurrencyCode
} from "../../money/format-euro";
import { getCategoryIcon } from "./category-catalog";
import {
  deleteTransactionGroup,
  transactionGroupDetailQueryOptions,
  type TransactionGroupDetail,
  type TransactionGroupListItem
} from "./transaction-groups-api";
import type { TransactionDetailContext } from "./transaction-api";

type TransactionGroupDetailSheetProps = {
  userId: string;
  group: TransactionGroupListItem | null;
  onClose: () => void;
  onEdit: (group: TransactionGroupListItem) => void;
  onDeleted: () => void;
};

type DragGesture = {
  pointerId: number;
  startY: number;
  startedAt: number;
  active: boolean;
  startedInScrollArea: boolean;
};

type TransactionDetailScope = "MONTH" | "YEAR" | "ALL";

const CLOSE_DISTANCE_PX = 88;
const CLOSE_VELOCITY_PX_PER_MS = 0.55;
const DRAG_ACTIVATION_DISTANCE_PX = 8;

const detailScopeOptions = [
  { value: "MONTH", label: "Month" },
  { value: "YEAR", label: "Year" },
  { value: "ALL", label: "All" }
] as const;

function formatDate(value: string) {
  const date = parseLocalDateOnly(value);

  if (!date) return value;

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

function formatRateDecimal(value: number) {
  const formattedValue = value.toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8
  });

  if (!formattedValue.includes(",")) {
    return formattedValue;
  }

  return formattedValue.replace(/0+$/, "").replace(/,$/, "");
}

function getUsdGroupRateLabels(group: TransactionGroupListItem) {
  if (group.displayCurrency !== "USD") {
    return null;
  }

  const explicitRate =
    group.displayExchangeRateBasePerUsd === null ||
    group.displayExchangeRateBasePerUsd === undefined
      ? null
      : Number(group.displayExchangeRateBasePerUsd);
  const displayAmount = Number(group.displayNetTotal ?? group.netTotal);
  const baseAmount = Number(group.displayBaseAmount ?? group.netTotal);
  const calculatedRate =
    Number.isFinite(displayAmount) &&
    Math.abs(displayAmount) > 0 &&
    Number.isFinite(baseAmount) &&
    Math.abs(baseAmount) > 0
      ? Math.abs(baseAmount) / Math.abs(displayAmount)
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
  detail: TransactionGroupDetail | null,
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
      aria-label="Loading transaction group context"
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

export function TransactionGroupDetailSheet({
  userId,
  group,
  onClose,
  onEdit,
  onDeleted
}: TransactionGroupDetailSheetProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const dragGesture = useRef<DragGesture | null>(null);
  const lastTouchY = useRef<number | null>(null);
  const topOverscrollIntent = useRef(0);
  const topOverscrollResetTimer = useRef<number | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [scope, setScope] = useState<TransactionDetailScope>("MONTH");
  const [renderedGroup, setRenderedGroup] =
    useState<TransactionGroupListItem | null>(group);

  useEffect(() => {
    if (!group) {
      setIsVisible(false);
      return;
    }

    setRenderedGroup(group);
    setIsVisible(false);
    setActionsOpen(false);
    setConfirmDelete(false);
    setDeleteError("");
    setDragOffset(0);
    setIsDragging(false);
    setScope("MONTH");
    topOverscrollIntent.current = 0;

    if (topOverscrollResetTimer.current !== null) {
      window.clearTimeout(topOverscrollResetTimer.current);
      topOverscrollResetTimer.current = null;
    }

    const openFrame = requestAnimationFrame(() => {
      if (backdropRef.current) {
        backdropRef.current.scrollTop = 0;
      }

      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = 0;
      }

      setIsVisible(true);
    });

    return () => cancelAnimationFrame(openFrame);
  }, [group]);

  useEffect(() => {
    return () => {
      if (topOverscrollResetTimer.current !== null) {
        window.clearTimeout(topOverscrollResetTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const backdrop = backdropRef.current;

    if (!isVisible || !backdrop) {
      return;
    }

    const backdropElement = backdrop;

    function resetTopOverscrollIntent() {
      topOverscrollIntent.current = 0;

      if (topOverscrollResetTimer.current !== null) {
        window.clearTimeout(topOverscrollResetTimer.current);
        topOverscrollResetTimer.current = null;
      }
    }

    function registerTopOverscrollIntent(delta: number) {
      topOverscrollIntent.current += Math.abs(delta);

      if (topOverscrollResetTimer.current !== null) {
        window.clearTimeout(topOverscrollResetTimer.current);
      }

      topOverscrollResetTimer.current = window.setTimeout(() => {
        topOverscrollIntent.current = 0;
        topOverscrollResetTimer.current = null;
      }, 180);

      if (topOverscrollIntent.current >= 72) {
        topOverscrollIntent.current = 0;
        onClose();
      }
    }

    function handleNativeWheel(event: WheelEvent) {
      if (confirmDelete || isDeleting) {
        return;
      }

      const maxScroll = getMaxSheetScroll();
      const currentScroll = backdropElement.scrollTop;

      if (event.deltaY > 0) {
        const remainingScroll = maxScroll - currentScroll;

        if (remainingScroll <= 0 || event.deltaY >= remainingScroll) {
          backdropElement.scrollTop = maxScroll;
          resetTopOverscrollIntent();
          event.preventDefault();
        }

        return;
      }

      if (currentScroll > 0 || event.deltaY >= 0) {
        resetTopOverscrollIntent();
        return;
      }

      event.preventDefault();
      registerTopOverscrollIntent(event.deltaY);
    }

    function handleNativeTouchStart(event: TouchEvent) {
      lastTouchY.current = event.touches[0]?.clientY ?? null;
    }

    function handleNativeTouchMove(event: TouchEvent) {
      if (confirmDelete || isDeleting) {
        return;
      }

      const previousY = lastTouchY.current;
      const currentY = event.touches[0]?.clientY ?? null;

      if (previousY === null || currentY === null) {
        lastTouchY.current = currentY;
        return;
      }

      const deltaY = previousY - currentY;
      lastTouchY.current = currentY;
      const maxScroll = getMaxSheetScroll();
      const currentScroll = backdropElement.scrollTop;
      const scrollBoundaryTolerance = 1;

      function preventNativeScroll() {
        if (event.cancelable) {
          event.preventDefault();
        }
      }

      if (deltaY < 0) {
        if (currentScroll <= scrollBoundaryTolerance) {
          backdropElement.scrollTop = 0;
          preventNativeScroll();
          registerTopOverscrollIntent(deltaY);
        } else if (currentScroll + deltaY < 0) {
          backdropElement.scrollTop = 0;
          preventNativeScroll();
          resetTopOverscrollIntent();
        } else {
          resetTopOverscrollIntent();
        }

        return;
      }

      if (deltaY === 0) {
        return;
      }

      resetTopOverscrollIntent();

      if (currentScroll >= maxScroll - scrollBoundaryTolerance) {
        backdropElement.scrollTop = maxScroll;
        preventNativeScroll();
        return;
      }

      if (currentScroll + deltaY > maxScroll) {
        backdropElement.scrollTop = maxScroll;
        preventNativeScroll();
      }
    }

    function handleNativeTouchEnd() {
      lastTouchY.current = null;
    }

    backdropElement.addEventListener("wheel", handleNativeWheel, { passive: false });
    backdropElement.addEventListener("touchstart", handleNativeTouchStart, {
      passive: true
    });
    backdropElement.addEventListener("touchmove", handleNativeTouchMove, {
      passive: false
    });
    backdropElement.addEventListener("touchend", handleNativeTouchEnd);
    backdropElement.addEventListener("touchcancel", handleNativeTouchEnd);

    return () => {
      backdropElement.removeEventListener("wheel", handleNativeWheel);
      backdropElement.removeEventListener("touchstart", handleNativeTouchStart);
      backdropElement.removeEventListener("touchmove", handleNativeTouchMove);
      backdropElement.removeEventListener("touchend", handleNativeTouchEnd);
      backdropElement.removeEventListener("touchcancel", handleNativeTouchEnd);
    };
  }, [confirmDelete, isDeleting, isVisible, onClose]);

  const displayedGroup = group ?? renderedGroup;
  const groupId = displayedGroup?.id ?? "";
  const detailQuery = useQuery({
    ...transactionGroupDetailQueryOptions(userId, groupId),
    enabled: displayedGroup !== null
  });
  const detail = detailQuery.data ?? null;

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const frame = requestAnimationFrame(clampSheetScroll);

    return () => cancelAnimationFrame(frame);
  }, [detail, isVisible, scope]);

  if (!displayedGroup) return null;

  const matchingDetail =
    detail && detail.group.id === displayedGroup.id ? detail : null;
  const matchingError =
    detailQuery.isError && groupId === displayedGroup.id
      ? detailQuery.error instanceof Error
        ? detailQuery.error.message
        : "Unable to load transaction group details"
      : null;
  const detailGroup = matchingDetail?.group ?? displayedGroup;
  const Icon = getCategoryIcon(
    detailGroup.categoryId,
    detailGroup.category.type
  );
  const netTotal = Number(detailGroup.netTotal);
  const displayCurrency = (detailGroup.displayCurrency ?? "EUR") as MoneyCurrencyCode;
  const displayNetTotal = Number(detailGroup.displayNetTotal ?? detailGroup.netTotal);
  const displayNetTotalCents =
    detailGroup.displayNetTotalCents ?? detailGroup.netTotalCents;
  const euroEquivalent =
    displayCurrency === "USD"
      ? Number(detailGroup.displayBaseAmount ?? detailGroup.netTotal)
      : null;
  const usdRateLabels = getUsdGroupRateLabels(detailGroup);
  const amountTone =
    netTotal > 0 ? "income" : netTotal < 0 ? "expense" : "neutral";
  const lineCount = detailGroup.transactions.length;
  const context = getContext(matchingDetail, scope);
  const contextPeriod = formatContextPeriod(detailGroup.date, scope);
  const groupTypeLabel =
    matchingDetail?.operationType === "INCOME" ? "Income" : "Expense";
  const typeRankCollection =
    matchingDetail?.operationType === "INCOME" ? "income operations" : "expenses";
  const typeImpactCollection =
    matchingDetail?.operationType === "INCOME" ? "income" : "expenses";

  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const target = event.target;

    if (
      target instanceof Element &&
      target.closest(
        "button, a, input, textarea, select, [role='menu'], .transaction-detail-delete-confirm, .transaction-detail-sheet__delete-dismiss-layer"
      )
    ) {
      return;
    }

    const startedInScrollArea =
      target instanceof Element &&
      target.closest(".transaction-detail-sheet__scroll-area") !== null;

    dragGesture.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startedAt: performance.now(),
      active: !startedInScrollArea,
      startedInScrollArea
    };

    if (!startedInScrollArea) {
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function moveDrag(event: ReactPointerEvent<HTMLElement>) {
    const gesture = dragGesture.current;

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    const distance = event.clientY - gesture.startY;

    if (!gesture.active) {
      if (Math.abs(distance) < DRAG_ACTIVATION_DISTANCE_PX) {
        return;
      }

      if (
        distance < 0 ||
        (gesture.startedInScrollArea && (backdropRef.current?.scrollTop ?? 0) > 0)
      ) {
        dragGesture.current = null;
        return;
      }

      gesture.active = true;
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    event.preventDefault();
    setDragOffset(Math.max(0, distance));
  }

  function finishDrag(event: ReactPointerEvent<HTMLElement>) {
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

    if (!gesture.active) {
      return;
    }

    if (
      distance >= CLOSE_DISTANCE_PX ||
      (distance >= 24 && velocity >= CLOSE_VELOCITY_PX_PER_MS)
    ) {
      onClose();
    }
  }

  function cancelDrag(event: ReactPointerEvent<HTMLElement>) {
    if (dragGesture.current?.pointerId !== event.pointerId) {
      return;
    }

    dragGesture.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }

  function getMaxSheetScroll() {
    const backdrop = backdropRef.current;

    if (!backdrop) {
      return 0;
    }

    return Math.max(0, backdrop.scrollHeight - backdrop.clientHeight);
  }

  function clampSheetScroll() {
    const backdrop = backdropRef.current;

    if (!backdrop) {
      return;
    }

    const maxScroll = getMaxSheetScroll();

    if (backdrop.scrollTop > maxScroll) {
      backdrop.scrollTop = maxScroll;
    }
  }

  async function confirmDeleteGroup() {
    const currentGroup = displayedGroup;

    if (!currentGroup) {
      return;
    }

    setIsDeleting(true);
    setDeleteError("");
    try {
      await deleteTransactionGroup(currentGroup.id);
      await invalidateAfterTransactionWrite(userId);
      onDeleted();
      onClose();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Unable to delete group");
    } finally {
      setIsDeleting(false);
    }
  }

  return createPortal(
    <div
      ref={backdropRef}
      className={`transaction-detail-backdrop transaction-detail-backdrop--sheet-scroll${
        isVisible ? " is-open" : ""
      }`}
      aria-hidden={!isVisible}
      inert={!isVisible}
      onScroll={clampSheetScroll}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          event.stopPropagation();

          if (confirmDelete) {
            if (!isDeleting) {
              setConfirmDelete(false);
            }
          } else {
            onClose();
          }
        }
      }}
    >
      <article
        ref={sheetRef}
        className={`transaction-detail-sheet transaction-detail-sheet--${amountTone} transaction-detail-sheet--group${
          isDragging ? " is-dragging" : ""
        }`}
        style={
          {
            "--transaction-detail-drag-offset": `${dragOffset}px`
          } as CSSProperties
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-group-detail-title"
        onPointerDownCapture={startDrag}
        onPointerMoveCapture={moveDrag}
        onPointerUpCapture={finishDrag}
        onPointerCancel={cancelDrag}
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget && !isVisible) {
            setRenderedGroup(null);
          }
        }}
      >
        {confirmDelete ? (
          <div
            className="transaction-detail-sheet__delete-dismiss-layer"
            aria-hidden="true"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();

              if (!isDeleting) {
                setConfirmDelete(false);
              }
            }}
          />
        ) : null}

        <div
          className="transaction-detail-sheet__drag-region"
          aria-hidden="true"
        >
          <span />
        </div>

        <div className="transaction-detail-sheet__toolbar">
          <div className="transaction-detail-sheet__more">
            <ActionButton
              shape="icon"
              type="button"
              className="transaction-detail-sheet__action-button"
              aria-label="More group actions"
              aria-haspopup="menu"
              aria-expanded={actionsOpen}
              title="More"
              disabled={isDeleting}
              onClick={() => {
                setConfirmDelete(false);
                setActionsOpen((current) => !current);
              }}
            >
              <Ellipsis aria-hidden="true" />
            </ActionButton>

            {actionsOpen ? (
              <div
                className="transaction-detail-sheet__action-menu is-open is-interactive"
                role="menu"
                aria-label="Group actions"
              >
                <ActionButton
                  shape="icon"
                  type="button"
                  className="transaction-detail-sheet__floating-action transaction-group-detail-action--share"
                  role="menuitem"
                  aria-label="Share group"
                  title="Share"
                  disabled={confirmDelete || isDeleting}
                  onClick={() => {}}
                >
                  <Share aria-hidden="true" />
                </ActionButton>
                <ActionButton
                  shape="icon"
                  type="button"
                  className="transaction-detail-sheet__floating-action transaction-group-detail-action--edit"
                  role="menuitem"
                  aria-label="Edit group"
                  title="Edit"
                  disabled={confirmDelete || isDeleting}
                  onClick={() => {
                    onEdit(detailGroup);
                    onClose();
                  }}
                >
                  <Pencil aria-hidden="true" />
                </ActionButton>
                <ActionButton
                  shape="icon"
                  type="button"
                  className="transaction-detail-sheet__floating-action transaction-group-detail-action--delete"
                  role="menuitem"
                  aria-label="Delete group"
                  title="Delete"
                  disabled={confirmDelete || isDeleting}
                  onClick={() => {
                    setConfirmDelete(true);
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </ActionButton>
              </div>
            ) : null}

        {confirmDelete ? (
          <div className="transaction-detail-delete-confirm" role="alertdialog">
            <strong>Delete permanently?</strong>
            <span className="transaction-detail-delete-confirm__summary">
              <span>{detailGroup.title}</span>
              <b>
                {formatMoneyAmount(displayNetTotal, {
                  currency: displayCurrency,
                  showSign: displayNetTotalCents !== 0
                })}
              </b>
            </span>
            {deleteError ? (
              <p className="transaction-detail-delete-confirm__error">
                {deleteError}
              </p>
            ) : null}
            <div className="transaction-detail-delete-confirm__actions">
              <ActionButton type="button" onClick={() => setConfirmDelete(false)}>
                Cancel
              </ActionButton>
              <ActionButton
                type="button"
                className="transaction-detail-delete-confirm__submit"
                disabled={isDeleting}
                onClick={() => void confirmDeleteGroup()}
              >
                {isDeleting ? "Deleting" : "Delete"}
              </ActionButton>
            </div>
          </div>
        ) : null}
          </div>

        <ActionButton
          shape="icon"
          className="transaction-detail-sheet__close"
          type="button"
          aria-label="Close group details"
          title="Close"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </ActionButton>
        </div>

        <div
          ref={scrollAreaRef}
          className="transaction-detail-sheet__scroll-area"
        >
          <div className="transaction-detail-sheet__content">
            <header className="transaction-detail-hero">
              <span className="transaction-detail-hero__icon" aria-hidden="true">
                <Icon />
              </span>
              <p>
                {detailGroup.category.name} &middot; Group
              </p>
              <h2 id="transaction-group-detail-title">{detailGroup.title}</h2>
              <strong>
                {displayNetTotalCents === 0
                  ? formatMoneyAmount(0, { currency: displayCurrency })
                  : formatMoneyAmount(displayNetTotal, {
                      currency: displayCurrency,
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
              <time dateTime={detailGroup.date}>
                {formatDate(detailGroup.date)}
              </time>
            </header>

            <section className="transaction-group-detail-lines">
              <h3>
                {lineCount} {lineCount === 1 ? "transaction" : "transactions"}
              </h3>
              <ul>
                {detailGroup.transactions.map((line) => {
                  const amount = Number(line.originalAmount ?? line.amount);
                  const signedAmount =
                    line.type === "INCOME" ? amount : -amount;
                  const LineIcon =
                    line.type === "INCOME" ? ArrowUpRight : ArrowDownRight;

                  return (
                    <li key={line.id}>
                      <span
                        className={`transaction-group-detail-lines__type transaction-group-detail-lines__type--${line.type.toLowerCase()}`}
                        aria-hidden="true"
                      >
                        <LineIcon />
                      </span>
                      <span>
                        <strong>{line.description}</strong>
                        <small>
                          {line.type === "INCOME" ? "Income" : "Expense"}{" "}
                          &middot; {line.currency ?? "EUR"}
                        </small>
                      </span>
                      <strong
                        className={`transaction-row__amount--${line.type.toLowerCase()}`}
                      >
                        {formatMoneyAmount(signedAmount, {
                          showSign: true,
                          currency: line.currency ?? "EUR"
                        })}
                      </strong>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section
              className="transaction-detail-section transaction-group-detail-balance"
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
              aria-labelledby="transaction-group-context-title"
              aria-busy={!matchingDetail && !matchingError}
            >
              <div className="transaction-detail-section__heading">
                <h3 id="transaction-group-context-title">Context</h3>
                <span>{contextPeriod}</span>
              </div>

              <SlidingSegmentedControl
                className="transaction-detail-context__scope"
                value={scope}
                options={detailScopeOptions}
                label="Transaction group ranking period"
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
                        {detailGroup.category.name.toLowerCase()} operations
                      </span>
                    </dt>
                    <dd>#{context.categoryRank.position}</dd>
                  </div>
                  <div>
                    <dt>
                      {groupTypeLabel} rank
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
                      {formatPeriodImpact(context.periodImpactPercentage)}
                    </dd>
                  </div>
                </dl>
              )}
            </section>
          </div>
        </div>
      </article>
    </div>,
    document.body
  );
}
