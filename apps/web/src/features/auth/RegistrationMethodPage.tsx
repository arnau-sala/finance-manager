import { ArrowRight, AtSign, ChevronLeft, Mail } from "lucide-react";

import type { RegistrationMethod } from "./registration-method";

type RegistrationMethodPageProps = {
  onBack: () => void;
  onSelect: (method: RegistrationMethod) => void;
};

const registrationMethods = [
  {
    value: "email",
    title: "Use email",
    description: "Verify your address with a 6-digit code.",
    icon: Mail,
  },
  {
    value: "username",
    title: "Use username",
    description: "No email needed. Save a recovery code for account access.",
    icon: AtSign,
  },
] as const;

export function RegistrationMethodPage({
  onBack,
  onSelect,
}: RegistrationMethodPageProps) {
  return (
    <main className="auth-screen auth-screen--static auth-screen--login auth-screen--registration-method">
      <button
        className="auth-back-button"
        type="button"
        onClick={onBack}
        aria-label="Go back"
      >
        <ChevronLeft aria-hidden="true" strokeWidth={1.8} />
      </button>

      <section
        className="auth-panel auth-registration-method-panel"
        aria-labelledby="registration-method-title"
      >
        <header className="auth-header auth-registration-method-header">
          <div
            className="auth-logo auth-logo--registration-method"
            aria-hidden="true"
          >
            <img
              src="/icons/app-icon-512.png"
              width={512}
              height={512}
              alt=""
              decoding="sync"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
            <span>FM</span>
          </div>

          <div className="auth-message">
            <h1 id="registration-method-title">Choose how to sign in</h1>
            <p className="auth-subtitle auth-registration-method-subtitle">
              Start with an email or create your account without one.
            </p>
          </div>
        </header>

        <div className="auth-registration-method-options">
          {registrationMethods.map((method) => {
            const Icon = method.icon;

            return (
              <button
                key={method.value}
                className="auth-registration-method-option"
                type="button"
                onClick={() => onSelect(method.value)}
              >
                <span
                  className="auth-registration-method-option__icon"
                  aria-hidden="true"
                >
                  <Icon strokeWidth={1.7} />
                </span>
                <span className="auth-registration-method-option__content">
                  <strong>{method.title}</strong>
                  <span>{method.description}</span>
                </span>
                <ArrowRight
                  className="auth-registration-method-option__arrow"
                  aria-hidden="true"
                  strokeWidth={1.8}
                />
              </button>
            );
          })}
        </div>

        <p className="auth-registration-method-note">
          Username accounts can add an email later. Both can link Google.
        </p>
      </section>
    </main>
  );
}
