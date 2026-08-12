import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Check,
  ChevronLeft,
  Lightbulb,
  MessageSquare,
  TriangleAlert
} from "lucide-react";

import { ActionButton } from "../../components/ui/ActionButton";
import { formatErrorMessage } from "../../components/ui/error-message";
import {
  FeedbackConfirmationContent,
  SuccessCheckIcon
} from "../../components/ui/FeedbackConfirmation";
import { ApiRequestError, type SessionUser } from "../auth/auth-api";
import { validateEmail } from "../auth/email-validation";
import { submitFeedback } from "./feedback-api";

type FeatureSuggestionPageProps = {
  open: boolean;
  kind?: "general" | "suggestion";
  user: SessionUser;
  onBack: () => void;
  onSessionExpired: () => void;
};

const suggestionMaxLength = 600;
const suggestionCharacterCountRevealLength = 500;

type SubmittedSuggestion = {
  email: string | null;
  message: string;
  sender: string | null;
};

export function FeatureSuggestionPage({
  open,
  kind = "suggestion",
  user,
  onBack,
  onSessionExpired
}: FeatureSuggestionPageProps) {
  const screenRef = useRef<HTMLElement>(null);
  const [suggestion, setSuggestion] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [hasContactEmailBlurred, setHasContactEmailBlurred] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedSuggestion, setSubmittedSuggestion] =
    useState<SubmittedSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasLinkedEmail = Boolean(user.email);
  const senderLabel = user.username
    ? `@${user.username}`
    : user.email ?? user.name;
  const HeaderIcon = kind === "suggestion" ? Lightbulb : MessageSquare;
  const idPrefix =
    kind === "suggestion" ? "feature-suggestion" : "general-feedback";
  const copy =
    kind === "suggestion"
      ? {
          title: "Suggest a feature",
          defaultSubtitle: "Share an idea for future improvements",
          submittedSubtitle: "Your idea helps shape what comes next",
          messageLabel: "Suggestion",
          messagePlaceholder: "Tell me what would make the app better",
          sharedAnonymous: "This suggestion will be shared anonymously",
          sharedAs: "This suggestion will be shared as",
          submitIdle: "Send suggestion",
          submitBusy: "Sending",
          tooMany: "Too many suggestions",
          submitError: "Unable to send suggestion",
          submittedThanks: "Thank you for sharing this",
          submittedReview:
            "I will review it and consider it for a future update",
          sentLabel: "Suggestion sent",
          anonymousLabel: "Anonymous suggestion",
          summaryLabel: "Sent suggestion summary"
        }
      : {
          title: "Send feedback",
          defaultSubtitle: "Share how the app feels to use",
          submittedSubtitle: "Your feedback helps improve Finance Manager",
          messageLabel: "Feedback",
          messagePlaceholder: "Tell me what worked or what felt unclear",
          sharedAnonymous: "This feedback will be shared anonymously",
          sharedAs: "This feedback will be shared as",
          submitIdle: "Send feedback",
          submitBusy: "Sending",
          tooMany: "Too many feedback messages",
          submitError: "Unable to send feedback",
          submittedThanks: "Thank you for the feedback",
          submittedReview:
            "I will review it and use it to improve the app",
          sentLabel: "Feedback sent",
          anonymousLabel: "Anonymous feedback",
          summaryLabel: "Sent feedback summary"
        };
  const showsContactEmailField = !hasLinkedEmail && !anonymous;
  const parsedContactEmail =
    contactEmail.trim().length > 0 ? validateEmail(contactEmail) : null;
  const contactEmailError =
    showsContactEmailField &&
    hasContactEmailBlurred &&
    parsedContactEmail !== null &&
    !parsedContactEmail.success
      ? (parsedContactEmail.error.issues[0]?.message ??
        "Enter a valid email address")
      : null;
  const canSend =
    suggestion.trim().length > 0 && !isSubmitting;

  useEffect(() => {
    if (!open) {
      return;
    }

    setSuggestion("");
    setContactEmail("");
    setHasContactEmailBlurred(false);
    setAnonymous(false);
    setIsSubmitting(false);
    setSubmitted(false);
    setSubmittedSuggestion(null);
    setError(null);
    screenRef.current?.scrollTo({ top: 0, left: 0 });
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSend) {
      return;
    }

    if (
      showsContactEmailField &&
      contactEmail.trim().length > 0 &&
      parsedContactEmail?.success !== true
    ) {
      setHasContactEmailBlurred(true);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const trimmedSuggestion = suggestion.trim();
      const submittedEmail =
        showsContactEmailField && contactEmail.trim().length > 0
          ? contactEmail.trim()
          : user.email;

      await submitFeedback({
        type: kind,
        message: trimmedSuggestion,
        anonymous,
        email: submittedEmail ?? undefined
      });
      setSubmittedSuggestion({
        email: anonymous ? null : (submittedEmail ?? null),
        message: trimmedSuggestion,
        sender: anonymous ? null : senderLabel
      });
      setSubmitted(true);
      screenRef.current?.scrollTo({ top: 0, left: 0 });
    } catch (submitError) {
      if (submitError instanceof ApiRequestError && submitError.status === 401) {
        onSessionExpired();
        return;
      }

      setError(
        submitError instanceof ApiRequestError && submitError.status === 429
          ? `${copy.tooMany}\nTry again in ${
              submitError.retryAfter ?? "15 minutes"
            }`
          : submitError instanceof Error
            ? submitError.message
            : copy.submitError
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className={`account-flow-layer feature-suggestion-layer${
        open ? " is-open" : ""
      }`}
      aria-hidden={!open}
      inert={!open}
    >
      <section
        ref={screenRef}
        className="auth-screen auth-screen--login auth-screen--register feature-suggestion-screen"
      >
        <ActionButton
          shape="icon"
          className="auth-back-button"
          type="button"
          onClick={onBack}
          aria-label="Go back"
        >
          <ChevronLeft aria-hidden="true" strokeWidth={1.8} />
        </ActionButton>

          <section
            className="auth-panel feature-suggestion-panel"
          aria-labelledby={`${idPrefix}-title`}
        >
          <header className="auth-header auth-password-reset-header feature-suggestion-header">
            {submitted ? (
              <SuccessCheckIcon />
            ) : (
              <span className="auth-recovery-code-icon" aria-hidden="true">
                <HeaderIcon strokeWidth={1.7} />
              </span>
            )}
            <div className="auth-message">
              <h1 id={`${idPrefix}-title`}>{copy.title}</h1>
              <p className="auth-subtitle">
                {submitted
                  ? copy.submittedSubtitle
                  : copy.defaultSubtitle}
              </p>
            </div>
          </header>

          {submitted ? (
            <div className="auth-login-form auth-register-form feature-suggestion-form">
              <FeedbackConfirmationContent
                anonymousLabel={copy.anonymousLabel}
                email={submittedSuggestion?.email ?? null}
                message={submittedSuggestion?.message ?? suggestion.trim()}
                review={copy.submittedReview}
                sentLabel={copy.sentLabel}
                sender={submittedSuggestion?.sender ?? null}
                summaryLabel={copy.summaryLabel}
                thanks={copy.submittedThanks}
              />

              <ActionButton
                className="auth-primary-button feature-suggestion-submit"
                type="button"
                onClick={onBack}
              >
                Done
              </ActionButton>
            </div>
          ) : (
            <form
              className="auth-login-form auth-register-form feature-suggestion-form"
              noValidate
              onSubmit={handleSubmit}
            >
            <div className="auth-form-field">
              <div className="auth-register-field-heading">
                <span
                  className="text-field-label"
                  id={`${idPrefix}-message-label`}
                >
                  {copy.messageLabel}
                </span>
                {suggestion.length >= suggestionCharacterCountRevealLength ? (
                  <span
                    className="transaction-composer__character-count"
                    aria-live="polite"
                  >
                    {suggestion.length}/{suggestionMaxLength}
                  </span>
                ) : null}
              </div>
              <textarea
                id={`${idPrefix}-message`}
                className="text-field text-field--multiline feature-suggestion-textarea"
                aria-labelledby={`${idPrefix}-message-label`}
                placeholder={copy.messagePlaceholder}
                value={suggestion}
                maxLength={suggestionMaxLength}
                rows={6}
                onChange={(event) => setSuggestion(event.target.value)}
              />
            </div>

            {showsContactEmailField ? (
              <div className="auth-form-field">
                <div className="auth-register-field-heading">
                  <span
                    className="text-field-label"
                    id={`${idPrefix}-email-label`}
                  >
                    Email (optional)
                  </span>
                  {contactEmailError ? (
                    <p
                      id={`${idPrefix}-email-error`}
                      className="auth-register-field-error"
                      role="alert"
                      aria-live="polite"
                    >
                      <TriangleAlert aria-hidden="true" strokeWidth={1.8} />
                      <span>{formatErrorMessage(contactEmailError)}</span>
                    </p>
                  ) : null}
                </div>
                <input
                  id={`${idPrefix}-email`}
                  className="text-field"
                  aria-labelledby={`${idPrefix}-email-label`}
                  aria-invalid={Boolean(contactEmailError)}
                  aria-describedby={
                    contactEmailError
                      ? `${idPrefix}-email-error`
                      : undefined
                  }
                  type="email"
                  autoComplete="email"
                  placeholder="Where I can reply"
                  value={contactEmail}
                  onBlur={() => setHasContactEmailBlurred(true)}
                  onChange={(event) => {
                    setContactEmail(event.target.value);
                    setHasContactEmailBlurred(false);
                  }}
                />
              </div>
            ) : null}

            <div className="auth-form-field feature-suggestion-privacy">
              <span
                className="text-field-label"
                id={`${idPrefix}-privacy-label`}
              >
                Privacy
              </span>
              <label
                className="recovery-code-reset-option feature-suggestion-anonymous"
                htmlFor={`${idPrefix}-anonymous`}
                aria-labelledby={`${idPrefix}-privacy-label`}
              >
                <input
                  id={`${idPrefix}-anonymous`}
                  type="checkbox"
                  checked={anonymous}
                  onChange={(event) => {
                    setAnonymous(event.target.checked);
                    setHasContactEmailBlurred(false);
                  }}
                />
                <span
                  className="recovery-code-reset-option__checkbox"
                  aria-hidden="true"
                >
                  <Check />
                </span>
                <span className="recovery-code-reset-option__copy">
                  <strong>Send anonymously</strong>
                </span>
              </label>
              <p className="feature-suggestion-privacy__note">
                {anonymous
                  ? copy.sharedAnonymous
                  : `${copy.sharedAs} ${senderLabel}`}
              </p>
            </div>

            <ActionButton
              className="auth-primary-button feature-suggestion-submit"
              type="submit"
              disabled={!canSend}
            >
              {isSubmitting ? copy.submitBusy : copy.submitIdle}
            </ActionButton>
            {error ? (
              <p className="auth-field-message auth-field-message--error">
                {formatErrorMessage(error)}
              </p>
            ) : null}
          </form>
          )}
        </section>
      </section>
    </div>
  );
}
