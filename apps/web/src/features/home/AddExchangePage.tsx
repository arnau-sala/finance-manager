import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState
} from "react";
import { ArrowLeftRight, X } from "lucide-react";
import { createPortal } from "react-dom";

import { ActionButton } from "../../components/ui/ActionButton";
import { getTodayDateOnly } from "../../dates/date-only";
import { revealTrailingCaret } from "../auth/AuthPasswordField";
import {
  createCurrencyExchange,
  CurrencyApiError,
  type CurrencyExchangeListItem,
  updateCurrencyExchange
} from "../currency/currency-api";
import { TransactionDateField } from "../transactions/TransactionDateField";

type AddExchangePageProps = {
  open: boolean;
  exchange?: CurrencyExchangeListItem | null;
  onClose: () => void;
  onCreated: () => void;
  onUpdated?: (exchange: CurrencyExchangeListItem) => void;
  onSessionExpired: () => void;
};

type ExchangeCurrency = "EUR" | "USD";
type ExchangeField = "fromAmount" | "toAmount" | "rate";
type ExchangeRateSide = "from" | "to";

type ExchangeValues = Record<ExchangeField, string>;
type ExchangeFormState = {
  values: ExchangeValues;
  derivedField: ExchangeField | null;
};
type ExchangeRateDraft = {
  side: ExchangeRateSide;
  value: string;
};

const MINIMUM_EXCHANGE_DATE = "2026-01-01";
const EXCHANGE_FIELDS: readonly ExchangeField[] = [
  "fromAmount",
  "toAmount",
  "rate"
];
const FIELD_PROTECTION_ORDER: readonly ExchangeField[] = [
  "fromAmount",
  "toAmount",
  "rate"
];
const INITIAL_EXCHANGE_VALUES: ExchangeValues = {
  fromAmount: "",
  toAmount: "",
  rate: ""
};
const SWAP_ANIMATION_MS = 380;

function getTargetCurrency(fromCurrency: ExchangeCurrency): ExchangeCurrency {
  return fromCurrency === "EUR" ? "USD" : "EUR";
}

function getCurrencySymbol(currency: ExchangeCurrency) {
  return currency === "EUR" ? "\u20ac" : "$";
}

function normalizeMoneyInput(value: string) {
  const normalizedValue = value.replace(/\./g, ",").replace(/\s/g, "");

  if (/^\d{0,8}(?:,\d{0,2})?$/.test(normalizedValue)) {
    return normalizedValue;
  }

  return null;
}

function normalizeRateInput(value: string) {
  const normalizedValue = value.replace(/\./g, ",").replace(/\s/g, "");

  if (/^\d{0,4}(?:,\d{0,10})?$/.test(normalizedValue)) {
    return normalizedValue;
  }

  return null;
}

