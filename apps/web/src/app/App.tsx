import { useState } from "react";

import { AuthLandingPage } from "../features/auth/AuthLandingPage";
import { PasswordLoginPage } from "../features/auth/PasswordLoginPage";

export function App() {
  const [activeScreen, setActiveScreen] = useState<"landing" | "login">("landing");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginVersion, setLoginVersion] = useState(0);
  const [landingVersion, setLandingVersion] = useState(0);

  function openLogin(email: string) {
    setLoginEmail(email);
    setLoginVersion((version) => version + 1);
    setActiveScreen("login");
  }

  function returnToLanding() {
    setLandingVersion((version) => version + 1);
    setActiveScreen("landing");
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
        />
      </div>
    </div>
  );
}
