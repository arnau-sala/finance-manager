import { type ReactNode, useEffect, useState } from "react";
import {
  ArrowLeftRight,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CircleEuroSign,
  Equal,
  Shapes
} from "lucide-react";

import {
  SlidingSegmentedControl,
  type SlidingSegmentOption
} from "../../components/ui/SlidingSegmentedControl";
import { getTodayDateOnly, parseLocalDateOnly } from "../../dates/date-only";
import {
  transactionCategories,
  type TransactionType
} from "./category-catalog";
import { TransactionCategoryPicker } from "./TransactionCategoryPicker";
import { TransactionDateField } from "./TransactionDateField";
import {
  TransactionTypeSwitch,
  type TransactionTypeSelection
} from "./TransactionTypeSwitch";

type TypeFilter = TransactionTypeSelection;
type FilterEditor = "amount" | "date" | "categories";
type ValueMode = "EXACT" | "RANGE";

type MovesFiltersPanelProps = {
  id: string;
  onActiveFilterCountChange: (count: number) => void;
};

const amountPattern = /^\d*(?:[.,]\d{0,2})?$/;
const FILTER_MODE_OPTIONS: readonly SlidingSegmentOption<ValueMode>[] = [
  { value: "RANGE", label: "Range", icon: ArrowLeftRight },
  { value: "EXACT", label: "Exact", icon: Equal }
];

function formatAmountValue(value: string) {
  return `${value.replace(".", ",")}\u20ac`;
}

function formatDateValue(value: string) {
  const date = parseLocalDateOnly(value);

  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric"
  }).format(date);
}

function formatCompactMonthYear(value: string) {
  const date = parseLocalDateOnly(value);

  if (!date) {
    return value;
  }

  return `${new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit"
  }).format(date)}'`;
}

