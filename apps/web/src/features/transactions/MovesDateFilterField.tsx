import { useRef, useState } from "react";

import { CalendarDatePicker } from "../../components/ui/CalendarDatePicker";
import { formatFilterDateValue } from "./moves-filter-summary";

type MovesDateFilterFieldProps = {
  id: string;
  label: string;
  value: string;
  minimumDate: string;
  maximumDate: string;
  onChange: (value: string) => void;
  onClear: () => void;
};

export function MovesDateFilterField({
  id,
  label,
  value,
  minimumDate,
  maximumDate,
  onChange,
  onClear
}: MovesDateFilterFieldProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
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
        aria-expanded={isPickerOpen}
        onClick={() => setIsPickerOpen(true)}
      >
        {value ? formatFilterDateValue(value) : "Select date"}
      </button>

      <CalendarDatePicker
        open={isPickerOpen}
        anchorRef={buttonRef}
        value={value}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onSelect={onChange}
        onClose={() => setIsPickerOpen(false)}
      />
    </div>
  );
}