function parseMoneyInput(value: string) {
  if (!/^\d{1,8}(?:,\d{1,2})?$/.test(value)) {
    return null;
  }

  const amount = Number(value.replace(",", "."));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function parseRateInput(value: string) {
  if (!/^\d{1,4}(?:,\d{1,10})?$/.test(value)) {
    return null;
  }

  const rate = Number(value.replace(",", "."));
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function formatMoneyInput(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  const cents = Math.round(value * 100);
  const wholePart = Math.trunc(cents / 100);
  const decimalPart = cents % 100;

  return decimalPart === 0
    ? wholePart.toString()
    : `${wholePart},${decimalPart.toString().padStart(2, "0")}`;
}

function formatStoredMoneyInput(value: string) {
  const normalizedValue = normalizeMoneyInput(value);

  if (normalizedValue === null) {
    return "";
  }

  const [wholePart, decimalPart] = normalizedValue.split(",");

  if (decimalPart && Number(decimalPart) === 0) {
    return wholePart;
  }

  return normalizedValue;
}

function amountInputToComparableCents(value: string) {
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

function formatRateInput(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  return value
    .toFixed(6)
    .replace(/(?:\.0+|(\.\d*?)0+)$/, "$1")
    .replace(".", ",");
}

function toApiDecimal(value: string) {
  return value.replace(",", ".");
}

function isFieldReady(field: ExchangeField, value: string) {
  return field === "rate"
    ? parseRateInput(value) !== null
    : parseMoneyInput(value) !== null;
}

function deriveExchangeField(
  values: ExchangeValues,
  field: ExchangeField,
  fromCurrency: ExchangeCurrency
) {
  const fromAmount = parseMoneyInput(values.fromAmount);
  const toAmount = parseMoneyInput(values.toAmount);
  const rate = parseRateInput(values.rate);

  if (field === "rate") {
    if (fromAmount === null || toAmount === null) {
      return null;
    }

    return formatRateInput(
      fromCurrency === "EUR"
        ? fromAmount / toAmount
        : toAmount / fromAmount
    );
  }

  if (field === "toAmount") {
    if (fromAmount === null || rate === null) {
      return null;
    }

    return formatMoneyInput(
      fromCurrency === "EUR" ? fromAmount / rate : fromAmount * rate
    );
  }

  if (toAmount === null || rate === null) {
    return null;
  }

  return formatMoneyInput(
    fromCurrency === "EUR" ? toAmount * rate : toAmount / rate
  );
}

function recalculateExchangeValues(
  values: ExchangeValues,
  changedField: ExchangeField,
  fromCurrency: ExchangeCurrency
): ExchangeFormState {
  if (!isFieldReady(changedField, values[changedField])) {
    return { values, derivedField: null };
  }

  const companionField = FIELD_PROTECTION_ORDER.find(
    (field) =>
      field !== changedField && isFieldReady(field, values[field])
  );

  if (!companionField) {
    return { values, derivedField: null };
  }

  const derivedField =
    EXCHANGE_FIELDS.find(
      (field) => field !== changedField && field !== companionField
    ) ?? null;

  if (!derivedField) {
    return { values, derivedField: null };
  }

  const derivedValue = deriveExchangeField(
    values,
    derivedField,
    fromCurrency
  );

  if (!derivedValue) {
    return { values, derivedField: null };
  }

  return {
    values: {
      ...values,
      [derivedField]: derivedValue
    },
    derivedField
  };
}

export function AddExchangePage({
  open,
  exchange = null,
  onClose,
  onCreated,
  onUpdated,
  onSessionExpired
}: AddExchangePageProps) {
  const isEditing = exchange !== null;
  const [fromCurrency, setFromCurrency] =
    useState<ExchangeCurrency>("EUR");
  const [form, setForm] = useState<ExchangeFormState>({
    values: INITIAL_EXCHANGE_VALUES,
    derivedField: null
  });
  const [rateDraft, setRateDraft] = useState<ExchangeRateDraft | null>(null);
  const [swapRotation, setSwapRotation] = useState(0);
  const [isSwapAnimating, setIsSwapAnimating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [date, setDate] = useState(getTodayDateOnly);
  const exchangeRef = useRef<HTMLElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const swapAnimationTimeout = useRef<number | null>(null);
  const wasOpen = useRef(false);

  const toCurrency = getTargetCurrency(fromCurrency);
  const hasChanges =
    !exchange ||
    fromCurrency !== exchange.fromCurrency ||
    toCurrency !== exchange.toCurrency ||
    date !== exchange.date ||
    amountInputToComparableCents(form.values.fromAmount) !==
      amountInputToComparableCents(exchange.fromAmount) ||
    amountInputToComparableCents(form.values.toAmount) !==
      amountInputToComparableCents(exchange.toAmount);
  const canSubmit =
    isFieldReady("fromAmount", form.values.fromAmount) &&
    isFieldReady("toAmount", form.values.toAmount) &&
    isFieldReady("rate", form.values.rate) &&
    date.length > 0 &&
    hasChanges &&
    !isSubmitting;
  const fromRateBaseCurrency = toCurrency;
  const fromRateTargetCurrency = fromCurrency;
  const toRateBaseCurrency = fromCurrency;
  const toRateTargetCurrency = toCurrency;

  useEffect(() => {
    if (open && !wasOpen.current) {
      previousFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      setFromCurrency(exchange?.fromCurrency ?? "EUR");
      setForm({
        values: exchange
          ? {
              fromAmount: formatStoredMoneyInput(exchange.fromAmount),
              toAmount: formatStoredMoneyInput(exchange.toAmount),
              rate: formatRateInput(Number(exchange.exchangeRateBasePerUsd))
            }
          : INITIAL_EXCHANGE_VALUES,
        derivedField: null
      });
      setRateDraft(null);
      setSwapRotation(0);
      setIsSwapAnimating(false);
      setIsSubmitting(false);
      setFormError(null);
      if (swapAnimationTimeout.current !== null) {
        window.clearTimeout(swapAnimationTimeout.current);
        swapAnimationTimeout.current = null;
      }
      setDate(exchange?.date ?? getTodayDateOnly());
      scrollAreaRef.current?.scrollTo({ top: 0 });
      requestAnimationFrame(() => {
        exchangeRef.current?.focus({ preventScroll: true });
      });
    }

    if (!open && wasOpen.current) {
      requestAnimationFrame(() =>
        previousFocus.current?.focus({ preventScroll: true })
      );
    }

    wasOpen.current = open;
  }, [exchange, open]);

  useEffect(
    () => () => {
      if (swapAnimationTimeout.current !== null) {
        window.clearTimeout(swapAnimationTimeout.current);
      }
    },
    []
  );

  function updateField(field: ExchangeField, value: string) {
    const normalizedValue =
      field === "rate" ? normalizeRateInput(value) : normalizeMoneyInput(value);

    if (normalizedValue === null) {
      return;
    }

    setFormError(null);
    setRateDraft(null);
    setForm((current) =>
      recalculateExchangeValues(
        {
          ...current.values,
          [field]: normalizedValue
        },
        field,
        fromCurrency
      )
    );
  }

  function updateDisplayedRate(
    side: ExchangeRateSide,
    baseCurrency: ExchangeCurrency,
    targetCurrency: ExchangeCurrency,
    value: string
  ) {
    const normalizedValue = normalizeRateInput(value);

    if (normalizedValue === null) {
      return;
    }

    setFormError(null);
    setRateDraft({ side, value: normalizedValue });
    const displayedRate = parseRateInput(normalizedValue);

    if (displayedRate === null) {
      setForm((current) => ({
        values: {
          ...current.values,
          rate: ""
        },
        derivedField: null
      }));
      return;
    }

    const canonicalRate = getCanonicalRateFromCurrencyPair(
      baseCurrency,
      targetCurrency,
      displayedRate
    );

    setForm((current) =>
      recalculateExchangeValues(
        {
          ...current.values,
          rate: formatRateInput(canonicalRate)
        },
        "rate",
        fromCurrency
      )
    );
  }

  function swapCurrencies() {
    if (isSwapAnimating) {
      return;
    }

    setFormError(null);
    const nextFromCurrency = getTargetCurrency(fromCurrency);

    setRateDraft(null);
    setIsSwapAnimating(true);
    setSwapRotation((currentRotation) => currentRotation + 180);
    setFromCurrency(nextFromCurrency);
    setForm((current) =>
      recalculateExchangeValues(
        {
          fromAmount: current.values.toAmount,
          toAmount: current.values.fromAmount,
          rate: current.values.rate
        },
        "toAmount",
        nextFromCurrency
      )
    );
    swapAnimationTimeout.current = window.setTimeout(() => {
      setIsSwapAnimating(false);
      swapAnimationTimeout.current = null;
    }, SWAP_ANIMATION_MS);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      const exchangeInput = {
        fromCurrency,
        toCurrency,
        fromAmount: toApiDecimal(form.values.fromAmount),
        toAmount: toApiDecimal(form.values.toAmount),
        date
      };

      if (exchange) {
        const updatedExchange = await updateCurrencyExchange(
          exchange.id,
          exchangeInput
        );
        onUpdated?.(updatedExchange);
      } else {
        await createCurrencyExchange(exchangeInput);
        onCreated();
      }
    } catch (error) {
      if (error instanceof CurrencyApiError && error.status === 401) {
        onSessionExpired();
        return;
      }

      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to save the exchange\nPlease try again"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDateChange(nextDate: string) {
    setFormError(null);
    setDate(nextDate);
  }

  function handleFormKeyDownCapture(
    event: ReactKeyboardEvent<HTMLFormElement>
  ) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }

    const target = event.target;

    if (target instanceof HTMLInputElement) {
      event.preventDefault();
      target.blur();
    }
  }

  return createPortal(
    <section
      ref={exchangeRef}
      className={`transaction-composer add-exchange-composer${
        open ? " is-open" : ""
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-exchange-title"
      aria-hidden={!open}
      inert={!open}
      tabIndex={-1}
    >
      <header className="transaction-composer__header">
        <div className="transaction-composer__header-inner">
          <ActionButton
            shape="icon"
            className="transaction-composer__close"
            type="button"
            aria-label={isEditing ? "Close exchange editor" : "Close exchange creator"}
            title="Close"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </ActionButton>
          <h1 id="add-exchange-title">
            {isEditing ? "Edit exchange" : "Add exchange"}
          </h1>
          <span aria-hidden="true" />
        </div>
      </header>

      <form
        className="transaction-composer__form add-exchange-form"
        noValidate
        onSubmit={handleSubmit}
        onKeyDownCapture={handleFormKeyDownCapture}
      >
        <div
          ref={scrollAreaRef}
          className="transaction-composer__scroll-area"
        >
          <div className="transaction-composer__content add-exchange-content">
            <div className="add-exchange-direction" aria-label="Exchange direction">
              <div className="add-exchange-direction__currency">
                <span>From</span>
                <strong>
                  {fromCurrency}
                  <span aria-hidden="true">{getCurrencySymbol(fromCurrency)}</span>
                </strong>
              </div>
              <ActionButton
                shape="icon"
                className={`add-exchange-direction__swap${
                  isSwapAnimating ? " is-animating" : ""
                }`}
                type="button"
                onClick={swapCurrencies}
                disabled={isSwapAnimating}
                aria-label="Swap exchange direction"
                style={
                  {
                    "--add-exchange-swap-rotation": `${swapRotation}deg`
                  } as CSSProperties
                }
              >
                <ArrowLeftRight aria-hidden="true" strokeWidth={1.8} />
              </ActionButton>
              <div className="add-exchange-direction__currency">
                <span>To</span>
                <strong>
                  {toCurrency}
                  <span aria-hidden="true">{getCurrencySymbol(toCurrency)}</span>
                </strong>
              </div>
            </div>

            <div className="add-exchange-columns">
              <ExchangeCurrencyColumn
                id="add-exchange-from-amount"
                amountLabel="Amount deposited"
                amountValue={form.values.fromAmount}
                amountSymbol={getCurrencySymbol(fromCurrency)}
                amountCalculated={form.derivedField === "fromAmount"}
                rateValue={
                  rateDraft?.side === "from"
                    ? rateDraft.value
                    : getRateValueForCurrencyPair(
                        fromRateBaseCurrency,
                        fromRateTargetCurrency,
                        form.values.rate
                      )
                }
                ratePrefix={`1${getCurrencySymbol(fromRateBaseCurrency)} =`}
                rateSymbol={getCurrencySymbol(fromRateTargetCurrency)}
                rateCalculated={form.derivedField === "rate"}
                onAmountChange={(value) => updateField("fromAmount", value)}
                onRateChange={(value) =>
                  updateDisplayedRate(
                    "from",
                    fromRateBaseCurrency,
                    fromRateTargetCurrency,
                    value
                  )
                }
              />

              <ExchangeCurrencyColumn
                id="add-exchange-to-amount"
                amountLabel="Amount received"
                amountValue={form.values.toAmount}
                amountSymbol={getCurrencySymbol(toCurrency)}
                amountCalculated={form.derivedField === "toAmount"}
                rateValue={
                  rateDraft?.side === "to"
                    ? rateDraft.value
                    : getRateValueForCurrencyPair(
                        toRateBaseCurrency,
                        toRateTargetCurrency,
                        form.values.rate
                      )
                }
                ratePrefix={`1${getCurrencySymbol(toRateBaseCurrency)} =`}
                rateSymbol={getCurrencySymbol(toRateTargetCurrency)}
                rateCalculated={form.derivedField === "rate"}
                onAmountChange={(value) => updateField("toAmount", value)}
                onRateChange={(value) =>
                  updateDisplayedRate(
                    "to",
                    toRateBaseCurrency,
                    toRateTargetCurrency,
                    value
                  )
                }
              />
            </div>

            <TransactionDateField
              id="add-exchange-date"
              label="Date"
              value={date}
              minimumDate={MINIMUM_EXCHANGE_DATE}
              maximumDate={getTodayDateOnly()}
              selected
              pickerPlacement="auto"
              onChange={handleDateChange}
            />
          </div>
        </div>

        <footer className="transaction-composer__footer">
          <div>
            <p className="transaction-composer__message" aria-live="polite">
              {formError}
            </p>
            <ActionButton type="submit" disabled={!canSubmit}>
              {isSubmitting
                ? isEditing
                  ? "Updating exchange"
                  : "Adding exchange"
                : isEditing
                  ? "Update exchange"
                  : "Add exchange"}
            </ActionButton>
          </div>
        </footer>
      </form>
    </section>,
    document.body
  );
}

function getRateValueForCurrencyPair(
  baseCurrency: ExchangeCurrency,
  targetCurrency: ExchangeCurrency,
  value: string
) {
  const rate = parseRateInput(value);

  if (rate === null) {
    return "";
  }

  if (baseCurrency === "EUR" && targetCurrency === "USD") {
    return formatRateInput(1 / rate);
  }

  return formatRateInput(rate);
}

function getCanonicalRateFromCurrencyPair(
  baseCurrency: ExchangeCurrency,
  targetCurrency: ExchangeCurrency,
  displayedRate: number
) {
  return baseCurrency === "EUR" && targetCurrency === "USD"
    ? 1 / displayedRate
    : displayedRate;
}

type ExchangeCurrencyColumnProps = {
  id: string;
  amountLabel: string;
  amountValue: string;
  amountSymbol: string;
  amountCalculated: boolean;
  rateValue: string;
  rateSymbol: string;
  ratePrefix: string;
  rateCalculated: boolean;
  onAmountChange: (value: string) => void;
  onRateChange?: (value: string) => void;
};

function ExchangeCurrencyColumn({
  id,
  amountLabel,
  amountValue,
  amountSymbol,
  amountCalculated,
  rateValue,
  rateSymbol,
  ratePrefix,
  rateCalculated,
  onAmountChange,
  onRateChange
}: ExchangeCurrencyColumnProps) {
  const labelId = `${id}-label`;
  const rateLabel = `${ratePrefix} ${rateSymbol}`;

  return (
    <section className="add-exchange-currency-card" aria-labelledby={labelId}>
      <div className="add-exchange-currency-card__field">
        <span className="add-exchange-currency-card__label" id={labelId}>
          {amountLabel}
        </span>
        <div className="add-exchange-currency-card__control">
          <input
            id={id}
            className="text-field text-field--composer add-exchange-currency-card__input"
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            placeholder="0"
            value={amountValue}
            aria-labelledby={labelId}
            onChange={(event) => onAmountChange(event.target.value)}
            onFocus={(event) => revealTrailingCaret(event.currentTarget)}
            onClick={(event) => revealTrailingCaret(event.currentTarget)}
          />
          <span
            className="add-exchange-currency-card__symbol"
            aria-hidden="true"
          >
            {amountSymbol}
          </span>
        </div>
        <span
          className={`add-exchange-currency-card__status${
            amountCalculated ? " is-visible" : ""
          }`}
        >
          Calculated
        </span>
      </div>

      <div className="add-exchange-currency-card__rate">
        <label
          className={`add-exchange-rate-control${
            rateCalculated ? " is-calculated" : ""
          }`}
        >
          <span>{ratePrefix}</span>
          <span className="add-exchange-rate-control__field">
            <input
              className="add-exchange-rate-control__input"
              type="text"
              inputMode="decimal"
              enterKeyHint="done"
              autoComplete="off"
              placeholder="0,0000"
              value={rateValue}
              aria-label={`Exchange rate ${rateLabel}`}
              onChange={(event) => onRateChange?.(event.target.value)}
              onFocus={(event) => revealTrailingCaret(event.currentTarget)}
              onClick={(event) => revealTrailingCaret(event.currentTarget)}
            />
            <span
              className="add-exchange-rate-control__symbol"
              aria-hidden="true"
            >
              {rateSymbol}
            </span>
          </span>
        </label>
      </div>
    </section>
  );
}
