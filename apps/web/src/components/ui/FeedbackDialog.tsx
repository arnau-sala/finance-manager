import { ThumbsUp } from "lucide-react";
import { useId, useState } from "react";

import { ConfirmDialog } from "./ConfirmDialog";
import {
  FeedbackConfirmationContent,
  SuccessCheckIcon
} from "./FeedbackConfirmation";
import { ApiRequestError } from "../../features/auth/auth-api";
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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
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
    setError(null);
    setIsSubmitting(false);
    setSubmittedFeedback(null);
  }

  function closeDialog() {
    resetDialog();
    onClose();
  }

  async function sendFeedback() {
    const trimmedFeedback = feedback.trim();

    if (!trimmedFeedback || isSubmitting) {
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
      confirmDisabled={!submittedFeedback && feedback.trim().length === 0}
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
            <label className="text-field-label" htmlFor={emailId}>
              Email <span>(optional)</span>
            </label>
            <input
              id={emailId}
              className="text-field text-field--dialog"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
