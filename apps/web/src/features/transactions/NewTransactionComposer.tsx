import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  X
} from "lucide-react";

import {
  transactionCategories,
  type TransactionType
} from "./category-catalog";

type NewTransactionComposerProps = {
  open: boolean;
  onClose: () => void;
};

function padDatePart(value: number) {
  return value.toString().padStart(2, "0");
}

function getCurrentDateAndTime() {
  const now = new Date();

  return {
    date: `${now.getFullYear()}-${padDatePart(now.getMonth() + 1)}-${padDatePart(
      now.getDate()
    )}`,
    time: `${padDatePart(now.getHours())}:${padDatePart(now.getMinutes())}`
  };
}

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
  const [date, setDate] = useState(() => getCurrentDateAndTime().date);
  const [time, setTime] = useState(() => getCurrentDateAndTime().time);
  const amountInput = useRef<HTMLInputElement>(null);
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

      const current = getCurrentDateAndTime();
      setType("EXPENSE");
      setAmount("");
      setSelectedCategoryId(null);
      setName("");
      setDate(current.date);
      setTime(current.time);
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
              className={`transaction-type-toggle transaction-type-toggle--${type.toLowerCase()}`}
              role="radiogroup"
              aria-label="Transaction type"
            >
              <span className="transaction-type-toggle__indicator" aria-hidden="true" />
              <button
                type="button"
                role="radio"
                aria-checked={type === "EXPENSE"}
                onClick={() => selectType("EXPENSE")}
              >
                <ArrowDownRight aria-hidden="true" />
                Expense
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={type === "INCOME"}
                onClick={() => selectType("INCOME")}
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

            <div className="transaction-composer__date-time">
              <div className="transaction-composer__field">
                <span id="transaction-date-label">
                  <CalendarDays aria-hidden="true" />
                  Date
                </span>
                <input
                  id="transaction-date"
                  name="date"
                  type="date"
                  value={date}
                  aria-labelledby="transaction-date-label"
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>

              <div className="transaction-composer__field">
                <span id="transaction-time-label">
                  <Clock3 aria-hidden="true" />
                  Time
                </span>
                <input
                  id="transaction-time"
                  name="time"
                  type="time"
                  step="60"
                  value={time}
                  aria-labelledby="transaction-time-label"
                  onChange={(event) => setTime(event.target.value)}
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
