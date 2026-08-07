import { type ReactNode, useState } from "react";
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
import { getTodayDateOnly } from "../../dates/date-only";
import {
  transactionCategories,
  type TransactionType
} from "./category-catalog";
import {
  countActiveMovesFilters,
  createEmptyMovesFilters,
  getActiveCategoryIds,
  haveEqualMovesFilters,
  type MovesFilters,
  type MovesFilterValueMode,
  type MovesTypeFilter
} from "./moves-filters";
import {
  getAmountFilterSummary,
  getCategoryFilterSummary,
  getDateFilterSummary
} from "./moves-filter-summary";
import { MovesDateFilterField } from "./MovesDateFilterField";
import { MovesDateRangeFilter } from "./MovesDateRangeFilter";
import { TransactionCategoryPicker } from "./TransactionCategoryPicker";
import { TransactionTypeSwitch } from "./TransactionTypeSwitch";

export type MovesFilterEditor = "amount" | "date" | "categories";

type MovesFiltersPanelProps = {
  id: string;
  appliedFilters: MovesFilters;
  minimumDate: string;
  initialEditor?: MovesFilterEditor | null;
  onApply: (filters: MovesFilters) => void;
  onClear: () => void;
};

const amountPattern = /^(?:\d+(?:[.,]\d{0,2})?)?$/;
const FILTER_MODE_OPTIONS: readonly SlidingSegmentOption<MovesFilterValueMode>[] = [
  { value: "RANGE", label: "Range", icon: ArrowLeftRight },
  { value: "EXACT", label: "Exact", icon: Equal }
];
const EMPTY_MOVES_FILTERS = createEmptyMovesFilters();

