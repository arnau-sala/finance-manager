import {
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  X
} from "lucide-react";

import { getTodayDateOnly } from "../../dates/date-only";
import {
  transactionCategories,
  type TransactionType
} from "./category-catalog";
import {
  createTransaction,
  TransactionApiError
} from "./transaction-api";
import {
  type CreateTransactionField,
  validateCreateTransaction
} from "./transaction-validation";

type NewTransactionComposerProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  onSessionExpired: () => void;
};

type InvalidFields = Partial<Record<CreateTransactionField, boolean>>;

type TypeDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  startType: TransactionType;
  maxDistance: number;
};

const TYPE_DRAG_THRESHOLD = 14;
const CREATE_TRANSACTION_FIELDS: readonly CreateTransactionField[] = [
  "amount",
  "type",
  "description",
  "categoryId",
  "date"
];

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

export function NewTransactionComposer({
  open,
  onClose,
  onCreated,
  onSessionExpired
}: NewTransactionComposerProps) {
  const [type, setType] = useState<TransactionType>("EXPENSE");
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
  const typeToggle = useRef<HTMLDivElement>(null);
  const typeDrag = useRef<TypeDrag | null>(null);
  const suppressTypeClick = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  const visibleCategories = useMemo(
    () => transactionCategories.filter((category) => category.type === type),
    [type]
  );
  const canAdd =
    !isSubmitting &&
    amount.length > 0 &&
    name.trim().length > 0 &&
    selectedCategoryId !== null &&
    date.length > 0;

  useEffect(() => {
    if (open && !wasOpen.current) {
      previousFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      setType("EXPENSE");
      setAmount("");
      setSelectedCategoryId(null);
      setName("");
      setDate(getTodayDateOnly());
      setHasSelectedDate(false);
      setInvalidFields({});
      setFormError(null);
      setIsSubmitting(false);
    }

    if (!open && wasOpen.current) {
      requestAnimationFrame(() => previousFocus.current?.focus({ preventScroll: true }));
    }

    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }

    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [isSubmitting, onClose, open]);

  function clearFieldError(field: CreateTransactionField) {
    setInvalidFields((current) => {
      if (!current[field]) {
        return current;
      }

      return { ...current, [field]: false };
    });
    setFormError(null);
  }

  function selectType(nextType: TransactionType) {
    if (nextType === type) {
      return;
    }

    setType(nextType);
    setSelectedCategoryId(null);
    clearFieldError("type");
    clearFieldError("categoryId");
  }

  function handleTypeClick(nextType: TransactionType) {
    if (suppressTypeClick.current) {
      suppressTypeClick.current = false;
      return;
    }

    selectType(nextType);
  }

  function startTypeDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    startType: TransactionType
  ) {
    if (startType !== type || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }

    const toggleWidth = typeToggle.current?.clientWidth ?? 0;

    typeDrag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startType,
      maxDistance: Math.max(0, toggleWidth / 2 - 4)
    };
    setIsTypeDragging(true);
    setTypeDragOffset(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveTypeDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = typeDrag.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const distance = event.clientX - drag.startX;
    const offset =
      drag.startType === "EXPENSE"
        ? Math.min(Math.max(distance, 0), drag.maxDistance)
        : Math.max(Math.min(distance, 0), -drag.maxDistance);

    setTypeDragOffset(offset);
  }

  function finishTypeDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = typeDrag.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const horizontalDistance = event.clientX - drag.startX;
    const verticalDistance = event.clientY - drag.startY;
    const movedTowardOther =
      drag.startType === "EXPENSE"
        ? horizontalDistance >= TYPE_DRAG_THRESHOLD
        : horizontalDistance <= -TYPE_DRAG_THRESHOLD;
    const hasHorizontalIntent =
      Math.abs(horizontalDistance) > Math.abs(verticalDistance);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    typeDrag.current = null;
    setIsTypeDragging(false);
    setTypeDragOffset(0);

    if (movedTowardOther && hasHorizontalIntent) {
      suppressTypeClick.current = true;
      selectType(drag.startType === "EXPENSE" ? "INCOME" : "EXPENSE");
      window.setTimeout(() => {
        suppressTypeClick.current = false;
      }, 0);
    }
  }

  function cancelTypeDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (typeDrag.current?.pointerId !== event.pointerId) {
      return;
    }

    typeDrag.current = null;
    setIsTypeDragging(false);
    setTypeDragOffset(0);
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
          "Check the transaction details."
      );
      return;
    }

    setInvalidFields({});
    setFormError(null);
    setIsSubmitting(true);

    try {
      await createTransaction(parsedTransaction.data);
      onCreated();
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
          : "Unable to add the transaction. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className={`transaction-composer transaction-composer--${type.toLowerCase()}${
        open ? " is-open" : ""
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-transaction-title"
      aria-hidden={!open}
      inert={!open}
    >
      <header className="transaction-composer__header">
        <div className="transaction-composer__header-inner">
          <button
            className="transaction-composer__close"
            type="button"
            disabled={isSubmitting}
            aria-label="Close new transaction"
            title="Close"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
          <h1 id="new-transaction-title">New transaction</h1>
          <span aria-hidden="true" />
        </div>
      </header>

      <form
        className="transaction-composer__form"
        noValidate
        aria-busy={isSubmitting}
        onSubmit={handleSubmit}
      >
        <div className="transaction-composer__scroll-area">
          <div className="transaction-composer__content">
            <div
              className={`transaction-composer__amount-section${
                invalidFields.amount ? " has-error" : ""
              }`}
            >
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
                <span aria-hidden="true">€</span>
              </div>
              <span className="transaction-composer__amount-caption">
                {type === "EXPENSE" ? "Expense amount" : "Income amount"}
              </span>
            </div>

            <div
              ref={typeToggle}
              className={`transaction-type-toggle transaction-type-toggle--${type.toLowerCase()}${
                isTypeDragging ? " is-dragging" : ""
              }`}
              style={
                {
                  "--transaction-type-drag-offset": `${typeDragOffset}px`
                } as CSSProperties
              }
              role="radiogroup"
              aria-label="Transaction type"
            >
              <span className="transaction-type-toggle__indicator" aria-hidden="true" />
              <button
                type="button"
                disabled={isSubmitting}
                role="radio"
                aria-checked={type === "EXPENSE"}
                onClick={() => handleTypeClick("EXPENSE")}
                onPointerDown={(event) => startTypeDrag(event, "EXPENSE")}
                onPointerMove={moveTypeDrag}
                onPointerUp={finishTypeDrag}
                onPointerCancel={cancelTypeDrag}
              >
                <ArrowDownRight aria-hidden="true" />
                Expense
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                role="radio"
                aria-checked={type === "INCOME"}
                onClick={() => handleTypeClick("INCOME")}
                onPointerDown={(event) => startTypeDrag(event, "INCOME")}
                onPointerMove={moveTypeDrag}
                onPointerUp={finishTypeDrag}
                onPointerCancel={cancelTypeDrag}
              >
                <ArrowUpRight aria-hidden="true" />
                Income
              </button>
            </div>

            <div className="transaction-composer__field">
              <span id="transaction-name-label">Name</span>
              <input
                id="transaction-name"
                name="description"
                type="text"
                enterKeyHint="next"
                autoComplete="off"
                placeholder="What was it?"
                value={name}
                maxLength={100}
                disabled={isSubmitting}
                aria-labelledby="transaction-name-label"
                aria-invalid={invalidFields.description === true}
                aria-describedby={formError ? "transaction-form-error" : undefined}
                onChange={(event) => {
                  setName(event.target.value);
                  clearFieldError("description");
                }}
              />
            </div>

            <fieldset
              className="transaction-category-picker"
              disabled={isSubmitting}
              aria-invalid={invalidFields.categoryId === true}
              aria-describedby={formError ? "transaction-form-error" : undefined}
            >
              <legend>Category</legend>
              <div className="transaction-category-grid">
                {visibleCategories.map((category) => {
                  const Icon = category.icon;
                  const isSelected = selectedCategoryId === category.id;

                  return (
                    <button
                      key={category.id}
                      className={`transaction-category-option${
                        isSelected ? " is-selected" : ""
                      }`}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedCategoryId(category.id);
                        clearFieldError("categoryId");
                      }}
                    >
                      <span className="transaction-category-option__icon" aria-hidden="true">
                        <Icon />
                      </span>
                      <span>{category.name}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="transaction-composer__field">
              <span id="transaction-date-label">Date</span>
              <div
                className={`transaction-composer__date-control${
                  hasSelectedDate ? " is-selected" : ""
                }${invalidFields.date ? " is-invalid" : ""}`}
              >
                <input
                  id="transaction-date"
                  name="date"
                  type="date"
                  value={date}
                  disabled={isSubmitting}
                  aria-labelledby="transaction-date-label"
                  aria-invalid={invalidFields.date === true}
                  aria-describedby={formError ? "transaction-form-error" : undefined}
                  onChange={(event) => {
                    setDate(event.target.value);
                    setHasSelectedDate(true);
                    clearFieldError("date");
                  }}
                />
              </div>
            </div>
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
              {formError ?? ""}
            </p>
            <button type="submit" disabled={!canAdd}>
              {isSubmitting ? "Adding..." : "Add transaction"}
            </button>
          </div>
        </footer>
      </form>
    </section>
  );
}
