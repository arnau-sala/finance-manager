import { Check } from "lucide-react";

import type { AccessRequestInput } from "./access-request-validation";

type AccessRequestConfirmationPageProps = {
  request: AccessRequestInput;
  onReturnToStart: () => void;
};

export function AccessRequestConfirmationPage({
  request,
  onReturnToStart
}: AccessRequestConfirmationPageProps) {
  return (
    <main className="auth-screen auth-screen--request-success">
      <section
        className="auth-panel auth-request-success-panel"
        aria-labelledby="request-success-title"
      >
        <header className="auth-header auth-request-success-header">
          <div className="auth-request-success-icon" aria-hidden="true">
            <Check strokeWidth={2} />
          </div>
          <div className="auth-message">
            <h1 id="request-success-title">Request received</h1>
            <p className="auth-subtitle">
              Your details were received.
              <br />
              If eligible, we'll email you after review.
            </p>
          </div>
        </header>

        <dl className="auth-request-summary">
          <div>
            <dt>Email address</dt>
            <dd>{request.email}</dd>
          </div>
          <div>
            <dt>Name</dt>
            <dd>{request.name}</dd>
          </div>
          <div>
            <dt>Message</dt>
            <dd className={request.message ? undefined : "is-empty"}>
              {request.message || "No message added"}
            </dd>
          </div>
        </dl>

        <button className="auth-primary-button" type="button" onClick={onReturnToStart}>
          Back to start
        </button>
      </section>
    </main>
  );
}
