import { type FormEvent, type ReactNode, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  KeyRound,
  LogOut,
  Mail,
  PencilLine,
  TriangleAlert,
  Trash2,
  UserRound
} from "lucide-react";

import { GoogleIcon } from "../../components/brand/GoogleIcon";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import {
  ApiRequestError,
  deleteAccount,
  startGoogleAccountDeletion,
  updateProfile,
  type SessionUser
} from "../auth/auth-api";
import { validateAccountPassword } from "../auth/password-validation";
import { validateUserName } from "../auth/user-name-validation";

type ProfilePageProps = {
  user: SessionUser;
  onProfileUpdated: (user: SessionUser) => void;
  onLogout: () => Promise<void>;
  onAccountDeleted: () => void;
  googleAccountDeletionFeedback: "mismatch" | "failed" | "cancelled" | null;
  onGoogleAccountDeletionFeedbackHandled: () => void;
};

type DeleteDialogMode = "confirm" | "mismatch" | "failed" | "rate-limited";

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

export function ProfilePage({
  user,
  onProfileUpdated,
  onLogout,
  onAccountDeleted,
  googleAccountDeletionFeedback,
  onGoogleAccountDeletionFeedbackHandled
}: ProfilePageProps) {
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [deleteDialogMode, setDeleteDialogMode] =
    useState<DeleteDialogMode | null>(
      googleAccountDeletionFeedback === "cancelled"
        ? "confirm"
        : googleAccountDeletionFeedback
    );
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteRetryAfter, setDeleteRetryAfter] = useState("15 minutes");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileUpdateError, setProfileUpdateError] = useState<string | null>(null);
  const parsedProfileName = validateUserName(profileName);
  const isProfileNameValid =
    parsedProfileName.success && parsedProfileName.data !== user.name;
  const profileNameValidationError =
    profileName.length > 0 && !parsedProfileName.success
      ? (parsedProfileName.error.issues[0]?.message ?? "Enter a valid name.")
      : null;

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

  function closeEditDialog() {
    if (isUpdatingProfile) return;
    setIsEditDialogOpen(false);
    setProfileName("");
    setProfileUpdateError(null);
  }

  async function confirmProfileUpdate(event?: FormEvent) {
    event?.preventDefault();
    if (isUpdatingProfile) return;

    const parsedName = validateUserName(profileName);
    if (!parsedName.success || parsedName.data === user.name) return;

    setProfileUpdateError(null);
    setIsUpdatingProfile(true);

    try {
      const updatedUser = await updateProfile(parsedName.data);
      onProfileUpdated(updatedUser);
      setIsUpdatingProfile(false);
      setIsEditDialogOpen(false);
      setProfileName("");
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 429) {
        setProfileUpdateError(
          `Too many profile updates. Try again in ${error.retryAfter ?? "15 minutes"}.`
        );
      } else {
        setProfileUpdateError(
          error instanceof Error ? error.message : "Unable to update profile."
        );
      }

      setIsUpdatingProfile(false);
    }
  }

  function closeDeleteDialog() {
    if (isDeletingAccount) return;
    setDeleteDialogMode(null);
    onGoogleAccountDeletionFeedbackHandled();
    setDeletePassword("");
    setDeleteError(null);
  }

  async function confirmAccountDeletion(event?: FormEvent) {
    event?.preventDefault();
    if (isDeletingAccount) return;

    if (deleteDialogMode === "rate-limited") {
      closeDeleteDialog();
      return;
    }

    if (user.authProvider === "GOOGLE") {
      setIsDeletingAccount(true);

      try {
        const authorizationUrl = await startGoogleAccountDeletion();
        window.location.assign(authorizationUrl);
      } catch (error) {
        handleAccountDeletionError(error);
      }

      return;
    }

    if (!deletePassword) return;

    const parsedPassword = validateAccountPassword(deletePassword);
    if (!parsedPassword.success) {
      setDeleteError("Incorrect password.");
      return;
    }

    setDeleteError(null);
    setIsDeletingAccount(true);

    try {
      await deleteAccount(parsedPassword.data);
      onAccountDeleted();
    } catch (error) {
      handleAccountDeletionError(error);
    }
  }

  function handleAccountDeletionError(error: unknown) {
    if (error instanceof ApiRequestError && error.status === 429) {
      setDeleteRetryAfter(error.retryAfter ?? "15 minutes");
      setDeleteError(null);
      setDeleteDialogMode("rate-limited");
    } else {
      setDeleteError(
        error instanceof Error ? error.message : "Unable to delete account."
      );
    }

    setIsDeletingAccount(false);
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
                onClick={() => {
                  setProfileName("");
                  setProfileUpdateError(null);
                  setIsEditDialogOpen(true);
                }}
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
              onClick={() => {
                setDeleteError(null);
                setDeletePassword("");
                setDeleteDialogMode("confirm");
              }}
            />
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={isEditDialogOpen}
        title="Edit profile"
        description="Only your profile name can be changed."
        confirmLabel="Continue"
        confirmingLabel="Saving..."
        icon={<PencilLine />}
        isConfirming={isUpdatingProfile}
        confirmDisabled={!isProfileNameValid}
        error={profileUpdateError ?? profileNameValidationError}
        onCancel={closeEditDialog}
        onConfirm={confirmProfileUpdate}
      >
        <form className="confirm-dialog__form" onSubmit={confirmProfileUpdate}>
          <label htmlFor="profile-name">Name</label>
          <input
            id="profile-name"
            data-dialog-autofocus
            type="text"
            autoComplete="name"
            placeholder={user.name}
            value={profileName}
            aria-invalid={Boolean(profileNameValidationError)}
            onChange={(event) => {
              setProfileName(event.target.value);
              setProfileUpdateError(null);
            }}
            disabled={isUpdatingProfile}
          />
        </form>
      </ConfirmDialog>

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

      <ConfirmDialog
        open={deleteDialogMode !== null}
        title={
          deleteDialogMode === "mismatch"
            ? "Incorrect Google account"
            : deleteDialogMode === "rate-limited"
              ? "Too many attempts"
            : deleteDialogMode === "failed"
              ? "Account not verified"
              : "Delete account?"
        }
        description={
          deleteDialogMode === "mismatch"
            ? `No data was deleted. Try again with the Google account used to sign in: ${user.email}.`
            : deleteDialogMode === "rate-limited"
              ? `You've made too many deletion attempts. Try again in ${deleteRetryAfter}.`
            : deleteDialogMode === "failed"
              ? `No data was deleted because we couldn't verify the account. Try again with: ${user.email}.`
              : user.authProvider === "GOOGLE"
                ? "This permanently deletes your account and all its data. This cannot be undone. Continue to choose the Google account you use to sign in."
                : "This permanently deletes your account and all its data. This cannot be undone."
        }
        confirmLabel={
          deleteDialogMode === "rate-limited"
            ? "Got it"
            : user.authProvider === "GOOGLE"
            ? deleteDialogMode === "confirm"
              ? "Continue"
              : "Try again"
            : "Delete account"
        }
        confirmingLabel={
          user.authProvider === "GOOGLE" ? "Opening..." : "Deleting..."
        }
        initialFocus={deleteDialogMode === "confirm" ? "cancel" : "dialog"}
        icon={
          deleteDialogMode === "confirm" ? (
            <Trash2 />
          ) : deleteDialogMode === "rate-limited" ? (
            <Clock3 />
          ) : (
            <TriangleAlert />
          )
        }
        tone={deleteDialogMode === "confirm" ? "danger" : "warning"}
        confirmTone={deleteDialogMode === "rate-limited" ? "default" : "danger"}
        showCancel={deleteDialogMode !== "rate-limited"}
        isConfirming={isDeletingAccount}
        confirmDisabled={
          deleteDialogMode === "confirm" &&
          user.authProvider === "PASSWORD" &&
          !deletePassword
        }
        error={deleteError}
        onCancel={closeDeleteDialog}
        onConfirm={confirmAccountDeletion}
      >
        {user.authProvider === "PASSWORD" &&
        deleteDialogMode !== "rate-limited" ? (
          <form className="confirm-dialog__form" onSubmit={confirmAccountDeletion}>
            <label htmlFor="delete-account-password">Confirm your password</label>
            <input
              id="delete-account-password"
              data-dialog-autofocus
              type="password"
              autoComplete="current-password"
              value={deletePassword}
              onChange={(event) => {
                setDeletePassword(event.target.value);
                setDeleteError(null);
              }}
              disabled={isDeletingAccount}
            />
          </form>
        ) : null}
      </ConfirmDialog>
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
