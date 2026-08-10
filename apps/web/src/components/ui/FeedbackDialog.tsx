import { ThumbsUp } from "lucide-react";
import { useId, useState } from "react";

import { ConfirmDialog } from "./ConfirmDialog";

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

  function closeDialog() {
    setName("");
    setEmail("");
    setFeedback("");
    onClose();
  }

  return (
    <ConfirmDialog
      open={open}
      className="feedback-dialog"
      role="dialog"
      title="Share your feedback"
      description="Your comments help make Finance Manager better."
      confirmLabel="Send feedback"
      cancelLabel="Cancel"
      icon={<ThumbsUp aria-hidden="true" strokeWidth={1.8} />}
      confirmDisabled={feedback.trim().length === 0}
      onCancel={closeDialog}
      onConfirm={() => {}}
    >
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
    </ConfirmDialog>
  );
}