export function MovesFiltersPanel({
  id,
  appliedFilters,
  minimumDate,
  initialEditor = null,
  onApply,
  onClear
}: MovesFiltersPanelProps) {
  const [typeFilter, setTypeFilter] = useState<MovesTypeFilter>(
    appliedFilters.type
  );
  const [activeEditor, setActiveEditor] =
    useState<MovesFilterEditor | null>(initialEditor);
  const [amountMode, setAmountMode] = useState<MovesFilterValueMode>(
    appliedFilters.amountMode
  );
  const [exactAmount, setExactAmount] = useState(appliedFilters.exactAmount);
  const [minimumAmount, setMinimumAmount] = useState(
    appliedFilters.minimumAmount
  );
  const [maximumAmount, setMaximumAmount] = useState(
    appliedFilters.maximumAmount
  );
  const [dateMode, setDateMode] = useState<MovesFilterValueMode>(
    appliedFilters.dateMode
  );
  const [exactDate, setExactDate] = useState(appliedFilters.exactDate);
  const [startDate, setStartDate] = useState(appliedFilters.startDate);
  const [endDate, setEndDate] = useState(appliedFilters.endDate);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    () => [...appliedFilters.selectedCategoryIds]
  );
  const draftFilters: MovesFilters = {
    type: typeFilter,
    amountMode,
    exactAmount,
    minimumAmount,
    maximumAmount,
    dateMode,
    exactDate,
    startDate,
    endDate,
    selectedCategoryIds
  };
  const today = getTodayDateOnly();
  const hasAmountFilter =
    amountMode === "EXACT"
      ? exactAmount.length > 0
      : minimumAmount.length > 0 || maximumAmount.length > 0;
  const hasDateFilter =
    dateMode === "EXACT"
      ? exactDate.length > 0
      : startDate.length > 0 || endDate.length > 0;
  const activeSelectedCategoryIds = getActiveCategoryIds(draftFilters);
  const hasCategoryFilter = activeSelectedCategoryIds.length > 0;
  const activeFilterCount = countActiveMovesFilters(draftFilters);
  const hasPendingChanges = !haveEqualMovesFilters(
    draftFilters,
    appliedFilters
  );
  const canClearFilters = !haveEqualMovesFilters(
    draftFilters,
    EMPTY_MOVES_FILTERS
  );
  const visibleCategoryTypes: readonly TransactionType[] =
    typeFilter === "ALL" ? ["EXPENSE", "INCOME"] : [typeFilter];

  function updateAmount(value: string, update: (nextValue: string) => void) {
    if (amountPattern.test(value)) {
      update(value);
    }
  }

  function updateDateRange(nextStartDate: string, nextEndDate: string) {
    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
  }

  function toggleCategory(categoryId: string) {
    setSelectedCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId]
    );
  }

  function clearCategoryType(categoryType: TransactionType) {
    const categoryIds = new Set(
      transactionCategories
        .filter((category) => category.type === categoryType)
        .map((category) => category.id)
    );

    setSelectedCategoryIds((current) =>
      current.filter((categoryId) => !categoryIds.has(categoryId))
    );
  }

  function clearFilters() {
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
    onClear();
  }

  function applyFilters() {
    onApply({
      ...draftFilters,
      selectedCategoryIds: [...selectedCategoryIds]
    });
    setActiveEditor(null);
  }

  const amountSummary = getAmountFilterSummary(draftFilters) ?? "Any";
  const dateSummary = getDateFilterSummary(draftFilters) ?? "Any";
  const categorySummary = getCategoryFilterSummary(draftFilters) ?? "All";

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
            disabled={!canClearFilters}
            onClick={clearFilters}
          >
            Clear all
          </button>
          <button
            className="moves-filter-panel__apply"
            type="button"
            disabled={!hasPendingChanges}
            onClick={applyFilters}
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
            <FilterAmountField
              id="moves-filter-exact-amount"
              label="Exact amount"
              placeholder="0,00"
              value={exactAmount}
              onChange={(value) => updateAmount(value, setExactAmount)}
            />
          ) : (
            <div className="moves-filter-field-row">
              <FilterAmountField
                id="moves-filter-minimum-amount"
                label="Minimum"
                placeholder="0,00"
                value={minimumAmount}
                onChange={(value) => updateAmount(value, setMinimumAmount)}
              />
              <FilterAmountField
                id="moves-filter-maximum-amount"
                label="Maximum"
                placeholder="No limit"
                value={maximumAmount}
                onChange={(value) => updateAmount(value, setMaximumAmount)}
              />
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
            <MovesDateFilterField
              id="moves-filter-exact-date"
              label="Exact date"
              value={exactDate}
              minimumDate={minimumDate}
              maximumDate={today}
              onChange={setExactDate}
              onClear={() => setExactDate("")}
            />
          ) : (
            <div className="moves-filter-field-row">
              <MovesDateRangeFilter
                startDate={startDate}
                endDate={endDate}
                minimumDate={minimumDate}
                maximumDate={today}
                onChange={updateDateRange}
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
          {visibleCategoryTypes.map((categoryType) => {
            const hasSelectedCategories = selectedCategoryIds.some(
              (categoryId) =>
                transactionCategories.find(
                  (category) => category.id === categoryId
                )?.type === categoryType
            );

            return (
              <div
                className={`moves-filter-category-section moves-filter-category-section--${categoryType.toLowerCase()}`}
                key={categoryType}
              >
                <TransactionCategoryPicker
                  type={categoryType}
                  legend={categoryType === "EXPENSE" ? "Expenses" : "Income"}
                  selectedCategoryIds={selectedCategoryIds}
                  onCategorySelect={toggleCategory}
                  headerAction={
                    <span className="moves-filter-category-clear-slot">
                      {hasSelectedCategories ? (
                        <button
                          className="moves-filter-field__clear"
                          type="button"
                          aria-label={`Clear ${categoryType.toLowerCase()} categories`}
                          onClick={() => clearCategoryType(categoryType)}
                        >
                          Clear
                        </button>
                      ) : null}
                    </span>
                  }
                />
              </div>
            );
          })}
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
      className={
        `${active ? "is-applied" : ""}${
          expanded ? " is-expanded" : ""
        }`.trim() || undefined
      }
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

type FilterAmountFieldProps = {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
};

function FilterAmountField({
  id,
  label,
  placeholder,
  value,
  onChange
}: FilterAmountFieldProps) {
  return (
    <div className="moves-filter-field">
      <div className="moves-filter-field__heading">
        <label className="text-field-label" htmlFor={id}>
          {label}
        </label>
        {value ? (
          <button
            className="moves-filter-field__clear"
            type="button"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => onChange("")}
          >
            Clear
          </button>
        ) : null}
      </div>
      <input
        id={id}
        className="text-field text-field--compact"
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

type FilterModeToggleProps = {
  value: MovesFilterValueMode;
  label: string;
  onChange: (mode: MovesFilterValueMode) => void;
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
