import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import { TimerOff } from "lucide-react";

import { lockAppHorizontalNavigation } from "./app-navigation-guard";
import { observeAppDataLifecycle } from "../cache/app-data-lifecycle";
import { clearAuthenticatedData } from "../cache/financial-cache";
import { prefetchScheduler } from "../cache/prefetch-scheduler";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { AuthLandingPage } from "../features/auth/AuthLandingPage";
import { CreateAccountPage } from "../features/auth/CreateAccountPage";
import {
  getCurrentSession,
  logout,
  type SessionUser
} from "../features/auth/auth-api";
import { PasswordLoginPage } from "../features/auth/PasswordLoginPage";
import { RecoveryCodePage } from "../features/auth/RecoveryCodePage";
import { RegistrationMethodPage } from "../features/auth/RegistrationMethodPage";
import { RegistrationVerificationPage } from "../features/auth/RegistrationVerificationPage";
import type { UsernameRegistrationResult } from "../features/auth/registration-api";
import type { RegistrationMethod } from "../features/auth/registration-method";
import {
  HomePage,
  type GoogleAccountDeletionFeedback,
  type GoogleAccountLinkFeedback
} from "../features/home/HomePage";
import { StartingNetWorthPage } from "../features/onboarding/StartingNetWorthPage";

type SessionStatus = "checking" | "anonymous" | "authenticated";
type AuthScreen =
  | "landing"
  | "login"
  | "register-method"
  | "register-form"
  | "verification"
  | "recovery-code";
type StartupTransitionState =
  | "covered"
  | "exiting"
  | "revealing"
  | "complete";

