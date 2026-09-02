import { useRef, useState } from "react";

import { CalendarDatePicker } from "../../components/ui/CalendarDatePicker";
import { formatFilterDateValue } from "./moves-filter-summary";

type TransactionDateFieldProps = {
  id: string;
  label: string;
  value: string;
  minimumDate: string;
  maximumDate: string;
  onChange: (value: string) => void;
  pickerPlacement?: "above" | "below" | "auto";
  name?: string;
  disabled?: boolean;
  selected?: boolean;
  invalid?: boolean;
  describedBy?: string;
};

export function TransactionDateField({
  id,
  label,
  value,
  minimumDate,
  maximumDate,
  onChange,
  pickerPlacement = "above",
  disabled = false,
  selected = value.length > 0,
  invalid = false,
  describedBy
}: TransactionDateFieldProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const labelId = `${id}-label`;

  return (
    <div className="transaction-composer__field">
      <span className="text-field-label" id={labelId}>
        {label}
      </span>
      <button
        ref={buttonRef}
        id={id}
        className={`text-field-shell text-field--composer transaction-composer__date-control${
          selected ? " is-selected" : ""
        }${isPickerOpen ? " is-picker-open" : ""
        }${invalid ? " is-invalid" : ""}`}
        type="button"
        disabled={disabled}
        aria-labelledby={labelId}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
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
        initialDate={value || maximumDate}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onSelect={(nextDate) => {
          onChange(nextDate);
        }}
        onClose={() => setIsPickerOpen(false)}
        placement={pickerPlacement}
      />
    </div>
  );
}
