import { Check } from "lucide-react";

type SuccessCheckIconProps = {
  className?: string;
};

type FeedbackConfirmationContentProps = {
  anonymousLabel: string;
  message: string;
  review: string;
  sentLabel: string;
  sender: string | null;
  email: string | null;
  summaryLabel: string;
  thanks: string;
};

export function SuccessCheckIcon({ className }: SuccessCheckIconProps) {
  return (
    <span
      className={`auth-recovery-code-icon success-check-icon${
        className ? ` ${className}` : ""
      }`}
      aria-hidden="true"
    >
      <Check strokeWidth={1.7} />
    </span>
  );
}

export function FeedbackConfirmationContent({
  anonymousLabel,
  message,
  review,
  sentLabel,
  sender,
  email,
  summaryLabel,
  thanks
}: FeedbackConfirmationContentProps) {
  const hasSharedInformation = Boolean(sender || email);

  return (
    <div className="feature-suggestion-confirmation-stage">
      <p className="feature-suggestion-confirmation__message">
        <strong>{thanks}</strong>
        <span>{review}</span>
      </p>

      <div
        className="feature-suggestion-confirmation"
        aria-label={summaryLabel}
      >
        <section className="feature-suggestion-confirmation__section">
          <span>{sentLabel}</span>
          <p>{message}</p>
        </section>

        <section className="feature-suggestion-confirmation__section">
          <span>Shared information</span>
          {hasSharedInformation ? (
            <div className="feature-suggestion-confirmation__details">
              {sender ? <p>{sender}</p> : null}
              {email ? <p>{email}</p> : null}
            </div>
          ) : (
            <p>{anonymousLabel}</p>
          )}
        </section>
      </div>
    </div>
  );
}
