import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { ArrowDownRight, ArrowUpRight, Plus, Trash2, X } from "lucide-react";

import { invalidateAfterTransactionWrite } from "../../cache/financial-cache";
import { ActionButton } from "../../components/ui/ActionButton";
import { acquireDragScrollLock } from "../../components/ui/drag-scroll-lock";
import {
  SlidingSegmentedControl,
  type SlidingSegmentOption
} from "../../components/ui/SlidingSegmentedControl";
import { getTodayDateOnly } from "../../dates/date-only";
import { formatMoneyAmount } from "../../money/format-euro";
import { TransactionDateField } from "./TransactionDateField";
import { TransactionTypeSwitch } from "./TransactionTypeSwitch";
import type { TransactionPreview } from "./transaction-api";
import {
  createTransactionGroup,
  updateTransactionGroup,
  addGroupTransaction,
  createTransactionGroupFromTransaction,
  updateGroupTransaction,
  deleteGroupTransaction,
  reorderGroupTransactions,
  type TransactionGroupLineInput,
  type TransactionGroupListItem
} from "./transaction-groups-api";
import {
  transactionCategories,
  type TransactionType
} from "./category-catalog";
import type { TransactionCurrencyCode } from "./transaction-validation";

const MAX_GROUP_TITLE_LENGTH = 30;
const MINIMUM_TRANSACTION_DATE = "2026-01-01";
const CURRENCY_OPTIONS: readonly SlidingSegmentOption<TransactionCurrencyCode>[] = [
  { value: "EUR", label: "\u20ac" },
  { value: "USD", label: "$" }
];
const CATEGORY_TYPE_DRAG_THRESHOLD_PX = 18;
const CATEGORY_TYPE_AXIS_THRESHOLD_PX = 8;
const CATEGORY_CLICK_SUPPRESSION_MS = 120;
const LINE_REORDER_HOLD_MS = 160;
const LINE_REORDER_MOVE_TOLERANCE_PX = 7;
const LINE_REORDER_AUTO_SCROLL_EDGE_PX = 82;
const LINE_REORDER_AUTO_SCROLL_MAX_SPEED_PX = 18;
const LINE_REORDER_MIDPOINT_THRESHOLD_PX = 3;

type DraftLine = TransactionGroupLineInput & {
  id: string;
  persistedId?: string;
};

type LineReorderItemGeometry = {
  id: string;
  index: number;
  centerY: number;
  height: number;
};

type LineReorderGesture = {
  pointerId: number;
  lineId: string;
  startX: number;
  startY: number;
  startIndex: number;
  previewIndex: number;
  minOffset: number;
  maxOffset: number;
  slotOffset: number;
  itemCenterY: number;
  itemTop: number;
  itemBottom: number;
  startScrollTop: number;
  latestClientY: number;
  latestOffsetY: number;
  direction: "UP" | "DOWN" | null;
  autoScrollFrame: number | null;
  autoScrollVelocity: number;
  active: boolean;
  trigger: HTMLElement;
  pressTimer: number | null;
  geometry: LineReorderItemGeometry[];
};

type LineReorderState = {
  lineId: string;
  offsetY: number;
  startIndex: number;
  previewIndex: number;
  slotOffset: number;
};

type TransactionGroupComposerProps = {
  userId: string;
  open: boolean;
  group: TransactionGroupListItem | null;
  seedTransaction?: TransactionPreview | null;
  onClose: () => void;
  onSaved: () => void;
};

function normalizeDecimalInput(value: string) {
  const normalized = value.replace(".", ",").replace(/[^\d,]/g, "");
  const [whole = "", decimal = ""] = normalized.split(",");
  return decimal.length > 0
    ? `${whole.slice(0, 8)},${decimal.slice(0, 2)}`
    : whole.slice(0, 8);
}

function toApiAmount(value: string) {
  return value.trim().replace(",", ".");
}

function parseAmount(value: string) {
  const amount = Number(toApiAmount(value));
  return Number.isFinite(amount) ? amount : 0;
}

function createDraftId() {
  return `draft-${Math.random().toString(36).slice(2)}`;
}

function createEmptyLine(): DraftLine {
  return {
    id: createDraftId(),
    type: "EXPENSE",
    title: "",
    amount: "",
    currency: "EUR"
  };
}

function createLineFromTransaction(transaction: TransactionPreview): DraftLine {
  return {
    id: createDraftId(),
    persistedId: transaction.id,
    type: transaction.type,
    title: transaction.description,
    amount: String(transaction.originalAmount ?? transaction.amount).replace(".", ","),
    currency: transaction.currency ?? "EUR",
    baseAmount: transaction.baseAmount
  };
}

function createLineFromGroupTransaction(transaction: TransactionGroupListItem["transactions"][number]): DraftLine {
  return {
    id: createDraftId(),
    persistedId: transaction.id,
    type: transaction.type,
    title: transaction.description,
    amount: String(transaction.originalAmount ?? transaction.amount).replace(".", ","),
    currency: transaction.currency ?? "EUR",
    baseAmount: transaction.baseAmount
  };
}

function getNetTotal(lines: readonly DraftLine[]) {
  return lines.reduce((total, line) => {
    const amount =
      line.currency === "USD" && line.baseAmount
        ? parseAmount(String(line.baseAmount))
        : parseAmount(line.amount);
    return total + (line.type === "INCOME" ? amount : -amount);
  }, 0);
}

function lineToInput(line: DraftLine): TransactionGroupLineInput {
  const input: TransactionGroupLineInput = {
    type: line.type,
    title: line.title.trim(),
    amount: toApiAmount(line.amount),
    currency: line.currency
  };

  if (line.currency === "USD" && line.type === "INCOME") {
    input.baseAmount = line.baseAmount || input.amount;
  }

  return input;
}

