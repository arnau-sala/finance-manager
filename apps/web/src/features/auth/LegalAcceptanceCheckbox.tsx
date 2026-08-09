import { Check } from "lucide-react";

type LegalAcceptanceCheckboxProps = {
  checked: boolean;
  id: string;
  onChange: (checked: boolean) => void;
  onOpenLegal: () => void;
};

export function LegalAcceptanceCheckbox({
  checked,
  id,
  onChange,
  onOpenLegal
}: LegalAcceptanceCheckboxProps) {
  return (
    <label className="auth-legal-acceptance" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="auth-legal-acceptance__checkbox" aria-hidden="true">
        <Check />
      </span>
      <span className="auth-legal-acceptance__copy">
        <span>I have read and accept</span>
        <button
          type="button"
          className="auth-legal-acceptance__link"
          onClick={(event) => {
            event.preventDefault();
            onOpenLegal();
          }}
        >
          Privacy & Terms
        </button>
      </span>
    </label>
  );
}