export function MovesFiltersPanel({
  id,
  onActiveFilterCountChange
}: MovesFiltersPanelProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [activeEditor, setActiveEditor] = useState<FilterEditor | null>(null);
  const [amountMode, setAmountMode] = useState<ValueMode>("RANGE");
  const [exactAmount, setExactAmount] = useState("");
  const [minimumAmount, setMinimumAmount] = useState("");
  const [maximumAmount, setMaximumAmount] = useState("");
  const [dateMode, setDateMode] = useState<ValueMode>("RANGE");
  const [exactDate, setExactDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const today = getTodayDateOnly();
  const currentYear = Number(today.slice(0, 4));
  const useFullYearRangeFormat =
    dateMode === "RANGE" &&
    [startDate, endDate].some((value) => {
      const date = parseLocalDateOnly(value);
      return date !== null && date.getFullYear() !== currentYear;
    });
  const formatRangeDate = useFullYearRangeFormat
    ? formatCompactMonthYear
    : formatDateValue;
  const hasAmountFilter =
    amountMode === "EXACT"
      ? exactAmount.length > 0
      : minimumAmount.length > 0 || maximumAmount.length > 0;
  const hasDateFilter =
    dateMode === "EXACT"
      ? exactDate.length > 0
      : startDate.length > 0 || endDate.length > 0;
  const activeSelectedCategoryIds =
    typeFilter === "ALL"
      ? selectedCategoryIds
      : selectedCategoryIds.filter(
          (categoryId) =>
            transactionCategories.find((category) => category.id === categoryId)
              ?.type === typeFilter
        );
  const hasCategoryFilter = activeSelectedCategoryIds.length > 0;
  const activeFilterCount = [
    typeFilter !== "ALL",
    hasAmountFilter,
    hasDateFilter,
    hasCategoryFilter
  ].filter(Boolean).length;
  const visibleCategoryTypes: readonly TransactionType[] =
    typeFilter === "ALL" ? ["EXPENSE", "INCOME"] : [typeFilter];

  useEffect(() => {
    onActiveFilterCountChange(activeFilterCount);
  }, [activeFilterCount, onActiveFilterCountChange]);

  function updateAmount(value: string, update: (nextValue: string) => void) {
    if (amountPattern.test(value)) {
      update(value);
    }
  }

  function updateStartDate(value: string) {
    setStartDate(value);

    if (endDate && value > endDate) {
      setEndDate(value);
    }
  }

  function updateEndDate(value: string) {
    setEndDate(value);

    if (startDate && value < startDate) {
      setStartDate(value);
    }
  }

  function toggleCategory(categoryId: string) {
    setSelectedCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId]
    );
  }

  function clearFilters() {
    onActiveFilterCountChange(0);
    setTypeFilter("ALL");
    setActiveEditor(null);
    setAmountMode("RANGE");
    setExactAmount("");
    setMinimumAmount("");
    setMaximumAmount("");
    setDateMode("RANGE");
    setExactDate("");
    setStartDate("");
    setEndDate("");
    setSelectedCategoryIds([]);
  }

  const amountSummary = hasAmountFilter
    ? amountMode === "EXACT"
      ? formatAmountValue(exactAmount)
      : minimumAmount && maximumAmount
        ? `${formatAmountValue(minimumAmount)} - ${formatAmountValue(maximumAmount)}`
        : minimumAmount
          ? `From ${formatAmountValue(minimumAmount)}`
          : `Up to ${formatAmountValue(maximumAmount)}`
    : "Any";
  const dateSummary = hasDateFilter
    ? dateMode === "EXACT"
      ? formatDateValue(exactDate)
      : startDate && endDate
        ? `${formatRangeDate(startDate)} - ${formatRangeDate(endDate)}`
        : startDate
          ? `From ${formatRangeDate(startDate)}`
          : `Until ${formatRangeDate(endDate)}`
    : "Any";
  const categorySummary = hasCategoryFilter
    ? activeSelectedCategoryIds.length === 1
      ? transactionCategories.find(
          (category) => category.id === activeSelectedCategoryIds[0]
        )?.name ?? "1 selected"
      : `${activeSelectedCategoryIds.length} selected`
    : "All";

  return (
    <section
      id={id}
      className={`moves-filter-panel${activeEditor ? " is-editing" : ""}`}
      aria-label="Transaction filters"
    >
      <div className="moves-filter-panel__heading">
        <span>Filters</span>
        <div className="moves-filter-panel__actions">
          <button
            className="moves-filter-panel__clear"
            type="button"
            disabled={activeFilterCount === 0}
            onClick={clearFilters}
          >
            Clear all
          </button>
          <button
            className="moves-filter-panel__apply"
            type="button"
            disabled={activeFilterCount === 0}
          >
            Apply filters
          </button>
        </div>
      </div>

      <TransactionTypeSwitch
        value={typeFilter}
        includeAll
        compact
        label="Filter by transaction type"
        onChange={setTypeFilter}
      />

      <div className="moves-filter-shortcuts">
        <FilterShortcut
          label="Amount"
          summary={amountSummary}
          active={hasAmountFilter}
          expanded={activeEditor === "amount"}
          icon={<CircleEuroSign aria-hidden="true" />}
          onClick={() =>
            setActiveEditor((current) =>
              current === "amount" ? null : "amount"
            )
          }
        />
        <FilterShortcut
          label="Date"
          summary={dateSummary}
          active={hasDateFilter}
          expanded={activeEditor === "date"}
          icon={<CalendarDays aria-hidden="true" />}
          onClick={() =>
            setActiveEditor((current) => (current === "date" ? null : "date"))
          }
        />
        <FilterShortcut
          label="Categories"
          summary={categorySummary}
          active={hasCategoryFilter}
          expanded={activeEditor === "categories"}
          icon={<Shapes aria-hidden="true" />}
          onClick={() =>
            setActiveEditor((current) =>
              current === "categories" ? null : "categories"
            )
          }
        />
      </div>

      {activeEditor === "amount" ? (
        <div className="moves-filter-editor" aria-label="Amount filter">
          <FilterModeToggle
            value={amountMode}
            label="Amount filter mode"
            onChange={setAmountMode}
          />
          {amountMode === "EXACT" ? (
            <label className="moves-filter-field">
              <span>Exact amount</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={exactAmount}
                onChange={(event) =>
                  updateAmount(event.target.value, setExactAmount)
                }
              />
            </label>
          ) : (
            <div className="moves-filter-field-row">
              <label className="moves-filter-field">
                <span>Minimum</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={minimumAmount}
                  onChange={(event) =>
                    updateAmount(event.target.value, setMinimumAmount)
                  }
                />
              </label>
              <label className="moves-filter-field">
                <span>Maximum</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="No limit"
                  value={maximumAmount}
                  onChange={(event) =>
                    updateAmount(event.target.value, setMaximumAmount)
                  }
                />
              </label>
            </div>
          )}
        </div>
      ) : null}

      {activeEditor === "date" ? (
        <div className="moves-filter-editor" aria-label="Date filter">
          <FilterModeToggle
            value={dateMode}
            label="Date filter mode"
            onChange={setDateMode}
          />
          {dateMode === "EXACT" ? (
            <TransactionDateField
              id="moves-filter-exact-date"
              label="Exact date"
              value={exactDate}
              max={today}
              onChange={setExactDate}
            />
          ) : (
            <div className="moves-filter-field-row">
              <TransactionDateField
                id="moves-filter-start-date"
                label="From"
                value={startDate}
                max={today}
                onChange={updateStartDate}
              />
              <TransactionDateField
                id="moves-filter-end-date"
                label="Until"
                value={endDate}
                min={startDate || undefined}
                max={today}
                onChange={updateEndDate}
              />
            </div>
          )}
        </div>
      ) : null}

      {activeEditor === "categories" ? (
        <div
          className="moves-filter-editor moves-filter-editor--categories"
          aria-label="Category filter"
        >
          {visibleCategoryTypes.map((categoryType) => (
            <div
              className={`moves-filter-category-section moves-filter-category-section--${categoryType.toLowerCase()}`}
              key={categoryType}
            >
              <TransactionCategoryPicker
                type={categoryType}
                legend={
                  typeFilter === "ALL"
                    ? categoryType === "EXPENSE"
                      ? "Expenses"
                      : "Income"
                    : "Categories"
                }
                selectedCategoryIds={selectedCategoryIds}
                onCategorySelect={toggleCategory}
              />
            </div>
          ))}
        </div>
      ) : null}

    </section>
  );
}

