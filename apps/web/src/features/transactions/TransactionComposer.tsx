import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

import { prefetchScheduler } from "../../cache/prefetch-scheduler";
import { ActionButton } from "../../components/ui/ActionButton";
import { acquireDragScrollLock } from "../../components/ui/drag-scroll-lock";
import { formatErrorMessage } from "../../components/ui/error-message";
import { SlidingSegmentedControl } from "../../components/ui/SlidingSegmentedControl";
import { getTodayDateOnly } from "../../dates/date-only";
import { type TransactionType } from "./category-catalog";
import {
  createTransaction,
  TransactionApiError,
  type TransactionPreview,
  updateTransaction
} from "./transaction-api";
import { TransactionCategoryPicker } from "./TransactionCategoryPicker";
import { TransactionDateField } from "./TransactionDateField";
import {
  TransactionTypeSwitch,
  type TransactionTypeSelection
} from "./TransactionTypeSwitch";
import {
  type CreateTransactionInput,
  type CreateTransactionField,
  TRANSACTION_NAME_MAX_LENGTH,
  validateCreateTransaction
} from "./transaction-validation";

type TransactionComposerProps = {
  open: boolean;
  transaction: TransactionPreview | null;
  disablePersistence?: boolean;
  onClose: () => void;
  onCreated: () => void;
  onUpdated: (transactionId: string) => void;
  onSessionExpired: () => void;
};

type InvalidFields = Partial<Record<CreateTransactionField, boolean>>;

type TransactionCurrencySelection = "EUR" | "USD";

type TypeDragGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  startIndex: number;
  maxDistance: number;
};

const CREATE_TRANSACTION_FIELDS: readonly CreateTransactionField[] = [
  "amount",
  "type",
  "description",
  "categoryId",
  "date"
];

const TYPE_DRAG_THRESHOLD = 14;
const TYPE_DRAG_OPTIONS: readonly TransactionType[] = ["INCOME", "EXPENSE"];
const TRANSACTION_CURRENCY_OPTIONS = [
  { value: "EUR", label: "\u20ac" },
  { value: "USD", label: "$" }
] as const;
const MINIMUM_TRANSACTION_DATE = "2026-01-01";

function isCreateTransactionField(
  field: unknown
): field is CreateTransactionField {
  return (
    typeof field === "string" &&
    CREATE_TRANSACTION_FIELDS.includes(field as CreateTransactionField)
  );
}

function normalizeAmountInput(value: string) {
  return value.replace(/\./g, ",").replace(/\s/g, "");
}

function formatStoredAmountInput(value: string) {
  const normalizedValue = normalizeAmountInput(value);
  const [wholePart, decimalPart] = normalizedValue.split(",");

  if (decimalPart && Number(decimalPart) === 0) {
    return wholePart;
  }

  return normalizedValue;
}

function amountToComparableCents(value: string) {
  const normalizedValue = value.trim().replace(",", ".");

  if (!/^\d+(?:\.\d{0,2})?$/.test(normalizedValue)) {
    return null;
  }

  const [wholePart, decimalPart = ""] = normalizedValue.split(".");

  return (
    BigInt(wholePart) * 100n +
    BigInt(decimalPart.padEnd(2, "0"))
  ).toString();
}

function getChangedFields(
  transaction: TransactionPreview,
  input: CreateTransactionInput
) {
  const changes: Partial<CreateTransactionInput> = {};

  if (input.type !== transaction.type) {
    changes.type = input.type;
  }

  if (input.categoryId !== transaction.categoryId) {
    changes.categoryId = input.categoryId;
  }

  if (input.description !== transaction.description) {
    changes.description = input.description;
  }

  if (input.date !== transaction.date) {
    changes.date = input.date;
  }

  if (
    amountToComparableCents(input.amount) !==
    amountToComparableCents(transaction.amount)
  ) {
    changes.amount = input.amount;
  }

  return changes;
}

