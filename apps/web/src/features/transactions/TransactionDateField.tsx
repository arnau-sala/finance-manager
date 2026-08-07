type TransactionDateFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
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
  onChange,
  name,
  disabled = false,
  selected = value.length > 0,
  invalid = false,
  describedBy
}: TransactionDateFieldProps) {
  const labelId = `${id}-label`;

  return (
    <div className="transaction-composer__field">
      <span className="text-field-label" id={labelId}>
        {label}
      </span>
      <div
        className={`text-field-shell text-field--composer transaction-composer__date-control${
          selected ? " is-selected" : ""
        }${invalid ? " is-invalid" : ""}`}
      >
        <input
          id={id}
          className="text-field-shell__input"
          name={name}
          type="date"
          value={value}
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
