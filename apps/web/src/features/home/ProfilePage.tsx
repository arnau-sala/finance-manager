import { type ReactNode, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  KeyRound,
  LogOut,
  Mail,
  PencilLine,
  Trash2,
  UserRound
} from "lucide-react";

import { GoogleIcon } from "../../components/brand/GoogleIcon";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import type { SessionUser } from "../auth/auth-api";

type ProfilePageProps = {
  user: SessionUser;
  onLogout: () => Promise<void>;
};

function formatCreationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

export function ProfilePage({ user, onLogout }: ProfilePageProps) {
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  function closeLogoutDialog() {
    if (isLoggingOut) {
      return;
    }

    setLogoutError(null);
    setIsLogoutDialogOpen(false);
  }

  async function confirmLogout() {
    if (isLoggingOut) {
      return;
    }

    setLogoutError(null);
    setIsLoggingOut(true);

    try {
      await onLogout();
    } catch {
      setLogoutError("We couldn't log you out. Please try again.");
      setIsLoggingOut(false);
    }
  }

  return (
    <>
      <section className="home-content home-content--profile" aria-label="Profile">
        <div className="profile-page">
          <section className="profile-section" aria-labelledby="profile-details-title">
            <h2 id="profile-details-title">Account details</h2>

            <dl className="profile-detail-list">
              <div className="profile-detail">
                <span className="profile-detail__icon" aria-hidden="true">
                  <UserRound />
                </span>
                <div>
                  <dt>Name</dt>
                  <dd>{user.name}</dd>
                </div>
              </div>

              <div className="profile-detail">
                <span className="profile-detail__icon" aria-hidden="true">
                  <Mail />
                </span>
                <div>
                  <dt>Email</dt>
                  <dd>{user.email}</dd>
                </div>
              </div>

              <div className="profile-detail">
                <span className="profile-detail__icon" aria-hidden="true">
                  <CalendarDays />
                </span>
                <div>
                  <dt>Date created</dt>
                  <dd>{formatCreationDate(user.createdAt)}</dd>
                </div>
              </div>
            </dl>
          </section>

          <section className="profile-section" aria-labelledby="profile-actions-title">
            <h2 id="profile-actions-title">Account</h2>

            <div className="profile-action-list">
              <ProfileActionButton
                label="Edit profile"
                icon={<PencilLine />}
              />
              {user.authProvider === "PASSWORD" ? (
                <>
                  <ProfileActionButton
                    label="Change password"
                    icon={<KeyRound />}
                  />
                  <ProfileActionButton
                    label="Link Google account"
                    icon={<GoogleIcon />}
                  />
                </>
              ) : null}
            </div>
          </section>

          <div className="profile-session-actions" aria-label="Session and account actions">
            <ProfileActionButton
              label="Log out"
              icon={<LogOut />}
              onClick={() => {
                setLogoutError(null);
                setIsLogoutDialogOpen(true);
              }}
              centered
            />
            <ProfileActionButton
              label="Delete account"
              icon={<Trash2 />}
              tone="danger"
              centered
            />
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={isLogoutDialogOpen}
        title="Log out?"
        description="You'll need to sign in again."
        confirmLabel="Log out"
        icon={<LogOut />}
        isConfirming={isLoggingOut}
        error={logoutError}
        onCancel={closeLogoutDialog}
        onConfirm={confirmLogout}
      />
    </>
  );
}

type ProfileActionButtonProps = {
  label: string;
  icon: ReactNode;
  tone?: "default" | "danger";
  centered?: boolean;
  onClick?: () => void;
};

function ProfileActionButton({
  label,
  icon,
  tone = "default",
  centered = false,
  onClick
}: ProfileActionButtonProps) {
  return (
    <button
      className={`profile-action profile-action--${tone}${
        centered ? " profile-action--centered" : ""
      }`}
      type="button"
      onClick={onClick}
      disabled={!onClick}
    >
      <span className="profile-action__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="profile-action__label">{label}</span>
      {centered ? null : (
        <ChevronRight className="profile-action__chevron" aria-hidden="true" />
      )}
    </button>
  );
}
