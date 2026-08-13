import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { ActionButton } from "../components/ui/ActionButton";
import { getCurrentSession, type SessionUser } from "../features/auth/auth-api";
import { FeatureSuggestionPage } from "../features/home/FeatureSuggestionPage";

export function FatalErrorFallback() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackUser, setFeedbackUser] = useState<SessionUser | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const user = await getCurrentSession();

        if (active) {
          setFeedbackUser(user);
        }
      } catch {
        if (active) {
          setFeedbackUser(null);
        }
      } finally {
        if (active) {
          setSessionChecked(true);
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <main className="app-error-fallback" role="alert">
        <img
          src="/icons/app-icon-512.png"
          width={72}
          height={72}
          draggable={false}
          alt=""
        />
        <div className="app-error-fallback__copy">
          <h1>Something went wrong</h1>
          <p>The error has been recorded so it can be fixed</p>
          <p className="app-error-fallback__contact">
            If the error persists, please use Report error to send the details
            so we can fix it as soon as possible
          </p>
        </div>
        <div className="app-error-fallback__actions">
          <ActionButton
            type="button"
            className="auth-primary-button"
            onClick={() => window.location.reload()}
          >
            <RefreshCw aria-hidden="true" />
            Reload app
          </ActionButton>
          <ActionButton
            type="button"
            className="app-error-fallback__report"
            disabled={!sessionChecked}
            onClick={() => setFeedbackOpen(true)}
          >
            {sessionChecked ? "Report error" : "Preparing feedback"}
          </ActionButton>
        </div>
      </main>
      <FeatureSuggestionPage
        open={feedbackOpen}
        kind="general"
        user={feedbackUser}
        onBack={() => setFeedbackOpen(false)}
        onDone={() => window.location.reload()}
        onSessionExpired={() => window.location.reload()}
      />
    </>
  );
}
