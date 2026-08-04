import { ArrowRight, AtSign, Check, ChevronLeft, Mail } from "lucide-react";

import type { RegistrationMethod } from "./registration-method";

type RegistrationMethodPageProps = {
  onBack: () => void;
  onSelect: (method: RegistrationMethod) => void;
};

const registrationMethods = [
  {
    value: "email",
    title: "Email account",
    benefits: [
      "Sign in with your email",
      "Recover access by email",
      "Add a username later",
    ],
    icon: Mail,
  },
  {
    value: "username",
    title: "Username account",
    benefits: [
      "Sign in without an email",
      "Recover with a recovery code",
      "Add an email later",
    ],
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
              Choose your first sign-in method 
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
                <div className="auth-registration-method-option__content">
                  <strong>{method.title}</strong>
                  <ul>
                    {method.benefits.map((benefit) => (
                      <li key={benefit}>
                        <Check aria-hidden="true" strokeWidth={2} />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
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
          Both account types can link Google
        </p>
      </section>
    </main>
  );
}
