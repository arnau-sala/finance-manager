import { useEffect, useRef, useState } from "react";

import { AccessRequestConfirmationPage } from "../features/access-request/AccessRequestConfirmationPage";
import type { AccessRequestInput } from "../features/access-request/access-request-validation";
import { RequestAccessPage } from "../features/access-request/RequestAccessPage";
import { AuthLandingPage } from "../features/auth/AuthLandingPage";
import {
  getCurrentSession,
  getGoogleAccessRequestContext,
  logout
} from "../features/auth/auth-api";
import { PasswordLoginPage } from "../features/auth/PasswordLoginPage";
import { HomePage } from "../features/home/HomePage";

type SessionStatus = "checking" | "anonymous" | "authenticated";
type AuthScreen = "landing" | "login" | "access-request" | "access-request-success";

export function App() {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("checking");
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
  const initialGoogleAuthRef = useRef<string | null | undefined>(undefined);

  if (initialGoogleAuthRef.current === undefined) {
    initialGoogleAuthRef.current = new URL(window.location.href).searchParams.get(
      "googleAuth"
    );
  }

  useEffect(() => {
    let isMounted = true;
    const url = new URL(window.location.href);
    const googleAuth = initialGoogleAuthRef.current;

    if (url.searchParams.has("googleAuth")) {
      url.searchParams.delete("googleAuth");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
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
      .then(async (hasActiveSession) => {
        if (!isMounted) {
          return;
        }

        if (hasActiveSession) {
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

  function returnToLanding() {
    setLoginEmail("");
    setSubmittedAccessRequest(null);
    setGoogleAccessRequest(null);
    setLandingError(null);
    setLandingVersion((version) => version + 1);
    setActiveScreen("landing");
  }

  function continueWithGoogle() {
    setLandingError(null);
    window.location.assign("/api/auth/google/start");
  }

  async function handleLogout() {
    await logout();
    setLoginEmail("");
    setGoogleAccessRequest(null);
    setLandingError(null);
    setLoginVersion((version) => version + 1);
    setLandingVersion((version) => version + 1);
    setActiveScreen("landing");
    setSessionStatus("anonymous");
  }

  if (sessionStatus === "checking") {
    return <div className="app-loading-screen" aria-label="Loading" />;
  }

  if (sessionStatus === "authenticated") {
    return <HomePage onLogout={handleLogout} />;
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
          onLoginSuccess={() => setSessionStatus("authenticated")}
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
