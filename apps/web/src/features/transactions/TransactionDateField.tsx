type TransactionDateFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  name?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  selected?: boolean;
  invalid?: boolean;
  describedBy?: string;
};

export function TransactionDateField({
  id,
  label,
  value,
  onChange,
  onClear,
  name,
  min,
  max,
  disabled = false,
  selected = value.length > 0,
  invalid = false,
  describedBy
}: TransactionDateFieldProps) {
  const labelId = `${id}-label`;

  return (
    <div className="transaction-composer__field">
      {onClear ? (
        <div className="moves-filter-field__heading">
          <span id={labelId}>{label}</span>
          {value ? (
            <button
              className="moves-filter-field__clear"
              type="button"
              disabled={disabled}
              aria-label={`Clear ${label.toLowerCase()}`}
              onClick={onClear}
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : (
        <span id={labelId}>{label}</span>
      )}
      <div
        className={`transaction-composer__date-control${
          selected ? " is-selected" : ""
        }${invalid ? " is-invalid" : ""}`}
      >
        <input
          id={id}
          name={name}
          type="date"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          aria-labelledby={labelId}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}
