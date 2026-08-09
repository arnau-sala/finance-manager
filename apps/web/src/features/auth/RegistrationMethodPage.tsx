import { useState } from "react";
import { ArrowRight, AtSign, Check, ChevronLeft, Mail } from "lucide-react";

import { GoogleIcon } from "../../components/brand/GoogleIcon";
import { ActionButton } from "../../components/ui/ActionButton";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { LegalAcceptanceCheckbox } from "./LegalAcceptanceCheckbox";
import { LegalNoticeScreen } from "./LegalNoticeScreen";
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
      "Verify your email",
      "Recover by email",
    ],
    icon: Mail,
  },
  {
    value: "username",
    title: "Username account",
    benefits: [
      "Sign in with your username",
      "No email required",
      "Recover with your code",
    ],
    icon: AtSign,
  },
  {
    value: "google",
    title: "Google account",
    benefits: [
      "Sign in with Google",
      "No password or code",
      "Recover through Google",
    ],
    icon: null,
  },
] as const;

export function RegistrationMethodPage({
  onBack,
  onSelect,
}: RegistrationMethodPageProps) {
  const [isGoogleLegalDialogOpen, setIsGoogleLegalDialogOpen] =
    useState(false);
  const [hasAcceptedGoogleLegal, setHasAcceptedGoogleLegal] = useState(false);
  const [isLegalScreenOpen, setIsLegalScreenOpen] = useState(false);
  const [isLegalScreenClosing, setIsLegalScreenClosing] = useState(false);

  function openLegalScreen() {
    setIsLegalScreenClosing(false);
    setIsLegalScreenOpen(true);
  }

  function closeLegalScreen() {
    setIsLegalScreenClosing(true);
  }

  function closeGoogleLegalDialog() {
    setIsGoogleLegalDialogOpen(false);
    setHasAcceptedGoogleLegal(false);
  }

  return (
    <main className="auth-screen auth-screen--static auth-screen--login auth-screen--registration-method">
      <ActionButton
        shape="icon"
        className="auth-back-button"
        type="button"
        onClick={onBack}
        aria-label="Go back"
      >
        <ChevronLeft aria-hidden="true" strokeWidth={1.8} />
      </ActionButton>

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
            <h1 id="registration-method-title">Create your account</h1>
            <p className="auth-subtitle auth-registration-method-subtitle">
              Choose your first sign-in method
            </p>
          </div>
        </header>

        <div className="auth-registration-method-options">
          {registrationMethods.map((method) => {
            const Icon = method.icon;

            return (
              <ActionButton
                key={method.value}
                shape="card"
                className="auth-registration-method-option"
                type="button"
                onClick={() => {
                  if (method.value === "google") {
                    setIsGoogleLegalDialogOpen(true);
                    return;
                  }

                  onSelect(method.value);
                }}
              >
                <span
                  className="auth-registration-method-option__icon"
                  aria-hidden="true"
                >
                  {Icon ? (
                    <Icon strokeWidth={1.7} />
                  ) : (
                    <GoogleIcon className="auth-registration-method-option__google-icon" />
                  )}
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
              </ActionButton>
            );
          })}
        </div>

        <p className="auth-registration-method-note">
              Start with one method
              Link the others later
        </p>
      </section>

      <ConfirmDialog
        open={isGoogleLegalDialogOpen}
        title="Create with Google"
        description={
          "You will choose a Google account\nAccept Privacy & Terms before creating your account"
        }
        confirmLabel="Continue"
        icon={<GoogleIcon />}
        confirmDisabled={!hasAcceptedGoogleLegal}
        onCancel={closeGoogleLegalDialog}
        onConfirm={() => {
          setIsGoogleLegalDialogOpen(false);
          onSelect("google");
        }}
      >
        <LegalAcceptanceCheckbox
          id="google-register-legal-acceptance"
          checked={hasAcceptedGoogleLegal}
          onChange={setHasAcceptedGoogleLegal}
          onOpenLegal={openLegalScreen}
        />
      </ConfirmDialog>

      {isLegalScreenOpen ? (
        <LegalNoticeScreen
          closing={isLegalScreenClosing}
          onClose={closeLegalScreen}
          onClosed={() => {
            setIsLegalScreenOpen(false);
            setIsLegalScreenClosing(false);
          }}
        />
      ) : null}
    </main>
  );
}
