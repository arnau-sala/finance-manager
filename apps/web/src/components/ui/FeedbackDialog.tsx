import { ThumbsUp, TriangleAlert } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState } from "react";

import { ConfirmDialog } from "./ConfirmDialog";
import { formatErrorMessage } from "./error-message";
import {
  FeedbackConfirmationContent,
  SuccessCheckIcon
} from "./FeedbackConfirmation";
import { ApiRequestError } from "../../features/auth/auth-api";
import { validateEmail } from "../../features/auth/email-validation";
import { submitFeedback } from "../../features/home/feedback-api";

const feedbackMaxLength = 1000;
const feedbackCharacterCountRevealLength = 900;

type FeedbackDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function FeedbackDialog({ open, onClose }: FeedbackDialogProps) {
  const nameId = useId();
  const emailId = useId();
  const feedbackId = useId();
  const feedbackInputRef = useRef<HTMLTextAreaElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [hasEmailBlurred, setHasEmailBlurred] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedFeedback, setSubmittedFeedback] = useState<{
    email: string | null;
    message: string;
    sender: string | null;
  } | null>(null);

  function resetDialog() {
    setName("");
    setEmail("");
    setFeedback("");
    setHasEmailBlurred(false);
    setError(null);
    setIsSubmitting(false);
    setSubmittedFeedback(null);
  }

  function closeDialog() {
    resetDialog();
    onClose();
  }

  const parsedEmail = email.trim().length > 0 ? validateEmail(email) : null;
  const emailError =
    hasEmailBlurred && parsedEmail !== null && !parsedEmail.success
      ? (parsedEmail.error.issues[0]?.message ?? "Enter a valid email address")
      : null;
  const canSend =
    feedback.trim().length > 0 &&
    !isSubmitting &&
    (parsedEmail === null || parsedEmail.success);

  useLayoutEffect(() => {
    const input = feedbackInputRef.current;

    if (!open || submittedFeedback || !input) {
      return;
    }

    input.style.height = "auto";

    const styles = window.getComputedStyle(input);
    const minHeight = Number.parseFloat(styles.minHeight);
    const borderHeight =
      Number.parseFloat(styles.borderTopWidth) +
      Number.parseFloat(styles.borderBottomWidth);

    if (!Number.isFinite(minHeight) || !Number.isFinite(borderHeight)) {
      return;
    }

    const contentHeight = input.scrollHeight + borderHeight;
    const requiredHeight = Math.max(contentHeight, minHeight);
    input.style.height = `${requiredHeight}px`;

    const dialog = input.closest<HTMLElement>(".confirm-dialog");
    const dialogOverflow = dialog
      ? Math.max(0, dialog.scrollHeight - dialog.clientHeight)
      : 0;
    const finalHeight = Math.max(minHeight, requiredHeight - dialogOverflow);

    input.style.height = `${finalHeight}px`;
    input.style.overflowY =
      requiredHeight > finalHeight + 1 ? "auto" : "hidden";
  }, [feedback, open, submittedFeedback]);

  async function sendFeedback() {
    const trimmedFeedback = feedback.trim();

    if (!canSend) {
      if (parsedEmail !== null && !parsedEmail.success) {
        setHasEmailBlurred(true);
      }
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();

      await submitFeedback({
        anonymous: true,
        type: "landing",
        name: trimmedName || undefined,
        email: trimmedEmail || undefined,
        message: trimmedFeedback
      });
      setSubmittedFeedback({
        email: trimmedEmail || null,
        message: trimmedFeedback,
        sender: trimmedName || null
      });
      setIsSubmitting(false);
    } catch (sendError) {
      setError(
        sendError instanceof ApiRequestError
          ? sendError.message
          : "Unable to send feedback"
      );
      setIsSubmitting(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      className="feedback-dialog"
      role="dialog"
      title={submittedFeedback ? "Feedback sent" : "Share your feedback"}
      description={
        submittedFeedback
          ? "Your feedback helps improve Finance Manager"
          : "Your comments help make Finance Manager better"
      }
      confirmLabel={submittedFeedback ? "Done" : "Send feedback"}
      cancelLabel="Cancel"
      icon={
        submittedFeedback ? (
          <SuccessCheckIcon className="feedback-dialog__success-icon" />
        ) : (
          <ThumbsUp aria-hidden="true" strokeWidth={1.8} />
        )
      }
      iconClassName={
        submittedFeedback ? "feedback-dialog__success-icon-shell" : undefined
      }
      confirmDisabled={!submittedFeedback && !canSend}
      isConfirming={isSubmitting}
      confirmingLabel="Sending"
      error={submittedFeedback ? null : error}
      showCancel={!submittedFeedback}
      onCancel={closeDialog}
      onConfirm={submittedFeedback ? closeDialog : sendFeedback}
    >
      {submittedFeedback ? (
        <FeedbackConfirmationContent
          anonymousLabel="Anonymous feedback"
          email={submittedFeedback.email}
          message={submittedFeedback.message}
          review="I will review it and use it to improve the app"
          sentLabel="Feedback sent"
          sender={submittedFeedback.sender}
          summaryLabel="Sent feedback summary"
          thanks="Thank you for the feedback"
        />
      ) : (
        <form
          className="confirm-dialog__form feedback-dialog__form"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="confirm-dialog__field">
            <label className="text-field-label" htmlFor={nameId}>
              Name <span>(optional)</span>
            </label>
            <input
              id={nameId}
              className="text-field text-field--dialog"
              name="name"
              type="text"
              autoComplete="name"
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="confirm-dialog__field">
            <div className="feedback-dialog__field-heading">
              <label className="text-field-label" htmlFor={emailId}>
                Email <span>(optional)</span>
              </label>
              {emailError ? (
                <p
                  id={`${emailId}-error`}
                  className="auth-register-field-error"
                  role="alert"
                  aria-live="polite"
                >
                  <TriangleAlert aria-hidden="true" strokeWidth={1.8} />
                  <span>{formatErrorMessage(emailError)}</span>
                </p>
              ) : null}
            </div>
            <input
              id={emailId}
              className={`text-field text-field--dialog${
                emailError ? " text-field--invalid" : ""
              }`}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              maxLength={254}
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? `${emailId}-error` : undefined}
              value={email}
              onBlur={() => setHasEmailBlurred(true)}
              onChange={(event) => {
                setEmail(event.target.value);
                setHasEmailBlurred(false);
              }}
            />
          </div>

          <div className="confirm-dialog__field">
            <div className="feedback-dialog__field-heading">
              <label className="text-field-label" htmlFor={feedbackId}>
                Your feedback
              </label>
              {feedback.length >= feedbackCharacterCountRevealLength ? (
                <span
                  className="transaction-composer__character-count"
                  aria-live="polite"
                >
                  {feedback.length}/{feedbackMaxLength}
                </span>
              ) : null}
            </div>
            <textarea
              ref={feedbackInputRef}
              id={feedbackId}
              className="text-field text-field--dialog text-field--multiline feedback-dialog__textarea"
              name="feedback"
              rows={3}
              required
              maxLength={feedbackMaxLength}
              placeholder="Write your feedback here"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
            />
          </div>
        </form>
      )}
    </ConfirmDialog>
  );
}
