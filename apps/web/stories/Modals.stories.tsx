import { useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  AtSign,
  Check,
  CircleCheck,
  Clock3,
  Key,
  KeyRound,
  LogOut,
  Mail,
  TimerOff,
  Trash2,
  TriangleAlert
} from "lucide-react";

import { ConfirmDialog } from "../src/components/ui/ConfirmDialog";
import {
  SlidingSegmentedControl,
  type SlidingSegmentOption
} from "../src/components/ui/SlidingSegmentedControl";
import { ActionButton } from "../src/components/ui/ActionButton";
import { GoogleIcon } from "../src/components/brand/GoogleIcon";
import { AuthPasswordField } from "../src/features/auth/AuthPasswordField";
import {
  EmailVerificationCodeInput,
  EmailVerificationResendButton
} from "../src/features/auth/EmailVerificationCodeInput";

const meta = {
  title: "Modals/Catalog",
  parameters: {
    layout: "fullscreen"
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type ModalId =
  | "session-expired"
  | "google-signin-notice"
  | "google-link"
  | "google-link-mismatch"
  | "google-unlink"
  | "google-unlink-mismatch"
  | "recovery-reset"
  | "password-recovery"
  | "email-unlink"
  | "email-unlink-code"
  | "username-unlink"
  | "logout"
  | "delete-password"
  | "delete-google"
  | "delete-hybrid"
  | "delete-rate-limited"
  | "success";

type ModalEntry = {
  id: ModalId;
  label: string;
  description: string;
};

const modalEntries: readonly ModalEntry[] = [
  {
    id: "session-expired",
    label: "Session expired",
    description: "Forced modal with one action"
  },
  {
    id: "google-signin-notice",
    label: "Google sign-in notice",
    description: "Informational Google modal"
  },
  {
    id: "google-link",
    label: "Link Google",
    description: "Confirm Google linking"
  },
  {
    id: "google-link-mismatch",
    label: "Incorrect Google account",
    description: "Warning after choosing the wrong account"
  },
  {
    id: "google-unlink",
    label: "Unlink Google",
    description: "Danger confirm before Google verification"
  },
  {
    id: "google-unlink-mismatch",
    label: "Google unlink failed",
    description: "Warning retry state"
  },
  {
    id: "recovery-reset",
    label: "Reset recovery code",
    description: "Checkbox option inside the modal"
  },
  {
    id: "password-recovery",
    label: "Recover account",
    description: "Email or username recovery starter"
  },
  {
    id: "email-unlink",
    label: "Unlink email",
    description: "Danger confirm before code"
  },
  {
    id: "email-unlink-code",
    label: "Unlink email code",
    description: "Verification code inside modal"
  },
  {
    id: "username-unlink",
    label: "Unlink username",
    description: "Password confirmation inside modal"
  },
  {
    id: "logout",
    label: "Log out",
    description: "Simple account action"
  },
  {
    id: "delete-password",
    label: "Delete account password",
    description: "Password-only account deletion"
  },
  {
    id: "delete-google",
    label: "Delete account Google",
    description: "Google-only account deletion"
  },
  {
    id: "delete-hybrid",
    label: "Delete account hybrid",
    description: "Password / Google switch"
  },
  {
    id: "delete-rate-limited",
    label: "Too many attempts",
    description: "Rate-limit error modal"
  },
  {
    id: "success",
    label: "Success",
    description: "Generic success state"
  }
];

const deleteVerificationOptions = [
  { value: "google", label: "Google" },
  { value: "password", label: "Password" }
] as const satisfies readonly SlidingSegmentOption<"google" | "password">[];

function ModalLauncher({
  entry,
  onOpen
}: {
  entry: ModalEntry;
  onOpen: (id: ModalId) => void;
}) {
  return (
    <ActionButton
      shape="card"
      className="profile-action"
      type="button"
      onClick={() => onOpen(entry.id)}
    >
      <span className="profile-action__icon" aria-hidden="true">
        <KeyRound />
      </span>
      <span className="profile-action__label">
        <strong>{entry.label}</strong>
        <small>{entry.description}</small>
      </span>
    </ActionButton>
  );
}

function StorybookGoogleIcon() {
  return <GoogleIcon />;
}

function PasswordDialogField({
  id,
  label,
  value,
  onChange
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <form className="confirm-dialog__form" onSubmit={(event) => event.preventDefault()}>
      <AuthPasswordField
        id={id}
        label={label}
        name={id}
        placeholder="Enter your password"
        value={value}
        invalid={false}
        autoComplete="current-password"
        variant="dialog"
        onChange={onChange}
      />
    </form>
  );
}

function ModalRenderer({
  activeModal,
  onClose
}: {
  activeModal: ModalId | null;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [deleteMethod, setDeleteMethod] = useState<"google" | "password">(
    "google"
  );
  const [signOutOtherDevices, setSignOutOtherDevices] = useState(false);

  function renderDialog(
    id: ModalId,
    props: {
      title: string;
      description: string;
      confirmLabel: string;
      icon: ReactNode;
      cancelLabel?: string;
      tone?: "default" | "danger" | "warning";
      confirmTone?: "default" | "danger";
      showCancel?: boolean;
      dismissible?: boolean;
      confirmDisabled?: boolean;
      children?: ReactNode;
    }
  ) {
    return (
      <ConfirmDialog
        open={activeModal === id}
        title={props.title}
        description={props.description}
        confirmLabel={props.confirmLabel}
        cancelLabel={props.cancelLabel}
        icon={props.icon}
        tone={props.tone}
        confirmTone={props.confirmTone}
        showCancel={props.showCancel}
        dismissible={props.dismissible}
        confirmDisabled={props.confirmDisabled}
        onCancel={onClose}
        onConfirm={onClose}
      >
        {props.children}
      </ConfirmDialog>
    );
  }

  return (
    <>
      {renderDialog("session-expired", {
        title: "Session expired",
        description:
      "Your session has ended\nReturn to the main page to sign in again",
        confirmLabel: "Return to main",
        icon: <TimerOff />,
        showCancel: false,
        dismissible: false
      })}

      {renderDialog("google-signin-notice", {
        title: "Google sign-in",
        description:
          "No account exists for arnau@example.com.\nCreate one with this Google account?",
        confirmLabel: "Create account",
        cancelLabel: "Cancel",
        icon: <StorybookGoogleIcon />
      })}

      {renderDialog("google-link", {
        title: "Link Google account?",
        description:
      "Add Google sign-in and keep password\nContinue and choose arnau@example.com",
        confirmLabel: "Continue",
        icon: <StorybookGoogleIcon />
      })}

      {renderDialog("google-link-mismatch", {
        title: "Incorrect Google account",
        description:
      "Nothing was linked\nChoose arnau@example.com, the email used by this account",
        confirmLabel: "Try again",
        icon: <TriangleAlert />,
        tone: "warning"
      })}

      {renderDialog("google-unlink", {
        title: "Unlink Google?",
        description:
      "Google sign-in will be removed\nYou can still sign in with your username or email and password\nYour account will remain linked to arnau@example.com\n\nContinue and choose arnau@example.com to verify this change",
        confirmLabel: "Continue",
        icon: <StorybookGoogleIcon />,
        confirmTone: "danger"
      })}

      {renderDialog("google-unlink-mismatch", {
        title: "Incorrect Google account",
        description:
      "Nothing was unlinked\nChoose arnau@example.com, the Google account linked to this profile",
        confirmLabel: "Try again",
        icon: <TriangleAlert />,
        tone: "warning",
        confirmTone: "danger"
      })}

      {renderDialog("recovery-reset", {
        title: "Reset recovery code?",
        description:
          "A new recovery code will replace your current one\nThe old code stops working only when the replacement is ready",
        confirmLabel: "Reset code",
        icon: <Key />,
        children: (
          <label className="recovery-code-reset-option">
            <input
              type="checkbox"
              checked={signOutOtherDevices}
              onChange={(event) => setSignOutOtherDevices(event.target.checked)}
            />
            <span className="recovery-code-reset-option__checkbox" aria-hidden="true">
              <Check />
            </span>
            <span className="recovery-code-reset-option__copy">
              <strong>Sign out other devices</strong>
              <span>This device stays signed in</span>
            </span>
          </label>
        )
      })}

      {renderDialog("password-recovery", {
        title: "Recover your account",
        description: "Enter your email or username",
        confirmLabel: "Continue",
        icon: <KeyRound />,
        children: (
          <form
            className="confirm-dialog__form password-recovery-start-form"
            noValidate
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="confirm-dialog__field">
              <label
                className="text-field-label"
                htmlFor="storybook-password-recovery-identifier"
              >
                Email or username
              </label>
              <input
                id="storybook-password-recovery-identifier"
                className="text-field text-field--dialog"
                name="username"
                type="text"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                defaultValue="arnau"
              />
            </div>

            <button className="password-recovery-forgot-username" type="button">
              Forgot your username?
            </button>
          </form>
        )
      })}

      {renderDialog("email-unlink", {
        title: "Unlink email?",
        description:
      "Sign-in with arnau@example.com and password will be removed\nYou can still sign in with your username and password or Google\narnau@example.com will remain linked to your Google sign-in\n\nA confirmation code will be sent to arnau@example.com",
        confirmLabel: "Continue",
        icon: <Mail />,
        tone: "danger",
        confirmTone: "danger"
      })}

      {renderDialog("email-unlink-code", {
        title: "Enter verification code",
    description: "Enter the 6-digit code sent to\narnau@example.com",
        confirmLabel: "Unlink email",
        icon: <Mail />,
        tone: "danger",
        confirmTone: "danger",
        confirmDisabled: emailCode.length !== 6,
        children: (
          <form
            className="confirm-dialog__form confirm-dialog__email-code-form"
            noValidate
            onSubmit={(event) => event.preventDefault()}
          >
            <EmailVerificationCodeInput
              id="storybook-unlink-email-code"
              value={emailCode}
              invalid={false}
              tone="danger"
              onChange={setEmailCode}
            />
            <p className="auth-verification-expiry">
              The code expires in 10 minutes
            </p>
            <EmailVerificationResendButton
              tone="danger"
              onResend={() => undefined}
              onResendError={() => undefined}
            />
          </form>
        )
      })}

      {renderDialog("username-unlink", {
        title: "Unlink username?",
        description:
      "Sign-in with your username and password will be removed\nYou can still sign in with arnau@example.com and password or Google\nYour recovery code will also stop working",
        confirmLabel: "Unlink username",
        icon: <AtSign />,
        tone: "danger",
        confirmTone: "danger",
        confirmDisabled: password.length === 0,
        children: (
          <PasswordDialogField
            id="storybook-unlink-username-password"
            label="Confirm your password"
            value={password}
            onChange={setPassword}
          />
        )
      })}

      {renderDialog("logout", {
        title: "Log out?",
    description: "You'll need to sign in again",
        confirmLabel: "Log out",
        icon: <LogOut />
      })}

      {renderDialog("delete-password", {
        title: "Delete account?",
        description:
      "Permanently delete your account\nThis cannot be undone",
        confirmLabel: "Delete account",
        icon: <Trash2 />,
        tone: "danger",
        confirmTone: "danger",
        confirmDisabled: password.length === 0,
        children: (
          <PasswordDialogField
            id="storybook-delete-account-password"
            label="Confirm your password"
            value={password}
            onChange={setPassword}
          />
        )
      })}

      {renderDialog("delete-google", {
        title: "Delete account?",
        description:
      "Permanently delete your account\nContinue to verify with Google\nThis cannot be undone",
        confirmLabel: "Continue",
        icon: <Trash2 />,
        tone: "danger",
        confirmTone: "danger"
      })}

      {renderDialog("delete-hybrid", {
        title: "Delete account?",
        description:
      "Permanently delete your account\nChoose how to verify your identity\nThis cannot be undone",
        confirmLabel:
          deleteMethod === "google" ? "Continue" : "Delete account",
        icon: <Trash2 />,
        tone: "danger",
        confirmTone: "danger",
        confirmDisabled: deleteMethod === "password" && password.length === 0,
        children: (
          <>
            <SlidingSegmentedControl
              className="confirm-dialog__verification-method"
              value={deleteMethod}
              options={deleteVerificationOptions}
              label="Account deletion verification method"
              tone="expense"
              compact
              allowDrag={false}
              onChange={(method) => {
                setDeleteMethod(method);
                setPassword("");
              }}
            />
            {deleteMethod === "password" ? (
              <PasswordDialogField
                id="storybook-delete-hybrid-password"
                label="Confirm your password"
                value={password}
                onChange={setPassword}
              />
            ) : null}
          </>
        )
      })}

      {renderDialog("delete-rate-limited", {
        title: "Too many attempts",
    description: "Too many deletion attempts\nTry again in 15 minutes",
        confirmLabel: "Got it",
        icon: <Clock3 />,
        tone: "warning",
        showCancel: false
      })}

      {renderDialog("success", {
        title: "Google account linked",
    description: "You can now sign in with your password or Google",
        confirmLabel: "Done",
        icon: <CircleCheck />,
        showCancel: false
      })}
    </>
  );
}

export const AllModals: Story = {
  render: () => {
    const [activeModal, setActiveModal] = useState<ModalId | null>(null);

    return (
      <main className="storybook-mobile-frame storybook-mobile-frame--muted">
        <div className="storybook-stack">
          <section className="storybook-section">
            <h2>All modals</h2>
            <p className="storybook-note">
              Open each modal from here
              They use the same dialog component and
              app styles, with mock content only
            </p>
            <div className="profile-action-list">
              {modalEntries.map((entry) => (
                <ModalLauncher
                  key={entry.id}
                  entry={entry}
                  onOpen={setActiveModal}
                />
              ))}
            </div>
          </section>

          <ModalRenderer
            activeModal={activeModal}
            onClose={() => setActiveModal(null)}
          />
        </div>
      </main>
    );
  }
};
