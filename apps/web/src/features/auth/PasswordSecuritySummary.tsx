import { getPasswordStrength } from "./password-assistance";
import { getAccountPasswordRequirements } from "./password-validation";

type PasswordSecuritySummaryProps = {
  password: string;
  requirementsId?: string;
};

export function PasswordSecuritySummary({
  password,
  requirementsId
}: PasswordSecuritySummaryProps) {
  const passwordRequirements = getAccountPasswordRequirements(password);
  const passwordStrength = getPasswordStrength(password);

  return (
    <div className="auth-password-assistance">
      <div className="auth-password-strength">
        <div
          className="auth-password-strength__track"
          role="progressbar"
          aria-label="Password strength"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={passwordStrength.percentage}
          aria-valuetext={passwordStrength.label}
        >
          <span
            className={`is-${passwordStrength.level}`}
            style={{ width: `${passwordStrength.percentage}%` }}
          />
        </div>
        <span
          className={`auth-password-strength__label is-${passwordStrength.level}`}
        >
          {passwordStrength.label}
        </span>
      </div>

      <div
        id={requirementsId}
        className="auth-password-requirements"
        aria-label="Password requirements"
      >
        {passwordRequirements.map((requirement) => (
          <span
            key={requirement.id}
            className={requirement.met ? "is-met" : undefined}
          >
            {requirement.label}
          </span>
        ))}
      </div>
    </div>
  );
}