export function App() {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("checking");
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [activeScreen, setActiveScreen] = useState<AuthScreen>("landing");
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [registrationMethod, setRegistrationMethod] =
    useState<RegistrationMethod>("email");
  const [registrationEmail, setRegistrationEmail] = useState<string | null>(
    null
  );
  const [usernameRegistration, setUsernameRegistration] =
    useState<UsernameRegistrationResult | null>(null);
  const [landingError, setLandingError] = useState<string | null>(null);
  const [loginVersion, setLoginVersion] = useState(0);
  const [landingVersion, setLandingVersion] = useState(0);
  const [registerVersion, setRegisterVersion] = useState(0);
  const [verificationVersion, setVerificationVersion] = useState(0);
  const [googleAccountDeletionFeedback, setGoogleAccountDeletionFeedback] =
    useState<GoogleAccountDeletionFeedback | null>(null);
  const [googleAccountLinkFeedback, setGoogleAccountLinkFeedback] =
    useState<GoogleAccountLinkFeedback | null>(null);
  const [isLogoutTransitionActive, setIsLogoutTransitionActive] =
    useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [dataSessionVersion, setDataSessionVersion] = useState(0);
  const [startupTransitionState, setStartupTransitionState] =
    useState<StartupTransitionState>("covered");
  const [isLandingBrandIconReady, setIsLandingBrandIconReady] = useState(false);
  const [isLandingTypographyReady, setIsLandingTypographyReady] =
    useState(false);
  const [isInitialHomeReady, setIsInitialHomeReady] = useState(false);
  const initialGoogleAuthRef = useRef<string | null | undefined>(undefined);
  const initialAccountDeletionRef = useRef<string | null | undefined>(undefined);
  const initialAccountLinkRef = useRef<string | null | undefined>(undefined);
  const logoutTransitionActiveRef = useRef(false);
  const logoutTransitionTimerRef = useRef<number | null>(null);
  const openSessionExpiredDialog = useCallback(() => {
    prefetchScheduler.clear();
    setIsSessionExpired(true);
  }, []);
  const markInitialHomeReady = useCallback(() => {
    setIsInitialHomeReady(true);
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

  if (initialAccountLinkRef.current === undefined) {
    initialAccountLinkRef.current = new URL(
      window.location.href
    ).searchParams.get("accountLink");
  }

  function returnToLanding() {
    setLoginIdentifier("");
    setRegistrationEmail(null);
    setLandingError(null);
    setLandingVersion((version) => version + 1);
    setActiveScreen("landing");
  }

  useEffect(() => {
    let isMounted = true;
    const url = new URL(window.location.href);
    const googleAuth = initialGoogleAuthRef.current;
    const accountDeletion = initialAccountDeletionRef.current;
    const accountLink = initialAccountLinkRef.current;

    if (
      url.searchParams.has("googleAuth") ||
      url.searchParams.has("accountDeletion") ||
      url.searchParams.has("accountLink")
    ) {
      url.searchParams.delete("googleAuth");
      url.searchParams.delete("accountDeletion");
      url.searchParams.delete("accountLink");
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`
      );
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
          if (
            accountLink === "success" ||
            accountLink === "mismatch" ||
            accountLink === "failed" ||
            accountLink === "cancelled"
          ) {
            setGoogleAccountLinkFeedback(accountLink);
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

        if (googleAuth === "password-required") {
          setLandingError(
            "Sign in with your password first, then link Google from Profile."
          );
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

  useEffect(() => {
    const logo = new Image();
    const markReady = () => setIsLandingBrandIconReady(true);

    logo.addEventListener("load", markReady, { once: true });
    logo.addEventListener("error", markReady, { once: true });
    logo.src = "/icons/app-icon-512.png";

    if (logo.complete) {
      markReady();
    }

    return () => {
      logo.removeEventListener("load", markReady);
      logo.removeEventListener("error", markReady);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      document.fonts.load('300 30px "Inter"', "Money, made clear."),
      document.fonts.load(
        '300 15px "Inter"',
        "A simpler way to track your finances"
      ),
      document.fonts.load('400 16px "Inter"', "Finance Manager")
    ]).finally(() => {
      if (isMounted) {
        setIsLandingTypographyReady(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(
    () =>
      observeAppDataLifecycle(() => {
        setDataSessionVersion((version) => version + 1);
      }),
    []
  );

  useEffect(
    () => () => {
      if (logoutTransitionTimerRef.current !== null) {
        window.clearTimeout(logoutTransitionTimerRef.current);
      }

      document.body.classList.remove("app-logout-transition");
    },
    []
  );

  const isStartupDestinationReady =
    (sessionStatus === "anonymous" &&
      isLandingBrandIconReady &&
      isLandingTypographyReady) ||
    (sessionStatus === "authenticated" &&
      sessionUser !== null &&
      (sessionUser.startingNetWorth === null ||
        googleAccountDeletionFeedback !== null ||
        googleAccountLinkFeedback !== null ||
        isInitialHomeReady));

  useEffect(() => {
    if (
      startupTransitionState !== "covered" ||
      !isStartupDestinationReady
    ) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      setStartupTransitionState("exiting");
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [isStartupDestinationReady, startupTransitionState]);

  useEffect(() => {
    if (startupTransitionState !== "exiting") {
      return;
    }

    const splash = document.getElementById("app-startup-splash");
    let hasCompleted = false;
    const completeSplashExit = () => {
      if (hasCompleted) {
        return;
      }

      hasCompleted = true;
      splash?.remove();
      setStartupTransitionState("revealing");
    };
    const handleAnimationEnd = (event: AnimationEvent) => {
      if (
        event.target === splash &&
        event.animationName === "app-splash-exit"
      ) {
        completeSplashExit();
      }
    };

    splash?.classList.add("app-splash--exiting");
    splash?.addEventListener("animationend", handleAnimationEnd);

    const fallbackTimer = window.setTimeout(() => {
      completeSplashExit();
    }, 350);

    return () => {
      window.clearTimeout(fallbackTimer);
      splash?.removeEventListener("animationend", handleAnimationEnd);
    };
  }, [startupTransitionState]);

  useEffect(() => {
    if (startupTransitionState !== "revealing") {
      return;
    }

    const fallbackTimer = window.setTimeout(() => {
      setStartupTransitionState("complete");
    }, 300);

    return () => {
      window.clearTimeout(fallbackTimer);
    };
  }, [startupTransitionState]);

  function openLogin(identifier: string) {
    setLandingError(null);
    setLoginIdentifier(identifier);
    setLoginVersion((version) => version + 1);
    setActiveScreen("login");
  }

  function openRegistration() {
    setLandingError(null);
    setRegistrationEmail(null);
    setUsernameRegistration(null);
    setActiveScreen("register-method");
  }

  function openRegistrationForm(method: RegistrationMethod) {
    setRegistrationMethod(method);
    setRegisterVersion((version) => version + 1);
    setActiveScreen("register-form");
  }

  function showRegistrationVerification(email: string) {
    setRegistrationEmail(email);
    setVerificationVersion((version) => version + 1);
    setActiveScreen("verification");
  }

  function showUsernameRecoveryCode(
    registration: UsernameRegistrationResult
  ) {
    setUsernameRegistration(registration);
    setActiveScreen("recovery-code");
  }

  async function completeUsernameRegistration() {
    await handleLoginSuccess();
    setUsernameRegistration(null);
  }

  function returnToRegistration() {
    setActiveScreen("register-form");
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

    clearAuthenticatedData();
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
    clearAuthenticatedData();
    setIsSessionExpired(false);
    setSessionUser(null);
    setLoginIdentifier("");
    setRegistrationEmail(null);
    setUsernameRegistration(null);
    setLandingError(null);
    setGoogleAccountDeletionFeedback(null);
    setGoogleAccountLinkFeedback(null);
    setLoginVersion((version) => version + 1);
    setLandingVersion((version) => version + 1);
    setActiveScreen("landing");
    setSessionStatus("anonymous");
  }

  function renderWithStartupTransition(content: ReactNode) {
    const isTransitionActive = startupTransitionState !== "complete";

    return (
      <div
        className={`app-startup-content${
          startupTransitionState === "revealing"
            ? " app-startup-content--revealing"
            : startupTransitionState === "complete"
              ? " app-startup-content--ready"
              : ""
        }`}
        aria-hidden={isTransitionActive}
        inert={isTransitionActive}
        onAnimationEnd={(event) => {
          if (
            event.target === event.currentTarget &&
            event.animationName === "app-startup-content-reveal"
          ) {
            setStartupTransitionState("complete");
          }
        }}
      >
        {content}
      </div>
    );
  }

  if (sessionStatus === "checking") {
    return null;
  }

  if (
    sessionStatus === "authenticated" &&
    sessionUser &&
    sessionUser.startingNetWorth === null
  ) {
    return renderWithStartupTransition(
      <div className="session-flow">
        <StartingNetWorthPage
          onComplete={setSessionUser}
          onSessionExpired={openSessionExpiredDialog}
        />

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

  if (sessionStatus === "authenticated" && sessionUser) {
    return renderWithStartupTransition(
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
              onIdentifierContinue={openLogin}
              onCreateAccount={openRegistration}
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
            key={`${sessionUser.id}:${dataSessionVersion}`}
            user={sessionUser}
            onProfileUpdated={setSessionUser}
            onLogout={handleLogout}
            onAccountDeleted={returnToAnonymousLanding}
            onSessionExpired={openSessionExpiredDialog}
            onInitialContentReady={markInitialHomeReady}
            googleAccountDeletionFeedback={googleAccountDeletionFeedback}
            onGoogleAccountDeletionFeedbackHandled={() =>
              setGoogleAccountDeletionFeedback(null)
            }
            googleAccountLinkFeedback={googleAccountLinkFeedback}
            onGoogleAccountLinkFeedbackHandled={() =>
              setGoogleAccountLinkFeedback(null)
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

  return renderWithStartupTransition(
    <div className={`auth-flow auth-flow--${activeScreen}`}>
      <div
        className="auth-flow-page auth-flow-page--landing"
        aria-hidden={activeScreen !== "landing"}
        inert={activeScreen !== "landing"}
      >
        <AuthLandingPage
          key={landingVersion}
          onIdentifierContinue={openLogin}
          onCreateAccount={openRegistration}
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
          key={`${loginVersion}:${loginIdentifier}`}
          identifier={loginIdentifier}
          onBack={returnToLanding}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>

      <div
        className="auth-flow-page auth-flow-page--register-method"
        aria-hidden={activeScreen !== "register-method"}
        inert={activeScreen !== "register-method"}
      >
        <RegistrationMethodPage
          onBack={returnToLanding}
          onSelect={openRegistrationForm}
        />
      </div>

      <div
        className="auth-flow-page auth-flow-page--register-form"
        aria-hidden={activeScreen !== "register-form"}
        inert={activeScreen !== "register-form"}
      >
        <CreateAccountPage
          key={`${registerVersion}:${registrationMethod}`}
          method={registrationMethod}
          onBack={() => setActiveScreen("register-method")}
          onRegistrationStarted={showRegistrationVerification}
          onUsernameRegistrationCreated={showUsernameRecoveryCode}
        />
      </div>

      <div
        className="auth-flow-page auth-flow-page--verification"
        aria-hidden={activeScreen !== "verification"}
        inert={activeScreen !== "verification"}
      >
        {registrationEmail ? (
          <RegistrationVerificationPage
            key={`${verificationVersion}:${registrationEmail}`}
            email={registrationEmail}
            onBack={returnToRegistration}
            onVerified={handleLoginSuccess}
          />
        ) : null}
      </div>

      <div
        className="auth-flow-page auth-flow-page--recovery-code"
        aria-hidden={activeScreen !== "recovery-code"}
        inert={activeScreen !== "recovery-code"}
      >
        {usernameRegistration ? (
          <RecoveryCodePage
            username={usernameRegistration.username}
            recoveryCode={usernameRegistration.recoveryCode}
            onContinue={completeUsernameRegistration}
          />
        ) : null}
      </div>
    </div>
  );
}