type FilterShortcutProps = {
  label: string;
  summary: string;
  active: boolean;
  expanded: boolean;
  icon: ReactNode;
  onClick: () => void;
};

function FilterShortcut({
  label,
  summary,
  active,
  expanded,
  icon,
  onClick
}: FilterShortcutProps) {
  const ExpandIcon = expanded ? ChevronUp : ChevronDown;

  return (
    <button
      type="button"
      className={active || expanded ? "is-active" : undefined}
      aria-expanded={expanded}
      onClick={onClick}
    >
      <span className="moves-filter-shortcut__icon">{icon}</span>
      <span className="moves-filter-shortcut__copy">
        <strong>{label}</strong>
        <small>{summary}</small>
      </span>
      <ExpandIcon className="moves-filter-shortcut__chevron" aria-hidden="true" />
    </button>
  );
}

type FilterModeToggleProps = {
  value: ValueMode;
  label: string;
  onChange: (mode: ValueMode) => void;
};

function FilterModeToggle({ value, label, onChange }: FilterModeToggleProps) {
  return (
    <div className="moves-filter-mode-switch">
      <SlidingSegmentedControl
        value={value}
        options={FILTER_MODE_OPTIONS}
        onChange={onChange}
        label={label}
        compact
      />
    </div>
  );
}