function normalizeAmountForComparison(value: string | number | undefined) {
  const amount = Number(String(value ?? "").replace(",", "."));

  return Number.isFinite(amount) ? amount.toFixed(2) : "";
}

function hasGroupLineChanged(
  line: DraftLine,
  transaction: TransactionGroupListItem["transactions"][number]
) {
  const input = lineToInput(line);
  const existingCurrency = transaction.currency ?? "EUR";
  const existingAmount = transaction.originalAmount ?? transaction.amount;
  const shouldCompareBaseAmount = input.baseAmount !== undefined;

  return (
    input.type !== transaction.type ||
    input.title !== transaction.description ||
    input.currency !== existingCurrency ||
    normalizeAmountForComparison(input.amount) !==
      normalizeAmountForComparison(existingAmount) ||
    (shouldCompareBaseAmount &&
      normalizeAmountForComparison(input.baseAmount) !==
        normalizeAmountForComparison(transaction.baseAmount))
  );
}

function haveGroupTransactionIdsChanged(
  previousIds: readonly string[],
  nextIds: readonly string[]
) {
  return (
    previousIds.length !== nextIds.length ||
    previousIds.some((id, index) => id !== nextIds[index])
  );
}

export function TransactionGroupComposer({
  userId,
  open,
  group,
  seedTransaction,
  onClose,
  onSaved
}: TransactionGroupComposerProps) {
  const isEditing = group !== null;
  const [title, setTitle] = useState("");
  const [categoryType, setCategoryType] = useState<TransactionType>("EXPENSE");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(getTodayDateOnly());
  const [hasSelectedDate, setHasSelectedDate] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingLineDraft, setEditingLineDraft] = useState<DraftLine | null>(
    null
  );
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lineReorder, setLineReorder] = useState<LineReorderState | null>(null);
  const categoryTypeSurfaceRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const lineItemRefs = useRef(new Map<string, HTMLLIElement>());
  const lineReorderGesture = useRef<LineReorderGesture | null>(null);
  const releaseLineReorderScrollLock = useRef<(() => void) | null>(null);
  const suppressNextLineClick = useRef(false);
  const suppressNextLineClickTimeout = useRef<number | null>(null);
  const suppressNextCategoryClick = useRef(false);
  const suppressNextCategoryClickTimeout = useRef<number | null>(null);
  const categoryTypeDrag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startType: TransactionType;
    mode: "pending" | "horizontal" | "vertical";
  } | null>(null);
  const releaseCategoryTypeScrollLock = useRef<(() => void) | null>(null);
  const [categoryTypeDragOffset, setCategoryTypeDragOffset] = useState(0);
  const [isCategoryTypeDragging, setIsCategoryTypeDragging] = useState(false);

  useEffect(() => {
    if (!open) return;

    suppressNextCategoryClick.current = false;
    cancelLineReorder();
    const resetScrollFrame = window.requestAnimationFrame(() => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = 0;
      }
    });
    if (suppressNextCategoryClickTimeout.current !== null) {
      window.clearTimeout(suppressNextCategoryClickTimeout.current);
      suppressNextCategoryClickTimeout.current = null;
    }
    if (suppressNextLineClickTimeout.current !== null) {
      window.clearTimeout(suppressNextLineClickTimeout.current);
      suppressNextLineClickTimeout.current = null;
    }

    if (group) {
      setTitle(group.title);
      setCategoryId(group.categoryId);
      setCategoryType(group.category.type);
      setDate(group.date);
      setHasSelectedDate(true);
      setLines(group.transactions.map(createLineFromGroupTransaction));
      setEditingLineId(null);
      setEditingLineDraft(null);
      setFormError("");
      return;
    }

    if (seedTransaction) {
      setTitle(seedTransaction.description.slice(0, MAX_GROUP_TITLE_LENGTH));
      setCategoryId(seedTransaction.categoryId);
      setCategoryType(seedTransaction.category.type);
      setDate(seedTransaction.date);
      setHasSelectedDate(true);
      setLines([createLineFromTransaction(seedTransaction)]);
      setEditingLineId(null);
      setEditingLineDraft(null);
      setFormError("");
      return;
    }

    setTitle("");
    setCategoryId("");
    setCategoryType("EXPENSE");
    setDate(getTodayDateOnly());
    setHasSelectedDate(false);
    setLines([]);
    setEditingLineId(null);
    setEditingLineDraft(null);
    setFormError("");

    return () => window.cancelAnimationFrame(resetScrollFrame);
  }, [group, open, seedTransaction]);

  useEffect(
    () => () => {
      releaseCategoryTypeScrollLock.current?.();
      releaseCategoryTypeScrollLock.current = null;
      cancelLineReorder();
      if (suppressNextCategoryClickTimeout.current !== null) {
        window.clearTimeout(suppressNextCategoryClickTimeout.current);
      }
      if (suppressNextLineClickTimeout.current !== null) {
        window.clearTimeout(suppressNextLineClickTimeout.current);
      }
    },
    []
  );

  const netTotal = getNetTotal(lines);
  const hasTransactionContent = lines.some(
    (line) => line.title.trim().length > 0 || parseAmount(line.amount) > 0
  );
  const canAddLine = lines.length < 10;
  const canSubmit =
    title.trim().length > 0 &&
    title.trim().length <= MAX_GROUP_TITLE_LENGTH &&
    categoryId.length > 0 &&
    date.length > 0 &&
    lines.length >= 2 &&
    lines.length <= 10 &&
    lines.every(
      (line) => line.title.trim().length > 0 && parseAmount(line.amount) > 0
    ) &&
    editingLineDraft === null &&
    !isSubmitting;

  function selectCategoryType(nextType: TransactionType) {
    setCategoryType(nextType);
    const selected = transactionCategories.find(
      (category) => category.id === categoryId
    );
    if (selected?.type !== nextType) {
      setCategoryId("");
    }
  }

  function suppressCategoryClickBriefly() {
    suppressNextCategoryClick.current = true;

    if (suppressNextCategoryClickTimeout.current !== null) {
      window.clearTimeout(suppressNextCategoryClickTimeout.current);
    }

    suppressNextCategoryClickTimeout.current = window.setTimeout(() => {
      suppressNextCategoryClick.current = false;
      suppressNextCategoryClickTimeout.current = null;
    }, CATEGORY_CLICK_SUPPRESSION_MS);
  }

  function startCategoryTypeDrag(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    if (event.button !== 0 || isSubmitting) {
      return;
    }

    categoryTypeDrag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      mode: "pending",
      startType: categoryType
    };
    setCategoryTypeDragOffset(0);
  }

  function moveCategoryTypeDrag(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    const drag = categoryTypeDrag.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const horizontalDistance = event.clientX - drag.startX;
    const verticalDistance = event.clientY - drag.startY;

    if (drag.mode === "pending") {
      const hasHorizontalIntent =
        Math.abs(horizontalDistance) > Math.abs(verticalDistance) &&
        Math.abs(horizontalDistance) >= CATEGORY_TYPE_DRAG_THRESHOLD_PX;
      const hasVerticalIntent =
        Math.abs(verticalDistance) > Math.abs(horizontalDistance) &&
        Math.abs(verticalDistance) >= CATEGORY_TYPE_AXIS_THRESHOLD_PX;

      if (hasVerticalIntent) {
        drag.mode = "vertical";
        categoryTypeDrag.current = null;
        setIsCategoryTypeDragging(false);
        setCategoryTypeDragOffset(0);
        return;
      }

      if (!hasHorizontalIntent) {
        return;
      }

      drag.mode = "horizontal";
      setIsCategoryTypeDragging(true);
      releaseCategoryTypeScrollLock.current ??= acquireDragScrollLock();
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    if (drag.mode !== "horizontal") {
      return;
    }

    event.preventDefault();
    const maxOffset = categoryTypeSurfaceRef.current?.clientWidth ?? 320;
    const minOffset = drag.startType === "INCOME" ? -maxOffset : 0;
    const maxDirectionalOffset = drag.startType === "EXPENSE" ? maxOffset : 0;

    setCategoryTypeDragOffset(
      Math.max(minOffset, Math.min(maxDirectionalOffset, horizontalDistance))
    );
  }

  function finishCategoryTypeDrag(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    const drag = categoryTypeDrag.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    if (drag.mode !== "horizontal") {
      categoryTypeDrag.current = null;
      setIsCategoryTypeDragging(false);
      setCategoryTypeDragOffset(0);
      return;
    }

    const offset = event.clientX - drag.startX;
    const wasDragged = Math.abs(offset) > CATEGORY_TYPE_DRAG_THRESHOLD_PX;
    const nextType =
      drag.startType === "EXPENSE" && offset > CATEGORY_TYPE_DRAG_THRESHOLD_PX
        ? "INCOME"
        : drag.startType === "INCOME" && offset < -CATEGORY_TYPE_DRAG_THRESHOLD_PX
          ? "EXPENSE"
          : drag.startType;

    if (wasDragged) {
      suppressCategoryClickBriefly();
    }
    selectCategoryType(nextType);
    categoryTypeDrag.current = null;
    setIsCategoryTypeDragging(false);
    setCategoryTypeDragOffset(0);
    releaseCategoryTypeScrollLock.current?.();
    releaseCategoryTypeScrollLock.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function cancelCategoryTypeDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = categoryTypeDrag.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    categoryTypeDrag.current = null;
    setIsCategoryTypeDragging(false);
    setCategoryTypeDragOffset(0);
    releaseCategoryTypeScrollLock.current?.();
    releaseCategoryTypeScrollLock.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function startEditingLine(line: DraftLine) {
    setEditingLineId(line.id);
    setEditingLineDraft({ ...line });
  }

  function startAddingLine() {
    const line = createEmptyLine();
    setEditingLineId(line.id);
    setEditingLineDraft(line);
  }

  function updateEditingLine(patch: Partial<DraftLine>) {
    setEditingLineDraft((current) =>
      current ? { ...current, ...patch } : current
    );
  }

  function cancelEditingLine() {
    setEditingLineId(null);
    setEditingLineDraft(null);
  }

  function confirmEditingLine() {
    if (!editingLineDraft) {
      cancelEditingLine();
      return;
    }

    setLines((current) => {
      const existingIndex = current.findIndex(
        (line) => line.id === editingLineDraft.id
      );

      if (existingIndex < 0) {
        return [...current, editingLineDraft];
      }

      return current.map((line) =>
        line.id === editingLineDraft.id ? editingLineDraft : line
      );
    });
    cancelEditingLine();
  }

  function setLineItemRef(lineId: string, node: HTMLLIElement | null) {
    if (node) {
      lineItemRefs.current.set(lineId, node);
      return;
    }

    lineItemRefs.current.delete(lineId);
  }

  function getLineGap() {
    const firstLine = lines[0]
      ? lineItemRefs.current.get(lines[0].id)
      : null;
    const secondLine = lines[1]
      ? lineItemRefs.current.get(lines[1].id)
      : null;

    if (!firstLine || !secondLine) {
      return 8;
    }

    const firstRect = firstLine.getBoundingClientRect();
    const secondRect = secondLine.getBoundingClientRect();

    return Math.max(0, secondRect.top - firstRect.bottom);
  }

  function getLineReorderPreviewIndex(
    gesture: LineReorderGesture,
    offsetY: number
  ) {
    const draggedTop = gesture.itemTop + offsetY;
    const draggedBottom = gesture.itemBottom + offsetY;
    const direction = gesture.direction ?? (offsetY < 0 ? "UP" : "DOWN");

    if (direction === "UP") {
      return gesture.geometry.reduce((index, item) => {
        if (item.id === gesture.lineId) {
          return index;
        }

        const currentCenterY =
          item.centerY + getStaticLineReorderOffset(gesture, item.index);
        const shouldStayBefore =
          draggedTop > currentCenterY - LINE_REORDER_MIDPOINT_THRESHOLD_PX;

        return shouldStayBefore ? index + 1 : index;
      }, 0);
    }

    return gesture.geometry.reduce((index, item) => {
      if (item.id === gesture.lineId) {
        return index;
      }

      const currentCenterY =
        item.centerY + getStaticLineReorderOffset(gesture, item.index);
      const hasPassedItem =
        draggedBottom > currentCenterY + LINE_REORDER_MIDPOINT_THRESHOLD_PX;

      return hasPassedItem ? index + 1 : index;
    }, 0);
  }

  function getStaticLineReorderOffset(
    gesture: LineReorderGesture,
    index: number
  ) {
    if (
      gesture.previewIndex > gesture.startIndex &&
      index > gesture.startIndex &&
      index <= gesture.previewIndex
    ) {
      return -gesture.slotOffset;
    }

    if (
      gesture.previewIndex < gesture.startIndex &&
      index >= gesture.previewIndex &&
      index < gesture.startIndex
    ) {
      return gesture.slotOffset;
    }

    return 0;
  }

  function getLineReorderOffsetFromPointer(gesture: LineReorderGesture) {
    const scrollDelta =
      (scrollAreaRef.current?.scrollTop ?? gesture.startScrollTop) -
      gesture.startScrollTop;
    const pointerDelta = gesture.latestClientY - gesture.startY;

    return Math.max(
      gesture.minOffset,
      Math.min(gesture.maxOffset, pointerDelta + scrollDelta)
    );
  }

  function updateLineReorderState(gesture: LineReorderGesture) {
    const offsetY = getLineReorderOffsetFromPointer(gesture);

    if (offsetY > gesture.latestOffsetY) {
      gesture.direction = "DOWN";
    } else if (offsetY < gesture.latestOffsetY) {
      gesture.direction = "UP";
    }

    const previewIndex = getLineReorderPreviewIndex(gesture, offsetY);

    gesture.latestOffsetY = offsetY;
    gesture.previewIndex = previewIndex;
    setLineReorder({
      lineId: gesture.lineId,
      offsetY,
      startIndex: gesture.startIndex,
      previewIndex,
      slotOffset: gesture.slotOffset
    });
  }

  function getLineReorderAutoScrollVelocity(gesture: LineReorderGesture) {
    const scrollArea = scrollAreaRef.current;

    if (!scrollArea) {
      return 0;
    }

    const rect = scrollArea.getBoundingClientRect();
    const topDistance = gesture.latestClientY - rect.top;
    const bottomDistance = rect.bottom - gesture.latestClientY;
    const canScrollUp = scrollArea.scrollTop > 0;
    const canScrollDown =
      scrollArea.scrollTop + scrollArea.clientHeight < scrollArea.scrollHeight;

    if (topDistance < LINE_REORDER_AUTO_SCROLL_EDGE_PX && canScrollUp) {
      const intensity =
        (LINE_REORDER_AUTO_SCROLL_EDGE_PX - Math.max(0, topDistance)) /
        LINE_REORDER_AUTO_SCROLL_EDGE_PX;

      return -Math.max(
        1,
        Math.round(intensity * LINE_REORDER_AUTO_SCROLL_MAX_SPEED_PX)
      );
    }

    if (bottomDistance < LINE_REORDER_AUTO_SCROLL_EDGE_PX && canScrollDown) {
      const intensity =
        (LINE_REORDER_AUTO_SCROLL_EDGE_PX - Math.max(0, bottomDistance)) /
        LINE_REORDER_AUTO_SCROLL_EDGE_PX;

      return Math.max(
        1,
        Math.round(intensity * LINE_REORDER_AUTO_SCROLL_MAX_SPEED_PX)
      );
    }

    return 0;
  }

  function stopLineReorderAutoScroll(gesture: LineReorderGesture) {
    if (gesture.autoScrollFrame !== null) {
      window.cancelAnimationFrame(gesture.autoScrollFrame);
      gesture.autoScrollFrame = null;
    }

    gesture.autoScrollVelocity = 0;
  }

  function scheduleLineReorderAutoScroll(gesture: LineReorderGesture) {
    gesture.autoScrollVelocity = getLineReorderAutoScrollVelocity(gesture);

    if (gesture.autoScrollVelocity === 0) {
      stopLineReorderAutoScroll(gesture);
      return;
    }

    if (gesture.autoScrollFrame !== null) {
      return;
    }

    const tick = () => {
      const currentGesture = lineReorderGesture.current;
      const scrollArea = scrollAreaRef.current;

      if (!currentGesture || !currentGesture.active || !scrollArea) {
        if (currentGesture) {
          currentGesture.autoScrollFrame = null;
          currentGesture.autoScrollVelocity = 0;
        }
        return;
      }

      currentGesture.autoScrollVelocity =
        getLineReorderAutoScrollVelocity(currentGesture);

      if (currentGesture.autoScrollVelocity === 0) {
        currentGesture.autoScrollFrame = null;
        return;
      }

      const previousScrollTop = scrollArea.scrollTop;

      scrollArea.scrollTop += currentGesture.autoScrollVelocity;

      if (scrollArea.scrollTop !== previousScrollTop) {
        updateLineReorderState(currentGesture);
      }

      currentGesture.autoScrollFrame = window.requestAnimationFrame(tick);
    };

    gesture.autoScrollFrame = window.requestAnimationFrame(tick);
  }

  function activateLineReorder(pointerId: number) {
    const gesture = lineReorderGesture.current;

    if (!gesture || gesture.pointerId !== pointerId || gesture.active) {
      return;
    }

    const lineElements = lines
      .map((line, index) => {
        const element = lineItemRefs.current.get(line.id);

        return element ? { line, index, element } : null;
      })
      .filter(
        (
          item
        ): item is { line: DraftLine; index: number; element: HTMLLIElement } =>
          item !== null
      );
    const draggedElement = lineItemRefs.current.get(gesture.lineId);

    if (!draggedElement || lineElements.length < 2) {
      cancelLineReorder();
      return;
    }

    const geometry = lineElements.map(({ line, index, element }) => {
      const rect = element.getBoundingClientRect();

      return {
        id: line.id,
        index,
        centerY: rect.top + rect.height / 2,
        height: rect.height
      };
    });
    const draggedRect = draggedElement.getBoundingClientRect();
    const firstRect = lineElements[0].element.getBoundingClientRect();
    const lastRect =
      lineElements[lineElements.length - 1].element.getBoundingClientRect();
    const gap = getLineGap();
    const startIndex = lines.findIndex((line) => line.id === gesture.lineId);

    if (startIndex < 0) {
      cancelLineReorder();
      return;
    }

    const nextGesture: LineReorderGesture = {
      ...gesture,
      active: true,
      startIndex,
      previewIndex: startIndex,
      minOffset: firstRect.top - draggedRect.top,
      maxOffset: lastRect.bottom - draggedRect.bottom,
      slotOffset: draggedRect.height + gap,
      itemCenterY: draggedRect.top + draggedRect.height / 2,
      itemTop: draggedRect.top,
      itemBottom: draggedRect.bottom,
      startScrollTop: scrollAreaRef.current?.scrollTop ?? 0,
      latestClientY: gesture.latestClientY,
      latestOffsetY: 0,
      direction: null,
      autoScrollFrame: null,
      autoScrollVelocity: 0,
      geometry,
      pressTimer: null
    };

    lineReorderGesture.current = nextGesture;
    suppressNextLineClickBriefly();
    releaseLineReorderScrollLock.current ??= acquireDragScrollLock();
    nextGesture.trigger.setPointerCapture(pointerId);
    setLineReorder({
      lineId: nextGesture.lineId,
      offsetY: 0,
      startIndex,
      previewIndex: startIndex,
      slotOffset: nextGesture.slotOffset
    });
    scheduleLineReorderAutoScroll(nextGesture);
  }

  function startLineReorder(
    event: ReactPointerEvent<HTMLButtonElement>,
    lineId: string
  ) {
    if (
      event.button !== 0 ||
      isSubmitting ||
      editingLineDraft !== null ||
      lines.length < 2
    ) {
      return;
    }

    const startIndex = lines.findIndex((line) => line.id === lineId);

    if (startIndex < 0) {
      return;
    }

    cancelLineReorder();
    const pointerId = event.pointerId;
    const trigger = event.currentTarget;
    const pressTimer = window.setTimeout(() => {
      activateLineReorder(pointerId);
    }, LINE_REORDER_HOLD_MS);

    lineReorderGesture.current = {
      pointerId,
      lineId,
      startX: event.clientX,
      startY: event.clientY,
      startIndex,
      previewIndex: startIndex,
      minOffset: 0,
      maxOffset: 0,
      slotOffset: 0,
      itemCenterY: 0,
      itemTop: 0,
      itemBottom: 0,
      startScrollTop: scrollAreaRef.current?.scrollTop ?? 0,
      latestClientY: event.clientY,
      latestOffsetY: 0,
      direction: null,
      autoScrollFrame: null,
      autoScrollVelocity: 0,
      active: false,
      trigger,
      pressTimer,
      geometry: []
    };
  }

  function moveLineReorder(event: ReactPointerEvent<HTMLButtonElement>) {
    const gesture = lineReorderGesture.current;

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;

    if (!gesture.active) {
      if (
        Math.abs(deltaX) >= LINE_REORDER_MOVE_TOLERANCE_PX ||
        Math.abs(deltaY) >= LINE_REORDER_MOVE_TOLERANCE_PX
      ) {
        cancelLineReorder();
      }

      return;
    }

    event.preventDefault();
    gesture.latestClientY = event.clientY;
    updateLineReorderState(gesture);
    scheduleLineReorderAutoScroll(gesture);
  }

  function suppressNextLineClickBriefly() {
    suppressNextLineClick.current = true;

    if (suppressNextLineClickTimeout.current !== null) {
      window.clearTimeout(suppressNextLineClickTimeout.current);
    }

    suppressNextLineClickTimeout.current = window.setTimeout(() => {
      suppressNextLineClick.current = false;
      suppressNextLineClickTimeout.current = null;
    }, 220);
  }

  function cancelLineReorder() {
    const gesture = lineReorderGesture.current;

    if (gesture && gesture.pressTimer !== null) {
      window.clearTimeout(gesture.pressTimer);
    }

    if (gesture) {
      stopLineReorderAutoScroll(gesture);
    }

    if (
      gesture?.active &&
      gesture.trigger.hasPointerCapture(gesture.pointerId)
    ) {
      gesture.trigger.releasePointerCapture(gesture.pointerId);
    }

    lineReorderGesture.current = null;
    releaseLineReorderScrollLock.current?.();
    releaseLineReorderScrollLock.current = null;
    setLineReorder(null);
  }

  function finishLineReorder(event: ReactPointerEvent<HTMLButtonElement>) {
    const gesture = lineReorderGesture.current;

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    if (gesture.pressTimer !== null) {
      window.clearTimeout(gesture.pressTimer);
    }

    if (!gesture.active) {
      lineReorderGesture.current = null;
      return;
    }

    event.preventDefault();
    suppressNextLineClickBriefly();
    const targetIndex = gesture.previewIndex;
    const lineId = gesture.lineId;

    setLines((current) => {
      const fromIndex = current.findIndex((line) => line.id === lineId);

      if (fromIndex < 0 || fromIndex === targetIndex) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(Math.min(targetIndex, next.length), 0, moved);
      return next;
    });
    cancelLineReorder();
  }

  function getLineReorderOffset(lineId: string, index: number) {
    if (!lineReorder) {
      return 0;
    }

    if (lineReorder.lineId === lineId) {
      return lineReorder.offsetY;
    }

    if (
      lineReorder.previewIndex > lineReorder.startIndex &&
      index > lineReorder.startIndex &&
      index <= lineReorder.previewIndex
    ) {
      return -lineReorder.slotOffset;
    }

    if (
      lineReorder.previewIndex < lineReorder.startIndex &&
      index >= lineReorder.previewIndex &&
      index < lineReorder.startIndex
    ) {
      return lineReorder.slotOffset;
    }

    return 0;
  }

  async function saveGroup() {
    if (!canSubmit) {
      setFormError("Add a title, category and at least two valid transactions");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      if (!group) {
        const payload = {
          title: title.trim(),
          categoryId,
          date,
          transactions: lines.map(lineToInput)
        };

        if (seedTransaction) {
          await createTransactionGroupFromTransaction(seedTransaction.id, {
            ...payload,
            transactions: lines
              .filter((line) => line.persistedId !== seedTransaction.id)
              .map(lineToInput)
          });
        } else {
          await createTransactionGroup(payload);
        }
      } else {
        const trimmedTitle = title.trim();
        const groupMetadataChanged =
          trimmedTitle !== group.title ||
          categoryId !== group.categoryId ||
          date !== group.date;

        if (groupMetadataChanged) {
          await updateTransactionGroup(group.id, {
            title: trimmedTitle,
            categoryId,
            date
          });
        }

        const currentPersistedIds = new Set(
          group.transactions.map((transaction) => transaction.id)
        );
        const existingTransactionsById = new Map(
          group.transactions.map((transaction) => [transaction.id, transaction])
        );
        const nextPersistedIdsByDraftId = new Map<string, string>();
        const updateRequests: Promise<unknown>[] = [];

        for (const line of lines) {
          if (line.persistedId) {
            const existingTransaction = existingTransactionsById.get(
              line.persistedId
            );

            if (
              existingTransaction &&
              hasGroupLineChanged(line, existingTransaction)
            ) {
              updateRequests.push(
                updateGroupTransaction(group.id, line.persistedId, lineToInput(line))
              );
            }
          } else {
            const response = await addGroupTransaction(group.id, lineToInput(line));
            const createdLine = response.group.transactions.find(
              (transaction) => !currentPersistedIds.has(transaction.id)
            );

            if (createdLine) {
              currentPersistedIds.add(createdLine.id);
              nextPersistedIdsByDraftId.set(line.id, createdLine.id);
            }
          }
        }

        await Promise.all(updateRequests);

        const persistedIds = new Set(
          lines.flatMap((line) => {
            const persistedId =
              line.persistedId ?? nextPersistedIdsByDraftId.get(line.id);
            return persistedId ? [persistedId] : [];
          })
        );
        await Promise.all(
          group.transactions
            .filter((existing) => !persistedIds.has(existing.id))
            .map((existing) => deleteGroupTransaction(group.id, existing.id))
        );

        const orderedTransactionIds = lines.flatMap((line) => {
          const persistedId =
            line.persistedId ?? nextPersistedIdsByDraftId.get(line.id);
          return persistedId ? [persistedId] : [];
        });
        const previousTransactionIds = group.transactions.map(
          (transaction) => transaction.id
        );

        if (
          orderedTransactionIds.length >= 2 &&
          haveGroupTransactionIdsChanged(previousTransactionIds, orderedTransactionIds)
        ) {
          await reorderGroupTransactions(group.id, orderedTransactionIds);
        }
      }

      await invalidateAfterTransactionWrite(userId);
      onSaved();
      onClose();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to save group"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function deleteLine(lineId: string) {
    setLines((current) => current.filter((line) => line.id !== lineId));
    cancelEditingLine();
  }

  return createPortal(
    <section
      className={`transaction-composer transaction-composer--group${
        categoryType === "INCOME" ? " transaction-composer--income" : ""
      }${open ? " is-open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-group-composer-title"
      aria-hidden={!open}
      inert={!open}
    >
      <header className="transaction-composer__header">
        <div className="transaction-composer__header-inner">
          <ActionButton
            shape="icon"
            className="transaction-composer__close"
            type="button"
            disabled={isSubmitting}
            aria-label="Close transaction group editor"
            title="Close"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </ActionButton>
          <h1 id="transaction-group-composer-title">
            {isEditing ? "Edit transaction group" : "New transaction group"}
          </h1>
        </div>
      </header>

      <form
        className="transaction-composer__form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void saveGroup();
        }}
      >
        <div ref={scrollAreaRef} className="transaction-composer__scroll-area">
          <div className="transaction-composer__content">
            <div className="transaction-composer__field">
              <div className="transaction-composer__field-heading">
                <span className="text-field-label" id="transaction-group-title-label">
                  Group title
                </span>
                {title.length >= 20 ? (
                  <span className="transaction-composer__character-count">
                    {title.length}/{MAX_GROUP_TITLE_LENGTH}
                  </span>
                ) : null}
              </div>
              <textarea
                className="text-field text-field--composer text-field--multiline"
                rows={1}
                maxLength={MAX_GROUP_TITLE_LENGTH}
                placeholder="What connects these?"
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value.replace(/[\r\n]+/g, " "))
                }
              />
            </div>

            <div
              ref={categoryTypeSurfaceRef}
              className={`transaction-group-category-drag-surface${
                isCategoryTypeDragging ? " is-dragging" : ""
              }`}
              onPointerDown={startCategoryTypeDrag}
              onPointerMove={moveCategoryTypeDrag}
              onPointerUp={finishCategoryTypeDrag}
              onPointerCancel={cancelCategoryTypeDrag}
              onClickCapture={(event) => {
                if (!suppressNextCategoryClick.current) {
                  return;
                }

                suppressNextCategoryClick.current = false;
                if (suppressNextCategoryClickTimeout.current !== null) {
                  window.clearTimeout(suppressNextCategoryClickTimeout.current);
                  suppressNextCategoryClickTimeout.current = null;
                }
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <fieldset
                className={`transaction-category-picker transaction-category-picker--group transaction-category-picker--group-${categoryType.toLowerCase()}`}
              >
                <legend className="sr-only">Category</legend>
                <div
                  className={`transaction-category-picker__heading${
                    isCategoryTypeDragging ? " is-dragging" : ""
                  }`}
                >
                  <span>Category</span>
                  <div
                    className={`transaction-group-category-type-toggle transaction-group-category-type-toggle--${categoryType.toLowerCase()}`}
                    style={
                      {
                        "--category-type-drag-offset": `${categoryTypeDragOffset}px`
                      } as CSSProperties
                    }
                    aria-label="Group category type"
                  >
                    <span aria-hidden="true" />
                    <button
                      type="button"
                      aria-label="Use income categories"
                      aria-pressed={categoryType === "INCOME"}
                      onClick={(event) => {
                        event.stopPropagation();
                        selectCategoryType("INCOME");
                      }}
                    >
                      <ArrowUpRight aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label="Use expense categories"
                      aria-pressed={categoryType === "EXPENSE"}
                      onClick={(event) => {
                        event.stopPropagation();
                        selectCategoryType("EXPENSE");
                      }}
                    >
                      <ArrowDownRight aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="transaction-group-category-window">
                  <div
                    className="transaction-group-category-track"
                    style={
                      {
                        "--category-track-base":
                          categoryType === "INCOME" ? "0%" : "-50%",
                        "--category-type-drag-offset": `${categoryTypeDragOffset}px`
                      } as CSSProperties
                    }
                  >
                    {(["INCOME", "EXPENSE"] as const).map((panelType) => (
                      <div
                        className={`transaction-category-grid transaction-group-category-panel transaction-group-category-panel--${panelType.toLowerCase()}`}
                        key={panelType}
                      >
                        {transactionCategories
                          .filter((category) => category.type === panelType)
                          .map((category) => {
                            const Icon = category.icon;
                            const isSelected = category.id === categoryId;

                            return (
                              <button
                                key={category.id}
                                className={`transaction-category-option${
                                  isSelected ? " is-selected" : ""
                                }`}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => setCategoryId(category.id)}
                              >
                                <span
                                  className="transaction-category-option__icon"
                                  aria-hidden="true"
                                >
                                  <Icon />
                                </span>
                                <span>{category.name}</span>
                              </button>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                </div>
              </fieldset>
            </div>

            <TransactionDateField
              id="transaction-group-date"
              label="Date"
              value={date}
              minimumDate={MINIMUM_TRANSACTION_DATE}
              maximumDate={getTodayDateOnly()}
              selected={hasSelectedDate}
              onChange={(nextDate) => {
                setDate(nextDate);
                setHasSelectedDate(true);
              }}
            />

            {hasTransactionContent ? (
              <section className="transaction-group-net" aria-label="Group net total">
                <strong
                  className={
                    netTotal > 0
                      ? "transaction-row__amount--income"
                      : netTotal < 0
                        ? "transaction-row__amount--expense"
                        : "transaction-row__amount--neutral"
                  }
                >
                  {formatMoneyAmount(netTotal, { showSign: netTotal !== 0 })}
                </strong>
              </section>
            ) : null}

            <section className="transaction-group-lines">
              <h2>Transactions</h2>
              <ul className={lineReorder ? "is-reordering" : undefined}>
                {lines.map((line, index) => {
                  const isEditingLine = editingLineId === line.id;
                  const editableLine =
                    isEditingLine && editingLineDraft ? editingLineDraft : line;
                  const reorderOffset = getLineReorderOffset(line.id, index);
                  const isReorderingLine = lineReorder?.lineId === line.id;

                  return (
                    <li
                      key={line.id}
                      ref={(node) => setLineItemRef(line.id, node)}
                      className={`transaction-group-line-item${
                        isReorderingLine ? " is-reordering" : ""
                      }${reorderOffset !== 0 ? " is-shifted" : ""}`}
                      style={
                        {
                          "--line-reorder-offset": `${reorderOffset}px`
                        } as CSSProperties
                      }
                    >
                      {isEditingLine ? (
                        <div className="transaction-group-line-editor">
                          <input
                            className="text-field text-field--composer"
                            placeholder="Title"
                            value={editableLine.title}
                            maxLength={50}
                            onChange={(event) =>
                              updateEditingLine({ title: event.target.value })
                            }
                          />
                          <TransactionTypeSwitch
                            value={editableLine.type}
                            onChange={(nextType) => {
                              if (nextType !== "ALL") {
                                updateEditingLine({ type: nextType });
                              }
                            }}
                            compact
                            label="Line type"
                          />
                          <input
                            className="text-field text-field--composer"
                            inputMode="decimal"
                            placeholder="Amount"
                            value={editableLine.amount}
                            onChange={(event) =>
                              updateEditingLine({
                                amount: normalizeDecimalInput(event.target.value)
                              })
                            }
                          />
                          <SlidingSegmentedControl
                            className="transaction-currency-toggle"
                            value={editableLine.currency}
                            options={CURRENCY_OPTIONS}
                            onChange={(currency) => updateEditingLine({ currency })}
                            label="Line currency"
                            compact
                            allowDrag={false}
                          />
                          <div className="transaction-group-line-editor__actions">
                            <ActionButton type="button" onClick={cancelEditingLine}>
                              Cancel
                            </ActionButton>
                            {lines.length > 1 ? (
                              <ActionButton
                                type="button"
                                className="transaction-detail-delete-confirm__submit"
                                onClick={() => deleteLine(line.id)}
                              >
                                <Trash2 aria-hidden="true" />
                                Delete
                              </ActionButton>
                            ) : null}
                            <ActionButton type="button" onClick={confirmEditingLine}>
                              Save
                            </ActionButton>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="transaction-group-line"
                          type="button"
                          onPointerDown={(event) =>
                            startLineReorder(event, line.id)
                          }
                          onPointerMove={moveLineReorder}
                          onPointerUp={finishLineReorder}
                          onPointerCancel={cancelLineReorder}
                          onLostPointerCapture={() => {
                            if (lineReorderGesture.current?.lineId === line.id) {
                              cancelLineReorder();
                            }
                          }}
                          onClick={(event) => {
                            if (suppressNextLineClick.current) {
                              suppressNextLineClick.current = false;
                              if (suppressNextLineClickTimeout.current !== null) {
                                window.clearTimeout(
                                  suppressNextLineClickTimeout.current
                                );
                                suppressNextLineClickTimeout.current = null;
                              }
                              event.preventDefault();
                              event.stopPropagation();
                              return;
                            }

                            startEditingLine(line);
                          }}
                        >
                          <span>{line.title || "Untitled"}</span>
                          <strong
                            className={
                              line.type === "INCOME"
                                ? "transaction-row__amount--income"
                                : "transaction-row__amount--expense"
                            }
                          >
                            {formatMoneyAmount(
                              line.type === "INCOME"
                                ? parseAmount(line.amount)
                                : -parseAmount(line.amount),
                              { showSign: true, currency: line.currency }
                            )}
                          </strong>
                        </button>
                      )}
                    </li>
                  );
                })}
                {editingLineDraft &&
                !lines.some((line) => line.id === editingLineDraft.id) ? (
                  <li>
                    <div className="transaction-group-line-editor">
                      <input
                        className="text-field text-field--composer"
                        placeholder="Title"
                        value={editingLineDraft.title}
                        maxLength={50}
                        onChange={(event) =>
                          updateEditingLine({ title: event.target.value })
                        }
                      />
                      <TransactionTypeSwitch
                        value={editingLineDraft.type}
                        onChange={(nextType) => {
                          if (nextType !== "ALL") {
                            updateEditingLine({ type: nextType });
                          }
                        }}
                        compact
                        label="Line type"
                      />
                      <input
                        className="text-field text-field--composer"
                        inputMode="decimal"
                        placeholder="Amount"
                        value={editingLineDraft.amount}
                        onChange={(event) =>
                          updateEditingLine({
                            amount: normalizeDecimalInput(event.target.value)
                          })
                        }
                      />
                      <SlidingSegmentedControl
                        className="transaction-currency-toggle"
                        value={editingLineDraft.currency}
                        options={CURRENCY_OPTIONS}
                        onChange={(currency) => updateEditingLine({ currency })}
                        label="Line currency"
                        compact
                        allowDrag={false}
                      />
                      <div className="transaction-group-line-editor__actions transaction-group-line-editor__actions--new">
                        <ActionButton type="button" onClick={cancelEditingLine}>
                          Cancel
                        </ActionButton>
                        <ActionButton type="button" onClick={confirmEditingLine}>
                          Add
                        </ActionButton>
                      </div>
                    </div>
                  </li>
                ) : null}
                {canAddLine && !editingLineDraft ? (
                  <li>
                    <button
                      className="transaction-group-line transaction-group-line--add"
                      type="button"
                      onClick={startAddingLine}
                    >
                      <Plus aria-hidden="true" />
                      <span>Add transaction</span>
                    </button>
                  </li>
                ) : null}
              </ul>
            </section>
          </div>
        </div>

        <footer className="transaction-composer__footer">
          <div>
            <p className="transaction-composer__message" role="alert">
              {formError}
            </p>
            <ActionButton type="submit" disabled={!canSubmit}>
              {isSubmitting
                ? "Saving"
                : isEditing
                  ? "Save group"
                  : "Add group"}
            </ActionButton>
          </div>
        </footer>
      </form>
    </section>,
    document.body
  );
}