export function TransactionComposer({
  open,
  transaction,
  disablePersistence = false,
  onClose,
  onCreated,
  onUpdated,
  onSessionExpired
}: TransactionComposerProps) {
  const isEditing = transaction !== null;
  const [type, setType] = useState<TransactionType>("EXPENSE");
  const [currency, setCurrency] =
    useState<TransactionCurrencySelection>("EUR");
  const [amount, setAmount] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [name, setName] = useState("");
  const [date, setDate] = useState(getTodayDateOnly);
  const [hasSelectedDate, setHasSelectedDate] = useState(false);
  const [invalidFields, setInvalidFields] = useState<InvalidFields>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [typeDragOffset, setTypeDragOffset] = useState(0);
  const [isTypeDragging, setIsTypeDragging] = useState(false);
  const amountInput = useRef<HTMLInputElement>(null);
  const nameInput = useRef<HTMLTextAreaElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLElement>(null);
  const typeDrag = useRef<TypeDragGesture | null>(null);
  const releaseTypeDragScrollLock = useRef<(() => void) | null>(null);
  const suppressNextComposerClick = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  const hasChanges =
    transaction === null ||
    type !== transaction.type ||
    selectedCategoryId !== transaction.categoryId ||
    name.trim() !== transaction.description ||
    date !== transaction.date ||
    amountToComparableCents(amount) !==
      amountToComparableCents(transaction.amount);
  const canSubmit =
    !isSubmitting &&
    amount.length > 0 &&
    name.trim().length > 0 &&
    selectedCategoryId !== null &&
    date.length > 0 &&
    hasChanges;
  const maximumTransactionDate = getTodayDateOnly();

  function lockScrollForTypeDrag() {
    if (releaseTypeDragScrollLock.current) {
      return;
    }

    releaseTypeDragScrollLock.current = acquireDragScrollLock();
  }

  function unlockScrollForTypeDrag() {
    releaseTypeDragScrollLock.current?.();
    releaseTypeDragScrollLock.current = null;
  }

  useEffect(() => {
    if (open && !wasOpen.current) {
      previousFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      setType(transaction?.type ?? "EXPENSE");
      setCurrency(transaction?.currency ?? "EUR");
      setAmount(
        transaction ? formatStoredAmountInput(transaction.amount) : ""
      );
      setSelectedCategoryId(transaction?.categoryId ?? null);
      setName(transaction?.description ?? "");
      setDate(transaction?.date ?? getTodayDateOnly());
      setHasSelectedDate(transaction !== null);
      setInvalidFields({});
      setFormError(null);
      setIsSubmitting(false);
      scrollArea.current?.scrollTo({ top: 0 });
      requestAnimationFrame(() => {
        composerRef.current?.focus({ preventScroll: true });
      });
    }

    if (!open && wasOpen.current) {
      requestAnimationFrame(() => previousFocus.current?.focus({ preventScroll: true }));
    }

    wasOpen.current = open;
  }, [open, transaction]);

  useEffect(() => {
    if (!open) {
      unlockScrollForTypeDrag();
      return;
    }

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }

    window.addEventListener("keydown", closeWithEscape);
    return () => {
      unlockScrollForTypeDrag();
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [isSubmitting, onClose, open]);

  useLayoutEffect(() => {
    const input = nameInput.current;

    if (!open || !input) {
      return;
    }

    input.style.height = "auto";

    const styles = window.getComputedStyle(input);
    const minHeight = Number.parseFloat(styles.minHeight);
    const maxHeight = Number.parseFloat(styles.maxHeight);
    const borderHeight =
      Number.parseFloat(styles.borderTopWidth) +
      Number.parseFloat(styles.borderBottomWidth);

    if (
      !Number.isFinite(minHeight) ||
      !Number.isFinite(maxHeight) ||
      !Number.isFinite(borderHeight)
    ) {
      return;
    }

    const contentHeight = input.scrollHeight + borderHeight;
    const wrappedContentBuffer = contentHeight > minHeight + 1 ? 1 : 0;
    const requiredHeight = contentHeight + wrappedContentBuffer;
    input.style.height = `${Math.min(
      Math.max(requiredHeight, minHeight),
      maxHeight
    )}px`;
    input.style.overflowY =
      contentHeight > maxHeight + 1 ? "auto" : "hidden";
  }, [name, open]);

  function clearFieldError(field: CreateTransactionField) {
    setInvalidFields((current) => {
      if (!current[field]) {
        return current;
      }

      return { ...current, [field]: false };
    });
    setFormError(null);
  }

  function selectType(nextType: TransactionTypeSelection) {
    if (nextType === "ALL") {
      return;
    }

    if (nextType === type) {
      return;
    }

    setType(nextType);
    setSelectedCategoryId(null);
    clearFieldError("type");
    clearFieldError("categoryId");
  }

  function getTypeSegmentMaxDistance() {
    const switchElement =
      composerRef.current?.querySelector<HTMLElement>(
        ".transaction-type-switch"
      ) ?? null;

    if (!switchElement) {
      return 0;
    }

    return Math.max(0, switchElement.clientWidth / TYPE_DRAG_OPTIONS.length - 4);
  }

  function startTypeDrag(event: ReactPointerEvent<HTMLElement>) {
    if (
      isSubmitting ||
      !open ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }

    const target = event.target instanceof Element ? event.target : null;

    if (
      target?.closest(".transaction-composer__footer") ||
      target?.closest(".transaction-type-switch")
    ) {
      return;
    }

    const startIndex = TYPE_DRAG_OPTIONS.indexOf(type);
    const maxDistance = getTypeSegmentMaxDistance();

    if (startIndex < 0 || maxDistance <= 0) {
      return;
    }

    typeDrag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startIndex,
      maxDistance
    };
    setIsTypeDragging(true);
    setTypeDragOffset(0);
  }

  function moveTypeDrag(event: ReactPointerEvent<HTMLElement>) {
    const currentDrag = typeDrag.current;

    if (!currentDrag || currentDrag.pointerId !== event.pointerId) {
      return;
    }

    const distance = event.clientX - currentDrag.startX;
    const verticalDistance = event.clientY - currentDrag.startY;
    const hasHorizontalIntent =
      Math.abs(distance) > Math.abs(verticalDistance) &&
      Math.abs(distance) >= 4;

    if (hasHorizontalIntent) {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }

      lockScrollForTypeDrag();
      event.preventDefault();
    }

    const minimumOffset =
      currentDrag.startIndex > 0 ? -currentDrag.maxDistance : 0;
    const maximumOffset =
      currentDrag.startIndex < TYPE_DRAG_OPTIONS.length - 1
        ? currentDrag.maxDistance
        : 0;

    setTypeDragOffset(Math.min(Math.max(distance, minimumOffset), maximumOffset));
  }

  function finishTypeDrag(event: ReactPointerEvent<HTMLElement>) {
    const currentDrag = typeDrag.current;

    if (!currentDrag || currentDrag.pointerId !== event.pointerId) {
      return;
    }

    const horizontalDistance = event.clientX - currentDrag.startX;
    const verticalDistance = event.clientY - currentDrag.startY;
    const direction = horizontalDistance > 0 ? 1 : -1;
    const nextIndex = currentDrag.startIndex + direction;
    const canMove = nextIndex >= 0 && nextIndex < TYPE_DRAG_OPTIONS.length;
    const hasHorizontalIntent =
      Math.abs(horizontalDistance) > Math.abs(verticalDistance);
    const shouldHandleGesture =
      hasHorizontalIntent && Math.abs(horizontalDistance) >= TYPE_DRAG_THRESHOLD;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    typeDrag.current = null;
    setIsTypeDragging(false);
    setTypeDragOffset(0);
    unlockScrollForTypeDrag();

    if (shouldHandleGesture) {
      suppressNextComposerClick.current = true;
      window.setTimeout(() => {
        suppressNextComposerClick.current = false;
      }, 0);
    }

    if (canMove && shouldHandleGesture) {
      selectType(TYPE_DRAG_OPTIONS[nextIndex]);
    }
  }

  function cancelTypeDrag(event: ReactPointerEvent<HTMLElement>) {
    if (typeDrag.current?.pointerId !== event.pointerId) {
      return;
    }

    typeDrag.current = null;
    setIsTypeDragging(false);
    setTypeDragOffset(0);
    unlockScrollForTypeDrag();
  }

  function handleComposerClickCapture(event: ReactMouseEvent<HTMLElement>) {
    if (!suppressNextComposerClick.current) {
      return;
    }

    suppressNextComposerClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  function updateAmount(value: string) {
    const normalizedValue = normalizeAmountInput(value);

    if (/^\d{0,8}(?:,\d{0,2})?$/.test(normalizedValue)) {
      setAmount(normalizedValue);
      clearFieldError("amount");
    }
  }

  function moveAmountCaretToEnd() {
    requestAnimationFrame(() => {
      const input = amountInput.current;

      if (!input) {
        return;
      }

      const end = input.value.length;
      input.setSelectionRange(end, end);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const parsedTransaction = validateCreateTransaction({
      amount,
      type,
      description: name,
      categoryId: selectedCategoryId ?? "",
      date
    });

    if (!parsedTransaction.success) {
      const nextInvalidFields: InvalidFields = {};

      for (const issue of parsedTransaction.error.issues) {
        const field = issue.path[0];

        if (isCreateTransactionField(field)) {
          nextInvalidFields[field] = true;
        }
      }

      setInvalidFields(nextInvalidFields);
      setFormError(
        parsedTransaction.error.issues[0]?.message ??
          "Check the transaction details"
      );
      return;
    }

    setInvalidFields({});
    setFormError(null);

    if (disablePersistence) {
      return;
    }

    setIsSubmitting(true);
    prefetchScheduler.prioritizeUserRequest();

    try {
      if (transaction) {
        const changedFields = getChangedFields(
          transaction,
          parsedTransaction.data
        );

        if (Object.keys(changedFields).length === 0) {
          return;
        }

        await updateTransaction(transaction.id, changedFields);
        onUpdated(transaction.id);
      } else {
        await createTransaction(parsedTransaction.data);
        onCreated();
      }
    } catch (error) {
      if (error instanceof TransactionApiError && error.status === 401) {
        onSessionExpired();
        return;
      }

      if (error instanceof TransactionApiError) {
        const nextInvalidFields: InvalidFields = {};

        for (const issue of error.issues) {
          const field = issue.field;

          if (isCreateTransactionField(field)) {
            nextInvalidFields[field] = true;
          }
        }

        setInvalidFields(nextInvalidFields);
      }

      setFormError(
        error instanceof Error
          ? error.message
          : isEditing
            ? "Unable to update the transaction\nPlease try again"
            : "Unable to add the transaction\nPlease try again"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleFormKeyDownCapture(
    event: ReactKeyboardEvent<HTMLFormElement>
  ) {
    if (
      !isEditing ||
      event.key !== "Enter" ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    const target = event.target;

    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement
    ) {
      event.preventDefault();
      target.blur();
    }
  }

  return createPortal(
    <section
      ref={composerRef}
      className={`transaction-composer transaction-composer--${type.toLowerCase()}${
        isEditing ? " transaction-composer--editing" : ""
      }${open ? " is-open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-composer-title"
      aria-hidden={!open}
      inert={!open}
      tabIndex={-1}
      onClickCapture={handleComposerClickCapture}
      onPointerDown={startTypeDrag}
      onPointerMove={moveTypeDrag}
      onPointerUp={finishTypeDrag}
      onPointerCancel={cancelTypeDrag}
    >
      <header className="transaction-composer__header">
        <div className="transaction-composer__header-inner">
          <ActionButton
            shape="icon"
            className="transaction-composer__close"
            type="button"
            disabled={isSubmitting}
            aria-label={
              isEditing ? "Close transaction editor" : "Close new transaction"
            }
            title="Close"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </ActionButton>
          <h1 id="transaction-composer-title">
            {isEditing ? "Edit transaction" : "New transaction"}
          </h1>
          <SlidingSegmentedControl
            className="transaction-currency-toggle"
            value={currency}
            options={TRANSACTION_CURRENCY_OPTIONS}
            onChange={setCurrency}
            label="Transaction currency"
            compact
            allowDrag={false}
            disabled={isSubmitting}
          />
        </div>
      </header>

      <form
        className="transaction-composer__form"
        noValidate
        aria-busy={isSubmitting}
        onSubmit={handleSubmit}
        onKeyDownCapture={handleFormKeyDownCapture}
      >
        <div
          ref={scrollArea}
          className="transaction-composer__scroll-area"
        >
          <div className="transaction-composer__content">
            <TransactionTypeSwitch
              value={type}
              disabled={isSubmitting}
              onChange={selectType}
              externalDragOffset={isTypeDragging ? typeDragOffset : undefined}
              externalDragging={isTypeDragging}
            />

            <div className="transaction-composer__amount-section">
              <label className="sr-only" htmlFor="transaction-amount">
                Amount
              </label>
              <div className="transaction-composer__amount-entry">
                <span className="transaction-composer__amount-value">
                  <span aria-hidden="true">{amount || "0,00"}</span>
                  <input
                    ref={amountInput}
                    id="transaction-amount"
                    name="amount"
                    type="text"
                    inputMode="decimal"
                    enterKeyHint="next"
                    autoComplete="off"
                    placeholder="0,00"
                    value={amount}
                    maxLength={11}
                    disabled={isSubmitting}
                    aria-invalid={invalidFields.amount === true}
                    aria-describedby={formError ? "transaction-form-error" : undefined}
                    onClick={moveAmountCaretToEnd}
                    onFocus={moveAmountCaretToEnd}
                    onChange={(event) => updateAmount(event.target.value)}
                  />
                </span>
                <span aria-hidden="true">
                  {currency === "EUR" ? "\u20ac" : "$"}
                </span>
              </div>
            </div>

            <div className="transaction-composer__field">
              <div className="transaction-composer__field-heading">
                <span className="text-field-label" id="transaction-name-label">
                  Name
                </span>
                {name.length >= 35 ? (
                  <span
                    className="transaction-composer__character-count"
                    aria-live="polite"
                  >
                    {name.length}/{TRANSACTION_NAME_MAX_LENGTH}
                  </span>
                ) : null}
              </div>
              <textarea
                ref={nameInput}
                id="transaction-name"
                className="text-field text-field--composer text-field--multiline"
                name="description"
                rows={1}
                enterKeyHint="next"
                autoComplete="off"
                placeholder="What was it?"
                value={name}
                maxLength={TRANSACTION_NAME_MAX_LENGTH}
                disabled={isSubmitting}
                aria-labelledby="transaction-name-label"
                aria-invalid={invalidFields.description === true}
                aria-describedby={formError ? "transaction-form-error" : undefined}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();

                    if (isEditing) {
                      event.currentTarget.blur();
                      return;
                    }

                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                onChange={(event) => {
                  setName(event.target.value.replace(/[\r\n]+/g, " "));
                  clearFieldError("description");
                }}
              />
            </div>

            <TransactionCategoryPicker
              type={type}
              selectedCategoryIds={
                selectedCategoryId ? [selectedCategoryId] : []
              }
              onCategorySelect={(categoryId) => {
                setSelectedCategoryId(categoryId);
                clearFieldError("categoryId");
              }}
              disabled={isSubmitting}
              invalid={invalidFields.categoryId === true}
              describedBy={formError ? "transaction-form-error" : undefined}
            />

            <TransactionDateField
              id="transaction-date"
              name="date"
              label="Date"
              value={date}
              minimumDate={MINIMUM_TRANSACTION_DATE}
              maximumDate={maximumTransactionDate}
              selected={hasSelectedDate}
              disabled={isSubmitting}
              invalid={invalidFields.date === true}
              describedBy={formError ? "transaction-form-error" : undefined}
              onChange={(nextDate) => {
                setDate(nextDate);
                setHasSelectedDate(true);
                clearFieldError("date");
              }}
            />
          </div>
        </div>

        <footer className="transaction-composer__footer">
          <div>
            <p
              id="transaction-form-error"
              className="transaction-composer__message"
              role="alert"
              aria-live="polite"
            >
              {formError ? formatErrorMessage(formError) : ""}
            </p>
            <ActionButton type="submit" disabled={!canSubmit}>
              {isSubmitting
                ? isEditing
                  ? "Saving"
                  : "Adding"
                : isEditing
                  ? "Save changes"
                  : "Add transaction"}
            </ActionButton>
          </div>
        </footer>
      </form>
    </section>,
    document.body
  );
}
