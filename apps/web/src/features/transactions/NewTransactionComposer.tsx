import {
  type CSSProperties,
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

type NewTransactionComposerProps = {
  open: boolean;
  onClose: () => void;
};

type TypeDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  startType: TransactionType;
  maxDistance: number;
};

const TYPE_DRAG_THRESHOLD = 14;

function normalizeAmountInput(value: string) {
  return value.replace(/\./g, ",").replace(/\s/g, "");
}

export function NewTransactionComposer({
  open,
  onClose
}: NewTransactionComposerProps) {
  const [type, setType] = useState<TransactionType>("EXPENSE");
  const [amount, setAmount] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [name, setName] = useState("");
  const [date, setDate] = useState(getTodayDateOnly);
  const [hasSelectedDate, setHasSelectedDate] = useState(false);
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
    amount.length > 0 && name.trim().length > 0 && selectedCategoryId !== null;

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
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [onClose, open]);

  function selectType(nextType: TransactionType) {
    if (nextType === type) {
      return;
    }

    setType(nextType);
    setSelectedCategoryId(null);
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
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="transaction-composer__scroll-area">
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

            <fieldset className="transaction-category-picker">
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
                      onClick={() => setSelectedCategoryId(category.id)}
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
                aria-labelledby="transaction-name-label"
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="transaction-composer__field">
              <span id="transaction-date-label">Date</span>
              <div
                className={`transaction-composer__date-control${
                  hasSelectedDate ? " is-selected" : ""
                }`}
              >
                <input
                  id="transaction-date"
                  name="date"
                  type="date"
                  value={date}
                  aria-labelledby="transaction-date-label"
                  onChange={(event) => {
                    setDate(event.target.value);
                    setHasSelectedDate(true);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <footer className="transaction-composer__footer">
          <div>
            <button type="submit" disabled={!canAdd}>
              Add transaction
            </button>
          </div>
        </footer>
      </form>
    </section>
  );
}
