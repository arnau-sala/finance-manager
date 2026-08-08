import { AtSign, CheckCircle2, Mail } from "lucide-react";

import { GoogleIcon } from "../../components/brand/GoogleIcon";
import { ActionButton } from "../../components/ui/ActionButton";
import type { SessionUser } from "../auth/auth-api";

type EmailLinkSuccessPageProps = {
  user: SessionUser;
  onDone: () => void;
};

export function EmailLinkSuccessPage({
  user,
  onDone
}: EmailLinkSuccessPageProps) {
  const methods = [
    ...(user.username
      ? [{ id: "username", label: `Username: ${user.username}`, icon: <AtSign /> }]
      : []),
    { id: "email", label: `Email: ${user.email}`, icon: <Mail /> },
    ...(user.authProvider === "GOOGLE" ||
    user.authProvider === "PASSWORD_AND_GOOGLE"
      ? [{ id: "google", label: "Google", icon: <GoogleIcon /> }]
      : [])
  ];

  return (
    <main className="auth-screen auth-screen--login auth-screen--password-reset">
      <section
        className="auth-panel auth-password-reset-panel email-link-panel email-link-success"
        aria-labelledby="email-link-success-title"
      >
        <header className="auth-header auth-password-reset-header">
          <span className="auth-recovery-code-icon" aria-hidden="true">
            <CheckCircle2 strokeWidth={1.7} />
          </span>
          <div className="auth-message">
            <h1 id="email-link-success-title">Email linked</h1>
            <p className="auth-subtitle">
              You can now sign in with {user.email}
            </p>
          </div>
        </header>

        <section className="email-link-methods" aria-label="Current sign-in methods">
          <h2>Sign-in methods</h2>
          <div>
            {methods.map((method) => (
              <span key={method.id} className="email-link-method">
                <span aria-hidden="true">{method.icon}</span>
                {method.label}
              </span>
            ))}
          </div>
        </section>

        <ActionButton
          className="auth-primary-button email-link-primary-action"
          type="button"
          onClick={onDone}
        >
          Done
        </ActionButton>
      </section>
    </main>
  );
}
