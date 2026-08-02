import {
  type FormEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import {
  CalendarDays,
  ChevronRight,
  CircleCheck,
  Clock3,
  KeyRound,
  Landmark,
  LogOut,
  Mail,
  PencilLine,
  TriangleAlert,
  Trash2,
  UserRound
} from "lucide-react";

import { GoogleIcon } from "../../components/brand/GoogleIcon";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { prefetchScheduler } from "../../cache/prefetch-scheduler";
import { formatEuroAmount } from "../../money/format-euro";
import {
  isEditableStartingNetWorth,
  parseStartingNetWorth,
  STARTING_NET_WORTH_ERROR
} from "../../money/starting-net-worth-validation";
import {
  ApiRequestError,
  changePassword,
  deleteAccount,
  startGoogleAccountDeletion,
  updateProfile,
  type UpdateProfileInput,
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
type PasswordDialogMode = "form" | "success";

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

function formatStartingNetWorth(value: string | null) {
  if (value === null) {
    return "Not set";
  }

  return formatEuroAmount(value, {
    fractionDigits: Number.isInteger(Number(value)) ? 0 : 2
  });
}

function formatStartingNetWorthInput(value: string | null) {
  if (value === null) {
    return "0";
  }

  const amount = Number(value);
  return Number.isFinite(amount) ? String(amount).replace(".", ",") : "0";
}

export function ProfilePage({
  user,
  onProfileUpdated,
  onLogout,
  onAccountDeleted,
  googleAccountDeletionFeedback,
  onGoogleAccountDeletionFeedbackHandled
}: ProfilePageProps) {
  const profileScrollRef = useRef<HTMLElement>(null);
  const profileContentRef = useRef<HTMLDivElement>(null);
  const [isProfileScrollable, setIsProfileScrollable] = useState(false);
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
  const [profileStartingNetWorth, setProfileStartingNetWorth] = useState("");
  const [hasProfileNameBlurred, setHasProfileNameBlurred] = useState(false);
  const [
    hasProfileStartingNetWorthBlurred,
    setHasProfileStartingNetWorthBlurred
  ] = useState(false);
  const [profileUpdateError, setProfileUpdateError] = useState<string | null>(null);
  const [passwordDialogMode, setPasswordDialogMode] =
    useState<PasswordDialogMode | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(
    null
  );
  const parsedProfileName = validateUserName(profileName);
  const isProfileNameInputValid = parsedProfileName.success;
  const isProfileNameChanged =
    parsedProfileName.success &&
    parsedProfileName.data !== user.name;
  const profileNameValidationError =
    hasProfileNameBlurred && !parsedProfileName.success
      ? (parsedProfileName.error.issues[0]?.message ?? "Enter a valid name.")
      : null;
  const parsedProfileStartingNetWorth = parseStartingNetWorth(
    profileStartingNetWorth
  );
  const isProfileStartingNetWorthInputValid =
    parsedProfileStartingNetWorth !== null;
  const isProfileStartingNetWorthChanged =
    parsedProfileStartingNetWorth !== null &&
    Number(parsedProfileStartingNetWorth) !== Number(user.startingNetWorth ?? 0);
  const profileStartingNetWorthValidationError =
    hasProfileStartingNetWorthBlurred &&
    parsedProfileStartingNetWorth === null
      ? STARTING_NET_WORTH_ERROR
      : null;
  const canUpdateProfile =
    isProfileNameInputValid &&
    isProfileStartingNetWorthInputValid &&
    (isProfileNameChanged || isProfileStartingNetWorthChanged);
  const arePasswordFieldsFilled =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    newPasswordConfirmation.length > 0;

  useLayoutEffect(() => {
    const scrollContainer = profileScrollRef.current;
    const content = profileContentRef.current;

    if (!scrollContainer || !content) {
      return;
    }

    const footerHitShield = document.querySelector<HTMLElement>(
      ".home-footer-nav__hit-shield"
    );
    let animationFrame = 0;
    const updateOverflow = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const containerBounds = scrollContainer.getBoundingClientRect();
        const footerBoundary =
          footerHitShield?.getBoundingClientRect().top ??
          containerBounds.bottom;
        const availableHeight = Math.max(
          0,
          Math.min(containerBounds.bottom, footerBoundary) -
            containerBounds.top
        );
        const bottomScrollClearance = Number.parseFloat(
          window.getComputedStyle(content).paddingBottom
        );
        const contentHeight =
          scrollContainer.scrollHeight -
          (Number.isFinite(bottomScrollClearance)
            ? bottomScrollClearance
            : 0);
        const nextIsScrollable =
          contentHeight > availableHeight + 1;

        setIsProfileScrollable((current) =>
          current === nextIsScrollable ? current : nextIsScrollable
        );

        if (!nextIsScrollable) {
          scrollContainer.scrollTop = 0;
        }
      });
    };

    updateOverflow();

    const resizeObserver = new ResizeObserver(updateOverflow);
    resizeObserver.observe(scrollContainer);
    resizeObserver.observe(content);
    if (footerHitShield) {
      resizeObserver.observe(footerHitShield);
    }
    window.addEventListener("resize", updateOverflow);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateOverflow);
    };
  }, []);

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
    prefetchScheduler.prioritizeUserRequest();

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
    setProfileStartingNetWorth("");
    setHasProfileNameBlurred(false);
    setHasProfileStartingNetWorthBlurred(false);
    setProfileUpdateError(null);
  }

  async function confirmProfileUpdate(event?: FormEvent) {
    event?.preventDefault();
    if (isUpdatingProfile) return;

    if (!canUpdateProfile) return;

    const input: UpdateProfileInput = {};

    if (isProfileNameChanged && parsedProfileName.success) {
      input.name = parsedProfileName.data;
    }

    if (
      isProfileStartingNetWorthChanged &&
      parsedProfileStartingNetWorth !== null
    ) {
      input.startingNetWorth = parsedProfileStartingNetWorth;
    }

    setProfileUpdateError(null);
    setIsUpdatingProfile(true);
    prefetchScheduler.prioritizeUserRequest();

    try {
      const updatedUser = await updateProfile(input);
      onProfileUpdated(updatedUser);
      setIsUpdatingProfile(false);
      setIsEditDialogOpen(false);
      setProfileName("");
      setProfileStartingNetWorth("");
      setHasProfileNameBlurred(false);
      setHasProfileStartingNetWorthBlurred(false);
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

  function openPasswordDialog() {
    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirmation("");
    setPasswordChangeError(null);
    setPasswordDialogMode("form");
  }

  function closePasswordDialog() {
    if (isChangingPassword) return;
    setPasswordDialogMode(null);
    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirmation("");
    setPasswordChangeError(null);
  }

  async function confirmPasswordChange(event?: FormEvent) {
    event?.preventDefault();

    if (passwordDialogMode === "success") {
      closePasswordDialog();
      return;
    }

    if (isChangingPassword || !arePasswordFieldsFilled) return;

    if (currentPassword.length > 128) {
      setPasswordChangeError("Incorrect current password.");
      return;
    }

    const parsedNewPassword = validateAccountPassword(newPassword);
    if (!parsedNewPassword.success) {
      setPasswordChangeError(
        parsedNewPassword.error.issues[0]?.message ?? "Enter a valid new password."
      );
      return;
    }

    if (parsedNewPassword.data !== newPasswordConfirmation) {
      setPasswordChangeError("New passwords do not match.");
      return;
    }

    setPasswordChangeError(null);
    setIsChangingPassword(true);
    prefetchScheduler.prioritizeUserRequest();

    try {
      await changePassword({
        currentPassword,
        newPassword: parsedNewPassword.data,
        newPasswordConfirmation
      });
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirmation("");
      setIsChangingPassword(false);
      setPasswordDialogMode("success");
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 429) {
        setPasswordChangeError(
          `Too many password changes. Try again in ${error.retryAfter ?? "15 minutes"}.`
        );
      } else {
        setPasswordChangeError(
          error instanceof Error ? error.message : "Unable to change password."
        );
      }

      setIsChangingPassword(false);
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
      prefetchScheduler.prioritizeUserRequest();

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
    prefetchScheduler.prioritizeUserRequest();

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
      <section
        ref={profileScrollRef}
        className={`home-content home-content--profile${
          isProfileScrollable ? " is-scrollable" : ""
        }`}
        aria-label="Profile"
      >
        <div ref={profileContentRef} className="profile-page">
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

              <div className="profile-detail">
                <span className="profile-detail__icon" aria-hidden="true">
                  <Landmark />
                </span>
                <div>
                  <dt>Starting net worth</dt>
                  <dd>{formatStartingNetWorth(user.startingNetWorth)}</dd>
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
                  setProfileName(user.name);
                  setProfileStartingNetWorth(
                    formatStartingNetWorthInput(user.startingNetWorth)
                  );
                  setHasProfileNameBlurred(false);
                  setHasProfileStartingNetWorthBlurred(false);
                  setProfileUpdateError(null);
                  setIsEditDialogOpen(true);
                }}
              />
              {user.authProvider === "PASSWORD" ? (
                <>
                  <ProfileActionButton
                    label="Change password"
                    icon={<KeyRound />}
                    onClick={openPasswordDialog}
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
        description="Update your name, starting net worth, or both."
        confirmLabel="Continue"
        confirmingLabel="Saving..."
        initialFocus="dialog"
        icon={<PencilLine />}
        isConfirming={isUpdatingProfile}
        confirmDisabled={!canUpdateProfile}
        error={
          profileUpdateError ??
          profileNameValidationError ??
          profileStartingNetWorthValidationError
        }
        onCancel={closeEditDialog}
        onConfirm={confirmProfileUpdate}
      >
        <form
          className="confirm-dialog__form confirm-dialog__form--profile"
          onSubmit={confirmProfileUpdate}
        >
          <div className="confirm-dialog__field">
            <label htmlFor="profile-name">Name</label>
            <input
              id="profile-name"
              type="text"
              autoComplete="name"
              value={profileName}
              aria-invalid={Boolean(profileNameValidationError)}
              onFocus={() => setHasProfileNameBlurred(false)}
              onBlur={() => setHasProfileNameBlurred(true)}
              onChange={(event) => {
                setProfileName(event.target.value);
                setProfileUpdateError(null);
              }}
              disabled={isUpdatingProfile}
            />
          </div>

          <div className="confirm-dialog__field">
            <label htmlFor="profile-starting-net-worth">
              Starting net worth
            </label>
            <input
              id="profile-starting-net-worth"
              type="text"
              inputMode="decimal"
              enterKeyHint="done"
              autoComplete="off"
              maxLength={12}
              value={profileStartingNetWorth}
              aria-invalid={Boolean(
                profileStartingNetWorthValidationError
              )}
              onFocus={() => setHasProfileStartingNetWorthBlurred(false)}
              onBlur={() => setHasProfileStartingNetWorthBlurred(true)}
              onChange={(event) => {
                const nextValue = event.target.value;

                if (isEditableStartingNetWorth(nextValue)) {
                  setProfileStartingNetWorth(nextValue);
                  setProfileUpdateError(null);
                }
              }}
              disabled={isUpdatingProfile}
            />
          </div>
        </form>
      </ConfirmDialog>

      <ConfirmDialog
        key={passwordDialogMode ?? "closed"}
        open={passwordDialogMode !== null}
        title={
          passwordDialogMode === "success"
            ? "Password changed"
            : "Change password"
        }
        description={
          passwordDialogMode === "success"
            ? "Your password has been updated successfully."
            : "Enter your current password and choose a new one."
        }
        confirmLabel={passwordDialogMode === "success" ? "Done" : "Continue"}
        confirmingLabel="Saving..."
        initialFocus="dialog"
        icon={passwordDialogMode === "success" ? <CircleCheck /> : <KeyRound />}
        isConfirming={isChangingPassword}
        confirmDisabled={
          passwordDialogMode === "form" && !arePasswordFieldsFilled
        }
        showCancel={passwordDialogMode === "form"}
        error={passwordDialogMode === "form" ? passwordChangeError : null}
        onCancel={closePasswordDialog}
        onConfirm={confirmPasswordChange}
      >
        {passwordDialogMode === "form" ? (
          <form
            className="confirm-dialog__form confirm-dialog__form--password"
            onSubmit={confirmPasswordChange}
          >
            <div className="confirm-dialog__field">
              <label htmlFor="current-password">Current password</label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => {
                  setCurrentPassword(event.target.value);
                  setPasswordChangeError(null);
                }}
                disabled={isChangingPassword}
              />
            </div>

            <div className="confirm-dialog__field">
              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setPasswordChangeError(null);
                }}
                disabled={isChangingPassword}
              />
            </div>

            <div className="confirm-dialog__field">
              <label htmlFor="new-password-confirmation">Repeat new password</label>
              <input
                id="new-password-confirmation"
                type="password"
                autoComplete="new-password"
                value={newPasswordConfirmation}
                onChange={(event) => {
                  setNewPasswordConfirmation(event.target.value);
                  setPasswordChangeError(null);
                }}
                disabled={isChangingPassword}
              />
            </div>
          </form>
        ) : null}
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
            ? `Nothing was deleted. Choose the Google account linked to ${user.email}.`
            : deleteDialogMode === "rate-limited"
              ? `Too many deletion attempts. Try again in ${deleteRetryAfter}.`
            : deleteDialogMode === "failed"
              ? `Nothing was deleted. We couldn't verify ${user.email}. Try again.`
              : user.authProvider === "GOOGLE"
                ? "Permanently delete your account and all its data. Continue to verify with Google.\nThis cannot be undone."
                : "Permanently delete your account and all its data.\nThis cannot be undone."
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
        initialFocus="dialog"
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
