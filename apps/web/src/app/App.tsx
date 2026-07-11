import { useEffect, useState } from "react";

import { AuthLandingPage } from "../features/auth/AuthLandingPage";
import { getCurrentSession, logout } from "../features/auth/auth-api";
import { PasswordLoginPage } from "../features/auth/PasswordLoginPage";
import { HomePage } from "../features/home/HomePage";

type SessionStatus = "checking" | "anonymous" | "authenticated";

export function App() {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("checking");
  const [activeScreen, setActiveScreen] = useState<"landing" | "login">("landing");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginVersion, setLoginVersion] = useState(0);
  const [landingVersion, setLandingVersion] = useState(0);

  useEffect(() => {
    let isMounted = true;

    getCurrentSession()
      .then((hasActiveSession) => {
        if (isMounted) {
          setSessionStatus(hasActiveSession ? "authenticated" : "anonymous");
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
    setLoginEmail(email);
    setLoginVersion((version) => version + 1);
    setActiveScreen("login");
  }

  function returnToLanding() {
    setLandingVersion((version) => version + 1);
    setActiveScreen("landing");
  }

  async function handleLogout() {
    await logout();
    setLoginEmail("");
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
    </div>
  );
}
