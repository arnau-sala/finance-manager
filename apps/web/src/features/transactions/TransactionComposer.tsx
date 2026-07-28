import {
  type FormEvent,
  useEffect,
  useRef,
  useState
} from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

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
  validateCreateTransaction
} from "./transaction-validation";

type TransactionComposerProps = {
  open: boolean;
  transaction: TransactionPreview | null;
  onClose: () => void;
  onCreated: () => void;
  onUpdated: () => void;
  onSessionExpired: () => void;
};

type InvalidFields = Partial<Record<CreateTransactionField, boolean>>;

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
  onClose,
  onCreated,
  onUpdated,
  onSessionExpired
}: TransactionComposerProps) {
  const isEditing = transaction !== null;
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
  const amountInput = useRef<HTMLInputElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (open && !wasOpen.current) {
      previousFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      setType(transaction?.type ?? "EXPENSE");
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
    }

    if (!open && wasOpen.current) {
      requestAnimationFrame(() => previousFocus.current?.focus({ preventScroll: true }));
    }

    wasOpen.current = open;
  }, [open, transaction]);

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
      if (transaction) {
        const changedFields = getChangedFields(
          transaction,
          parsedTransaction.data
        );

        if (Object.keys(changedFields).length === 0) {
          return;
        }

        await updateTransaction(transaction.id, changedFields);
        onUpdated();
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
            ? "Unable to update the transaction. Please try again."
            : "Unable to add the transaction. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return createPortal(
    <section
      className={`transaction-composer transaction-composer--${type.toLowerCase()}${
        isEditing ? " transaction-composer--editing" : ""
      }${open ? " is-open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-composer-title"
      aria-hidden={!open}
      inert={!open}
    >
      <header className="transaction-composer__header">
        <div className="transaction-composer__header-inner">
          <button
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
          </button>
          <h1 id="transaction-composer-title">
            {isEditing ? "Edit transaction" : "New transaction"}
          </h1>
          <span aria-hidden="true" />
        </div>
      </header>

      <form
        className="transaction-composer__form"
        noValidate
        aria-busy={isSubmitting}
        onSubmit={handleSubmit}
      >
        <div
          ref={scrollArea}
          className="transaction-composer__scroll-area"
        >
          <div className="transaction-composer__content">
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
                <span aria-hidden="true">€</span>
              </div>
            </div>

            <TransactionTypeSwitch
              value={type}
              disabled={isSubmitting}
              onChange={selectType}
            />

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
              {formError ?? ""}
            </p>
            <button type="submit" disabled={!canSubmit}>
              {isSubmitting
                ? isEditing
                  ? "Saving..."
                  : "Adding..."
                : isEditing
                  ? "Save changes"
                  : "Add transaction"}
            </button>
          </div>
        </footer>
      </form>
    </section>,
    document.body
  );
}
