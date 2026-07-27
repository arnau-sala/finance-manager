import { useCallback, useEffect, useRef, useState } from "react";
import { TimerOff } from "lucide-react";

import { lockAppHorizontalNavigation } from "./app-navigation-guard";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { AccessRequestConfirmationPage } from "../features/access-request/AccessRequestConfirmationPage";
import type { AccessRequestInput } from "../features/access-request/access-request-validation";
import { RequestAccessPage } from "../features/access-request/RequestAccessPage";
import { AuthLandingPage } from "../features/auth/AuthLandingPage";
import {
  getCurrentSession,
  getGoogleAccessRequestContext,
  logout,
  type SessionUser
} from "../features/auth/auth-api";
import { PasswordLoginPage } from "../features/auth/PasswordLoginPage";
import {
  HomePage,
  type GoogleAccountDeletionFeedback
} from "../features/home/HomePage";
import { clearStatisticsCache } from "../features/statistics/statistics-api";
import { clearTransactionsCache } from "../features/transactions/transaction-api";

type SessionStatus = "checking" | "anonymous" | "authenticated";
type AuthScreen = "landing" | "login" | "access-request" | "access-request-success";

export function App() {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("checking");
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [activeScreen, setActiveScreen] = useState<AuthScreen>("landing");
  const [loginEmail, setLoginEmail] = useState("");
  const [submittedAccessRequest, setSubmittedAccessRequest] =
    useState<AccessRequestInput | null>(null);
  const [googleAccessRequest, setGoogleAccessRequest] =
    useState<AccessRequestInput | null>(null);
  const [landingError, setLandingError] = useState<string | null>(null);
  const [loginVersion, setLoginVersion] = useState(0);
  const [landingVersion, setLandingVersion] = useState(0);
  const [accessRequestVersion, setAccessRequestVersion] = useState(0);
  const [googleAccountDeletionFeedback, setGoogleAccountDeletionFeedback] =
    useState<GoogleAccountDeletionFeedback | null>(null);
  const [isLogoutTransitionActive, setIsLogoutTransitionActive] =
    useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const initialGoogleAuthRef = useRef<string | null | undefined>(undefined);
  const initialAccountDeletionRef = useRef<string | null | undefined>(undefined);
  const logoutTransitionActiveRef = useRef(false);
  const logoutTransitionTimerRef = useRef<number | null>(null);
  const openSessionExpiredDialog = useCallback(() => {
    setIsSessionExpired(true);
  }, []);

  if (initialGoogleAuthRef.current === undefined) {
    initialGoogleAuthRef.current = new URL(window.location.href).searchParams.get(
      "googleAuth"
    );
  }

  if (initialAccountDeletionRef.current === undefined) {
    initialAccountDeletionRef.current = new URL(
      window.location.href
    ).searchParams.get("accountDeletion");
  }

  function returnToLanding() {
    setLoginEmail("");
    setSubmittedAccessRequest(null);
    setGoogleAccessRequest(null);
    setLandingError(null);
    setLandingVersion((version) => version + 1);
    setActiveScreen("landing");
  }

  useEffect(() => {
    let isMounted = true;
    const url = new URL(window.location.href);
    const googleAuth = initialGoogleAuthRef.current;
    const accountDeletion = initialAccountDeletionRef.current;

    if (
      url.searchParams.has("googleAuth") ||
      url.searchParams.has("accountDeletion")
    ) {
      url.searchParams.delete("googleAuth");
      url.searchParams.delete("accountDeletion");
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`
      );
    }

    if (googleAuth === "request-access") {
      setSessionStatus("anonymous");

      getGoogleAccessRequestContext()
        .then((request) => {
          if (isMounted) {
            setGoogleAccessRequest(request);
            setAccessRequestVersion((version) => version + 1);
            setActiveScreen("access-request");
          }
        })
        .catch(() => {
          if (isMounted) {
            setLandingError("We couldn't continue with Google. Please try again.");
          }
        });

      return () => {
        isMounted = false;
      };
    }

    getCurrentSession()
      .then((user) => {
        if (!isMounted) {
          return;
        }

        if (user) {
          setSessionUser(user);
          if (
            accountDeletion === "mismatch" ||
            accountDeletion === "failed" ||
            accountDeletion === "cancelled"
          ) {
            setGoogleAccountDeletionFeedback(accountDeletion);
          }
          setSessionStatus("authenticated");
          return;
        }

        setSessionStatus("anonymous");

        if (googleAuth === "failed") {
          setLandingError("We couldn't continue with Google. Please try again.");
        }

        if (googleAuth === "not-configured") {
          setLandingError("Google sign-in is not configured yet.");
        }

        if (googleAuth === "cancelled") {
          setLandingError("Google sign-in was cancelled.");
        }
      })
      .catch(() => {
        if (isMounted) {
          setSessionStatus("anonymous");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => lockAppHorizontalNavigation(), []);

  useEffect(
    () => () => {
      if (logoutTransitionTimerRef.current !== null) {
        window.clearTimeout(logoutTransitionTimerRef.current);
      }

      document.body.classList.remove("app-logout-transition");
    },
    []
  );

  function openLogin(email: string) {
    setLandingError(null);
    setLoginEmail(email);
    setLoginVersion((version) => version + 1);
    setActiveScreen("login");
  }

  function openAccessRequest() {
    setLandingError(null);
    setGoogleAccessRequest(null);
    setSubmittedAccessRequest(null);
    setAccessRequestVersion((version) => version + 1);
    setActiveScreen("access-request");
  }

  function showAccessRequestConfirmation(request: AccessRequestInput) {
    setGoogleAccessRequest(null);
    setSubmittedAccessRequest(request);
    setActiveScreen("access-request-success");
  }

  function continueWithGoogle() {
    setLandingError(null);
    window.location.assign("/api/auth/google/start");
  }

  async function handleLoginSuccess() {
    const user = await getCurrentSession();

    if (!user) {
      throw new Error("Unable to load your account.");
    }

    setSessionUser(user);
    setSessionStatus("authenticated");
  }

  async function handleLogout() {
    await logout();
    logoutTransitionActiveRef.current = true;
    document.body.classList.add("app-logout-transition");
    setIsLogoutTransitionActive(true);
    logoutTransitionTimerRef.current = window.setTimeout(
      completeLogoutTransition,
      650
    );
  }

  function completeLogoutTransition() {
    if (!logoutTransitionActiveRef.current) {
      return;
    }

    logoutTransitionActiveRef.current = false;

    if (logoutTransitionTimerRef.current !== null) {
      window.clearTimeout(logoutTransitionTimerRef.current);
      logoutTransitionTimerRef.current = null;
    }

    setIsLogoutTransitionActive(false);
    returnToAnonymousLanding();
    document.body.classList.remove("app-logout-transition");
  }

  function returnToAnonymousLanding() {
    clearStatisticsCache();
    clearTransactionsCache();
    setIsSessionExpired(false);
    setSessionUser(null);
    setLoginEmail("");
    setSubmittedAccessRequest(null);
    setGoogleAccessRequest(null);
    setLandingError(null);
    setGoogleAccountDeletionFeedback(null);
    setLoginVersion((version) => version + 1);
    setLandingVersion((version) => version + 1);
    setActiveScreen("landing");
    setSessionStatus("anonymous");
  }

  if (sessionStatus === "checking") {
    return <div className="app-loading-screen" aria-label="Loading" />;
  }

  if (sessionStatus === "authenticated" && sessionUser) {
    return (
      <div
        className={`session-flow${
          isLogoutTransitionActive ? " session-flow--logging-out" : ""
        }`}
      >
        {isLogoutTransitionActive ? (
          <div
            className="session-flow__destination"
            aria-hidden="true"
            inert
          >
            <AuthLandingPage
              onEmailContinue={openLogin}
              onRequestAccess={openAccessRequest}
              onGoogleContinue={continueWithGoogle}
            />
          </div>
        ) : null}

        <div
          className="session-flow__source"
          onAnimationEnd={(event) => {
            if (
              event.target === event.currentTarget &&
              event.animationName === "session-logout-slide-right"
            ) {
              completeLogoutTransition();
            }
          }}
        >
          <HomePage
            user={sessionUser}
            onProfileUpdated={setSessionUser}
            onLogout={handleLogout}
            onAccountDeleted={returnToAnonymousLanding}
            onSessionExpired={openSessionExpiredDialog}
            googleAccountDeletionFeedback={googleAccountDeletionFeedback}
            onGoogleAccountDeletionFeedbackHandled={() =>
              setGoogleAccountDeletionFeedback(null)
            }
          />
        </div>

        <ConfirmDialog
          open={isSessionExpired}
          title="Session expired"
          description="Your session has ended. Return to the main page to sign in again."
          confirmLabel="Return to main"
          icon={<TimerOff />}
          initialFocus="confirm"
          showCancel={false}
          dismissible={false}
          onCancel={() => undefined}
          onConfirm={returnToAnonymousLanding}
        />
      </div>
    );
  }

  return (
    <div className={`auth-flow auth-flow--${activeScreen}`}>
      <div
        className="auth-flow-page auth-flow-page--landing"
        aria-hidden={activeScreen !== "landing"}
        inert={activeScreen !== "landing"}
      >
        <AuthLandingPage
          key={landingVersion}
          onEmailContinue={openLogin}
          onRequestAccess={openAccessRequest}
          onGoogleContinue={continueWithGoogle}
          externalError={landingError}
          onClearExternalError={() => setLandingError(null)}
        />
      </div>

      <div
        className="auth-flow-page auth-flow-page--login"
        aria-hidden={activeScreen !== "login"}
        inert={activeScreen !== "login"}
      >
        <PasswordLoginPage
          key={`${loginVersion}:${loginEmail}`}
          email={loginEmail}
          onBack={returnToLanding}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>

      <div
        className="auth-flow-page auth-flow-page--access-request"
        aria-hidden={activeScreen !== "access-request"}
        inert={activeScreen !== "access-request"}
      >
        <RequestAccessPage
          key={`${accessRequestVersion}:${googleAccessRequest?.email ?? "standard"}`}
          onBack={returnToLanding}
          onRequestSubmitted={showAccessRequestConfirmation}
          initialRequest={googleAccessRequest ?? undefined}
          mode={googleAccessRequest ? "google" : "standard"}
        />
      </div>

      <div
        className="auth-flow-page auth-flow-page--access-request-success"
        aria-hidden={activeScreen !== "access-request-success"}
        inert={activeScreen !== "access-request-success"}
      >
        {submittedAccessRequest ? (
          <AccessRequestConfirmationPage
            request={submittedAccessRequest}
            onReturnToStart={returnToLanding}
          />
        ) : null}
      </div>
    </div>
  );
}
