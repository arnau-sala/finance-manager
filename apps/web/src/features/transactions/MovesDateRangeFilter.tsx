import { useRef, useState, type RefObject } from "react";

import { CalendarDatePicker } from "../../components/ui/CalendarDatePicker";
import { formatFilterDateValue } from "./moves-filter-summary";

type RangeBoundary = "start" | "end";
type RangeSelectionStep = "start" | "end";

type MovesDateRangeFilterProps = {
  startDate: string;
  endDate: string;
  minimumDate: string;
  maximumDate: string;
  onChange: (startDate: string, endDate: string) => void;
};

type RangeDateFieldProps = {
  id: string;
  label: string;
  value: string;
  expanded: boolean;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onOpen: () => void;
  onClear: () => void;
};

function RangeDateField({
  id,
  label,
  value,
  expanded,
  buttonRef,
  onOpen,
  onClear
}: RangeDateFieldProps) {
  const labelId = `${id}-label`;

  return (
    <div className="transaction-composer__field moves-date-filter-field">
      <div className="moves-filter-field__heading">
        <span id={labelId}>{label}</span>
        {value ? (
          <button
            className="moves-filter-field__clear"
            type="button"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={onClear}
          >
            Clear
          </button>
        ) : null}
      </div>

      <button
        ref={buttonRef}
        id={id}
        className={`moves-date-filter-field__control${
          value ? " is-selected" : ""
        }`}
        type="button"
        aria-labelledby={labelId}
        aria-haspopup="dialog"
        aria-expanded={expanded}
        onClick={onOpen}
      >
        {value ? formatFilterDateValue(value) : "Select date"}
      </button>
    </div>
  );
}

export function MovesDateRangeFilter({
  startDate,
  endDate,
  minimumDate,
  maximumDate,
  onChange
}: MovesDateRangeFilterProps) {
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const endButtonRef = useRef<HTMLButtonElement>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [activeBoundary, setActiveBoundary] =
    useState<RangeBoundary>("start");
  const [selectionStep, setSelectionStep] =
    useState<RangeSelectionStep>("start");
  const anchorRef =
    activeBoundary === "start" ? startButtonRef : endButtonRef;
  const initialDate =
    activeBoundary === "start"
      ? startDate || endDate
      : endDate || startDate;

  function openPicker(boundary: RangeBoundary) {
    setActiveBoundary(boundary);
    setSelectionStep(boundary);
    setIsPickerOpen(true);
  }

  function selectDate(date: string) {
    if (activeBoundary === "end") {
      if (startDate && date < startDate) {
        onChange("", date);
      } else {
        onChange(startDate, date);
      }

      return true;
    }

    if (selectionStep === "end") {
      if (!startDate || date < startDate) {
        onChange(date, "");
        return false;
      }

      onChange(startDate, date);
      return true;
    }

    if (!startDate && endDate && date <= endDate) {
      onChange(date, endDate);
      return true;
    }

    onChange(date, "");
    setSelectionStep("end");
    return false;
  }

  return (
    <>
      <RangeDateField
        id="moves-filter-start-date"
        label="Start date"
        value={startDate}
        expanded={isPickerOpen && activeBoundary === "start"}
        buttonRef={startButtonRef}
        onOpen={() => openPicker("start")}
        onClear={() => onChange("", endDate)}
      />
      <RangeDateField
        id="moves-filter-end-date"
        label="End date"
        value={endDate}
        expanded={isPickerOpen && activeBoundary === "end"}
        buttonRef={endButtonRef}
        onOpen={() => openPicker("end")}
        onClear={() => onChange(startDate, "")}
      />

      <CalendarDatePicker
        open={isPickerOpen}
        anchorRef={anchorRef}
        value=""
        initialDate={initialDate}
        rangeStart={startDate}
        rangeEnd={endDate}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onSelect={selectDate}
        onClose={() => setIsPickerOpen(false)}
      />
    </>
  );
}
