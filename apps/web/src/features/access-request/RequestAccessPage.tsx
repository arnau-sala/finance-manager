import { useState } from "react";
import { ChevronLeft } from "lucide-react";

import { useBackSwipe } from "../auth/use-back-swipe";
import { submitAccessRequest } from "./access-request-api";
import {
  type AccessRequestField,
  type AccessRequestInput,
  validateAccessRequest
} from "./access-request-validation";

type RequestAccessPageProps = {
  onBack: () => void;
  onRequestSubmitted: (request: AccessRequestInput) => void;
};

type InvalidFields = Partial<Record<AccessRequestField, boolean>>;

export function RequestAccessPage({
  onBack,
  onRequestSubmitted
}: RequestAccessPageProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [invalidFields, setInvalidFields] = useState<InvalidFields>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const backSwipeHandlers = useBackSwipe(onBack);

  function clearFieldError(field: AccessRequestField) {
    if (invalidFields[field]) {
      setInvalidFields((current) => ({ ...current, [field]: false }));
    }

    if (formError) {
      setFormError(null);
    }
  }

  async function handleSubmitRequest() {
    if (isSubmitting) {
      return;
    }

    const parsedRequest = validateAccessRequest({ email, name, message });

    if (!parsedRequest.success) {
      const nextInvalidFields: InvalidFields = {};

      for (const issue of parsedRequest.error.issues) {
        const field = issue.path[0];

        if (field === "email" || field === "name" || field === "message") {
          nextInvalidFields[field] = true;
        }
      }

      setInvalidFields(nextInvalidFields);
      setFormError(
        parsedRequest.error.issues[0]?.message ?? "Check the information you entered."
      );
      return;
    }

    setInvalidFields({});
    setFormError(null);
    setIsSubmitting(true);

    try {
      await submitAccessRequest(parsedRequest.data);
      onRequestSubmitted(parsedRequest.data);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to submit your request. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      className="auth-screen auth-screen--login auth-screen--request"
      {...backSwipeHandlers}
    >
      <button className="auth-back-button" type="button" onClick={onBack} aria-label="Go back">
        <ChevronLeft aria-hidden="true" strokeWidth={1.8} />
      </button>

      <section className="auth-panel auth-request-panel" aria-labelledby="request-access-title">
        <header className="auth-header auth-request-header">
          <div className="auth-logo auth-logo--request" aria-hidden="true">
            <img
              src="/icons/app-icon.png"
              alt=""
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
            <span>FM</span>
          </div>

          <div className="auth-message">
            <h1 id="request-access-title">Request access</h1>
            <p className="auth-subtitle auth-request-subtitle">
              Send your details for admin review. We'll email you once a decision is made;
              if approved, you can finish creating your account.
            </p>
          </div>
        </header>

        <form
          className="auth-login-form auth-request-form"
          noValidate
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="auth-form-field">
            <span id="request-email-label">Email address</span>
            <input
              id="request-email"
              aria-labelledby="request-email-label"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={email}
              maxLength={254}
              aria-invalid={invalidFields.email === true}
              aria-describedby={formError ? "request-form-error" : undefined}
              onChange={(event) => {
                setEmail(event.target.value);
                clearFieldError("email");
              }}
            />
          </div>

          <div className="auth-form-field">
            <span id="request-name-label">Name</span>
            <input
              id="request-name"
              aria-labelledby="request-name-label"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              maxLength={100}
              aria-invalid={invalidFields.name === true}
              aria-describedby={formError ? "request-form-error" : undefined}
              onChange={(event) => {
                setName(event.target.value);
                clearFieldError("name");
              }}
            />
          </div>

          <div className="auth-form-field">
            <span id="request-message-label">
              Message <span className="auth-optional-label">(optional)</span>
            </span>
            <textarea
              id="request-message"
              aria-labelledby="request-message-label"
              name="message"
              placeholder="Add a note for the administrator"
              value={message}
              maxLength={1000}
              aria-invalid={invalidFields.message === true}
              aria-describedby={formError ? "request-form-error" : undefined}
              onChange={(event) => {
                setMessage(event.target.value);
                clearFieldError("message");
              }}
            />
          </div>

          <p
            id="request-form-error"
            className="auth-field-message auth-field-message--error auth-request-error"
            role="alert"
            aria-live="polite"
          >
            {formError ?? "\u00a0"}
          </p>

          <button
            className="auth-primary-button auth-request-submit"
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmitRequest}
          >
            {isSubmitting ? "Submitting..." : "Submit request"}
          </button>
        </form>
      </section>
    </main>
  );
}
