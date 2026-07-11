import { useRef, useState } from "react";
import { ChevronLeft, Eye, EyeOff } from "lucide-react";

type PasswordLoginPageProps = {
  email: string;
  onBack: () => void;
};

const SWIPE_START_AREA = 40;
const SWIPE_DISTANCE = 72;
const supportsImmediatePasswordMask =
  typeof CSS !== "undefined" && CSS.supports("-webkit-text-security", "disc");

export function PasswordLoginPage({ email: initialEmail, onBack }: PasswordLoginPageProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const passwordInput = useRef<HTMLInputElement>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  function togglePasswordVisibility() {
    setIsPasswordVisible((isVisible) => !isVisible);

    requestAnimationFrame(() => {
      const input = passwordInput.current;

      if (!input) {
        return;
      }

      input.focus({ preventScroll: true });
      input.setSelectionRange(password.length, password.length);
    });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch" && event.clientX <= SWIPE_START_AREA) {
      swipeStart.current = { x: event.clientX, y: event.clientY };
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLElement>) {
    const start = swipeStart.current;
    swipeStart.current = null;

    if (!start || event.pointerType !== "touch") {
      return;
    }

    const horizontalDistance = event.clientX - start.x;
    const verticalDistance = Math.abs(event.clientY - start.y);

    if (
      horizontalDistance >= SWIPE_DISTANCE &&
      horizontalDistance > verticalDistance * 1.2
    ) {
      onBack();
    }
  }

  return (
    <main
      className="auth-screen auth-screen--static auth-screen--login"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        swipeStart.current = null;
      }}
    >
      <button className="auth-back-button" type="button" onClick={onBack} aria-label="Go back">
        <ChevronLeft aria-hidden="true" strokeWidth={1.8} />
      </button>

      <section className="auth-panel auth-login-panel" aria-labelledby="login-title">
        <header className="auth-header auth-login-header">
          <div className="auth-logo auth-logo--login" aria-hidden="true">
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
            <h1 id="login-title">Welcome back</h1>
            <p className="auth-subtitle">Enter your details to access your account</p>
          </div>
        </header>

        <form
          className="auth-login-form"
          onSubmit={(event) => event.preventDefault()}
          noValidate
        >
          <div className="auth-form-field">
            <span id="login-email-label">Email address</span>
            <input
              id="login-email"
              aria-labelledby="login-email-label"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="auth-form-field auth-password-field">
            <span id="login-password-label">Password</span>
            <div className="auth-input-with-action">
              <input
                key={isPasswordVisible ? "visible" : "masked"}
                ref={passwordInput}
                id="login-password"
                aria-labelledby="login-password-label"
                name="password"
                type={
                  isPasswordVisible || supportsImmediatePasswordMask
                    ? "text"
                    : "password"
                }
                className={`auth-password-input auth-password-input--${
                  isPasswordVisible ? "visible" : "masked"
                }`}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                aria-pressed={isPasswordVisible}
              >
                {isPasswordVisible ? (
                  <EyeOff aria-hidden="true" strokeWidth={1.8} />
                ) : (
                  <Eye aria-hidden="true" strokeWidth={1.8} />
                )}
              </button>
            </div>
          </div>

          <button className="auth-primary-button" type="submit">
            Continue
          </button>
        </form>
      </section>
    </main>
  );
}
