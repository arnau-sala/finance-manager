import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import {
  AtSign,
  CalendarDays,
  Check,
  ChevronRight,
  CircleCheck,
  Clock3,
  Key,
  KeyRound,
  Landmark,
  LogOut,
  Mail,
  Pencil,
  TriangleAlert,
  Trash2,
  UserRound
} from "lucide-react";

import { GoogleIcon } from "../../components/brand/GoogleIcon";
import { ActionButton } from "../../components/ui/ActionButton";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { SlidingSegmentedControl } from "../../components/ui/SlidingSegmentedControl";
import { prefetchScheduler } from "../../cache/prefetch-scheduler";
import { formatEuroAmount } from "../../money/format-euro";
import {
  isEditableStartingNetWorth,
  parseStartingNetWorth,
  STARTING_NET_WORTH_ERROR
} from "../../money/starting-net-worth-validation";
import {
  ApiRequestError,
  deleteAccount,
  resetRecoveryCode,
  startGoogleAccountLink,
  startGoogleAccountDeletion,
  startGoogleAccountUnlink,
  unlinkUsername,
  updateProfile,
  type RecoveryCodeResetResult,
  type UpdateProfileInput,
  type SessionUser
} from "../auth/auth-api";
import { AuthPasswordField } from "../auth/AuthPasswordField";
import { validateAccountPassword } from "../auth/password-validation";
import { validateUserName } from "../auth/user-name-validation";

type ProfilePageProps = {
  user: SessionUser;
  onProfileUpdated: (user: SessionUser) => void;
  onChangePassword: () => void;
  onLinkEmail: () => void;
  onLinkUsername: () => void;
  onRecoveryCodeReset: (result: RecoveryCodeResetResult) => void;
  onLogout: () => Promise<void>;
  onAccountDeleted: () => void;
  onSessionExpired: () => void;
  googleAccountDeletionFeedback: "mismatch" | "failed" | "cancelled" | null;
  onGoogleAccountDeletionFeedbackHandled: () => void;
  googleAccountLinkFeedback:
    | "success"
    | "mismatch"
    | "failed"
    | "cancelled"
    | null;
  onGoogleAccountLinkFeedbackHandled: () => void;
  googleAccountUnlinkFeedback:
    | "success"
    | "mismatch"
    | "failed"
    | "cancelled"
    | null;
  onGoogleAccountUnlinkFeedbackHandled: () => void;
};

type DeleteDialogMode = "confirm" | "mismatch" | "failed" | "rate-limited";
type DeleteVerificationMethod = "google" | "password";
type GoogleLinkDialogMode = "confirm" | "success" | "mismatch" | "failed";
type GoogleUnlinkDialogMode = "confirm" | "mismatch" | "failed";

const deleteVerificationOptions = [
  { value: "google", label: "Google" },
  { value: "password", label: "Password" }
] as const;

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

function getGoogleUnlinkDescription(
  user: Pick<SessionUser, "email" | "emailLoginEnabled" | "username">
) {
  const googleEmail = user.email ?? "your linked Google account";

  if (user.username && user.emailLoginEnabled) {
    return `Google sign-in will be removed.\nYou can still sign in with your username or email and password.\nYour account will remain linked to ${googleEmail}.\n\nContinue and choose ${googleEmail} to verify this change.`;
  }

  if (user.username) {
    return `Google sign-in will be removed.\nYou will only be able to sign in with your username and password.\nYour account will no longer be linked to ${googleEmail}.\n\nContinue and choose ${googleEmail} to verify this change.`;
  }

  return `Google sign-in will be removed.\nYou will only be able to sign in with your email and password.\nYour account will remain linked to ${googleEmail}.\n\nContinue and choose ${googleEmail} to verify this change.`;
}

function getUsernameUnlinkDescription(
  user: Pick<
    SessionUser,
    "authProvider" | "email" | "emailLoginEnabled"
  >
) {
  const email = user.email ?? "your Google account";
  const hasGoogle = user.authProvider !== "PASSWORD";

  if (user.emailLoginEnabled && hasGoogle) {
    return `Sign-in with your username and password will be removed.\nYou can still sign in with ${email} and password or Google.\nYour recovery code will also stop working.`;
  }

  if (user.emailLoginEnabled) {
    return `Sign-in with your username and password will be removed.\nYou will only be able to sign in with ${email} and password.\nYour recovery code will also stop working.`;
  }

  return `Sign-in with your username and password will be removed.\nYou will only be able to sign in with Google as ${email}.\nYour recovery code will also stop working.`;
}

export function ProfilePage({
  user,
  onProfileUpdated,
  onChangePassword,
  onLinkEmail,
  onLinkUsername,
  onRecoveryCodeReset,
  onLogout,
  onAccountDeleted,
  onSessionExpired,
  googleAccountDeletionFeedback,
  onGoogleAccountDeletionFeedbackHandled,
  googleAccountLinkFeedback,
  onGoogleAccountLinkFeedbackHandled,
  googleAccountUnlinkFeedback,
  onGoogleAccountUnlinkFeedbackHandled
}: ProfilePageProps) {
  const profileScrollRef = useRef<HTMLElement>(null);
  const profileContentRef = useRef<HTMLDivElement>(null);
  const profileEmailRef = useRef<HTMLElement>(null);
  const googleInfoRef = useRef<HTMLDivElement>(null);
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
  const [deleteVerificationMethod, setDeleteVerificationMethod] =
    useState<DeleteVerificationMethod>(
      user.authProvider === "PASSWORD" ? "password" : "google"
    );
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
  const [googleLinkDialogMode, setGoogleLinkDialogMode] =
    useState<GoogleLinkDialogMode | null>(
      googleAccountLinkFeedback === "cancelled"
        ? "confirm"
        : googleAccountLinkFeedback
    );
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [googleLinkError, setGoogleLinkError] = useState<string | null>(null);
  const [googleUnlinkDialogMode, setGoogleUnlinkDialogMode] =
    useState<GoogleUnlinkDialogMode | null>(
      googleAccountUnlinkFeedback === "cancelled"
        ? "confirm"
        : googleAccountUnlinkFeedback === "mismatch" ||
            googleAccountUnlinkFeedback === "failed"
          ? googleAccountUnlinkFeedback
          : null
    );
  const [isUnlinkingGoogle, setIsUnlinkingGoogle] = useState(false);
  const [googleUnlinkError, setGoogleUnlinkError] = useState<string | null>(null);
  const [isUsernameUnlinkDialogOpen, setIsUsernameUnlinkDialogOpen] =
    useState(false);
  const [isUnlinkingUsername, setIsUnlinkingUsername] = useState(false);
  const [usernameUnlinkPassword, setUsernameUnlinkPassword] = useState("");
  const [usernameUnlinkError, setUsernameUnlinkError] = useState<string | null>(
    null
  );
  const [isGoogleInfoOpen, setIsGoogleInfoOpen] = useState(false);
  const [isRecoveryCodeDialogOpen, setIsRecoveryCodeDialogOpen] =
    useState(false);
  const [signOutOtherDevices, setSignOutOtherDevices] = useState(false);
  const [isResettingRecoveryCode, setIsResettingRecoveryCode] =
    useState(false);
  const [recoveryCodeResetError, setRecoveryCodeResetError] = useState<
    string | null
  >(null);
  const hasGoogleAccess = user.authProvider !== "PASSWORD";
  const hasEmailAccess = user.emailLoginEnabled;
  const hasUsernameAccess = user.username !== null;
  const linkedMethodCount = [
    hasGoogleAccess,
    hasEmailAccess,
    hasUsernameAccess
  ].filter(Boolean).length;
  const canUnlinkMethods = linkedMethodCount > 1;
  const hasSecurityActions =
    user.authProvider !== "GOOGLE" || hasUsernameAccess;
  const showsGoogleAccountDetail =
    hasGoogleAccess && !user.emailLoginEnabled;
  const showsGoogleProviderBadge =
    hasGoogleAccess && user.emailLoginEnabled;

  useEffect(() => {
    if (googleAccountUnlinkFeedback === "success") {
      onGoogleAccountUnlinkFeedbackHandled();
    }
  }, [googleAccountUnlinkFeedback, onGoogleAccountUnlinkFeedbackHandled]);
  const deletesWithGoogle =
    user.authProvider === "GOOGLE" ||
    (user.authProvider === "PASSWORD_AND_GOOGLE" &&
      deleteVerificationMethod === "google");
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

  useEffect(() => {
    if (!isGoogleInfoOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!googleInfoRef.current?.contains(event.target as Node)) {
        setIsGoogleInfoOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsGoogleInfoOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isGoogleInfoOpen]);

  useLayoutEffect(() => {
    const email = profileEmailRef.current;

    if (!email) {
      return;
    }

    const minimumFontSize = 12;
    let animationFrame = 0;
    const fitEmail = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        email.classList.remove("is-wrapped");
        email.style.removeProperty("font-size");

        const availableWidth = email.clientWidth;
        const maximumFontSize = Number.parseFloat(
          window.getComputedStyle(email).fontSize
        );

        if (
          availableWidth <= 0 ||
          !Number.isFinite(maximumFontSize) ||
          email.scrollWidth <= availableWidth
        ) {
          return;
        }

        email.style.fontSize = `${minimumFontSize}px`;

        if (email.scrollWidth > availableWidth) {
          email.classList.add("is-wrapped");
          return;
        }

        let smallestFit = minimumFontSize;
        let largestOverflow = maximumFontSize;

        for (let iteration = 0; iteration < 8; iteration += 1) {
          const candidate = (smallestFit + largestOverflow) / 2;
          email.style.fontSize = `${candidate}px`;

          if (email.scrollWidth <= availableWidth) {
            smallestFit = candidate;
          } else {
            largestOverflow = candidate;
          }
        }

        email.style.fontSize = `${smallestFit}px`;
      });
    };

    fitEmail();

    const resizeObserver = new ResizeObserver(fitEmail);
    if (email.parentElement) {
      resizeObserver.observe(email.parentElement);
    }
    void document.fonts.ready.then(fitEmail);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [user.email, hasGoogleAccess]);

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

    if (deletesWithGoogle) {
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

  function closeGoogleLinkDialog() {
    if (isLinkingGoogle) return;
    setGoogleLinkDialogMode(null);
    setGoogleLinkError(null);
    onGoogleAccountLinkFeedbackHandled();
  }

  async function confirmGoogleAccountLink() {
    if (googleLinkDialogMode === "success") {
      closeGoogleLinkDialog();
      return;
    }

    if (isLinkingGoogle || user.authProvider !== "PASSWORD") {
      return;
    }

    setGoogleLinkError(null);
    setIsLinkingGoogle(true);
    prefetchScheduler.prioritizeUserRequest();

    try {
      const authorizationUrl = await startGoogleAccountLink();
      window.location.assign(authorizationUrl);
    } catch (error) {
      setGoogleLinkError(
        error instanceof Error
          ? error.message
          : "Unable to link your Google account."
      );
      setIsLinkingGoogle(false);
    }
  }

  function closeGoogleUnlinkDialog() {
    if (isUnlinkingGoogle) {
      return;
    }

    setGoogleUnlinkDialogMode(null);
    setGoogleUnlinkError(null);
    onGoogleAccountUnlinkFeedbackHandled();
  }

  async function confirmGoogleAccountUnlink() {
    if (
      isUnlinkingGoogle ||
      !hasGoogleAccess ||
      !canUnlinkMethods
    ) {
      return;
    }

    setGoogleUnlinkError(null);
    setIsUnlinkingGoogle(true);
    prefetchScheduler.prioritizeUserRequest();

    try {
      const authorizationUrl = await startGoogleAccountUnlink();
      window.location.assign(authorizationUrl);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        onSessionExpired();
        return;
      }

      setGoogleUnlinkError(
        error instanceof Error
          ? error.message
          : "Unable to unlink your Google account."
      );
      setIsUnlinkingGoogle(false);
    }
  }

  function closeUsernameUnlinkDialog() {
    if (isUnlinkingUsername) {
      return;
    }

    setIsUsernameUnlinkDialogOpen(false);
    setUsernameUnlinkPassword("");
    setUsernameUnlinkError(null);
  }

  async function confirmUsernameUnlink(event?: FormEvent) {
    event?.preventDefault();

    if (isUnlinkingUsername || !canUnlinkMethods || !hasUsernameAccess) {
      return;
    }

    const parsedPassword = validateAccountPassword(usernameUnlinkPassword);

    if (!parsedPassword.success) {
      setUsernameUnlinkError("Incorrect password.");
      return;
    }

    setUsernameUnlinkError(null);
    setIsUnlinkingUsername(true);
    prefetchScheduler.prioritizeUserRequest();

    try {
      const updatedUser = await unlinkUsername(parsedPassword.data);
      onProfileUpdated(updatedUser);
      setIsUnlinkingUsername(false);
      setIsUsernameUnlinkDialogOpen(false);
      setUsernameUnlinkPassword("");
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.status === 401
      ) {
        onSessionExpired();
        return;
      }

      setUsernameUnlinkError(
        error instanceof ApiRequestError && error.status === 403
          ? "Incorrect password."
          : error instanceof Error
            ? error.message
            : "Unable to unlink username."
      );
      setIsUnlinkingUsername(false);
    }
  }

  function openRecoveryCodeDialog() {
    setSignOutOtherDevices(false);
    setRecoveryCodeResetError(null);
    setIsRecoveryCodeDialogOpen(true);
  }

  function closeRecoveryCodeDialog() {
    if (isResettingRecoveryCode) {
      return;
    }

    setIsRecoveryCodeDialogOpen(false);
    setSignOutOtherDevices(false);
    setRecoveryCodeResetError(null);
  }

  async function confirmRecoveryCodeReset() {
    if (isResettingRecoveryCode || !user.username) {
      return;
    }

    setRecoveryCodeResetError(null);
    setIsResettingRecoveryCode(true);
    prefetchScheduler.prioritizeUserRequest();

    try {
      const result = await resetRecoveryCode(signOutOtherDevices);
      setIsRecoveryCodeDialogOpen(false);
      setSignOutOtherDevices(false);
      setIsResettingRecoveryCode(false);
      onRecoveryCodeReset(result);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        setIsRecoveryCodeDialogOpen(false);
        setIsResettingRecoveryCode(false);
        onSessionExpired();
        return;
      }

      if (error instanceof ApiRequestError && error.status === 429) {
        setRecoveryCodeResetError(
          `Too many recovery code resets. Try again in ${
            error.retryAfter ?? "15 minutes"
          }`
        );
      } else {
        setRecoveryCodeResetError(
          error instanceof Error
            ? error.message
            : "Unable to reset the recovery code"
        );
      }

      setIsResettingRecoveryCode(false);
    }
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

              {user.username ? (
                <div className="profile-detail">
                  <span className="profile-detail__icon" aria-hidden="true">
                    <AtSign />
                  </span>
                  <div>
                    <dt>Username</dt>
                    <dd>{user.username}</dd>
                  </div>
                </div>
              ) : null}

              {user.email ? (
                <div
                  className={`profile-detail profile-detail--email${
                    showsGoogleProviderBadge
                      ? " profile-detail--with-provider"
                      : ""
                  }`}
                >
                  <span className="profile-detail__icon" aria-hidden="true">
                    {showsGoogleAccountDetail ? (
                      <GoogleIcon />
                    ) : (
                      <Mail />
                    )}
                  </span>
                  <div>
                    <dt>
                      {showsGoogleAccountDetail ? "Google account" : "Email"}
                    </dt>
                    <dd ref={profileEmailRef} className="profile-detail__email">
                      {user.email}
                    </dd>
                  </div>
                  {showsGoogleProviderBadge ? (
                    <div ref={googleInfoRef} className="profile-detail__provider-anchor">
                      <button
                        type="button"
                        className="profile-detail__provider"
                        aria-label="View Google sign-in details"
                        aria-expanded={isGoogleInfoOpen}
                        aria-controls="profile-google-info"
                        onClick={() => setIsGoogleInfoOpen((isOpen) => !isOpen)}
                      >
                        <GoogleIcon />
                      </button>

                      {isGoogleInfoOpen ? (
                        <div
                          id="profile-google-info"
                          className="profile-google-info"
                          role="note"
                        >
                          <strong>Google sign in activated</strong>
                          <p>
                            {`You can sign in with Google as ${user.email}, or use your email and password.`}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

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

          <section
            className="profile-section"
            aria-labelledby="profile-account-title"
          >
            <h2 id="profile-account-title">Account</h2>

            <div className="profile-action-list">
              <ProfileActionButton
                label="Edit profile"
                icon={<Pencil />}
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
              {!hasGoogleAccess ? (
                <ProfileActionButton
                  label="Link Google"
                  icon={<GoogleIcon />}
                  onClick={() => {
                    setGoogleLinkError(null);
                    setGoogleLinkDialogMode("confirm");
                  }}
                />
              ) : null}
              {!hasEmailAccess ? (
                <ProfileActionButton
                  label="Link email"
                  icon={<Mail />}
                  onClick={onLinkEmail}
                />
              ) : null}
              {!hasUsernameAccess ? (
                <ProfileActionButton
                  label="Link username"
                  icon={<AtSign />}
                  onClick={onLinkUsername}
                />
              ) : null}

              {canUnlinkMethods && hasGoogleAccess ? (
                <ProfileActionButton
                  label="Unlink Google"
                  icon={<GoogleIcon className="profile-action__google-icon" />}
                  tone="unlink"
                  onClick={() => {
                    setGoogleUnlinkError(null);
                    setGoogleUnlinkDialogMode("confirm");
                  }}
                />
              ) : null}
              {canUnlinkMethods && hasEmailAccess ? (
                <ProfileActionButton
                  label="Unlink email"
                  icon={<Mail />}
                  tone="unlink"
                />
              ) : null}
              {canUnlinkMethods && hasUsernameAccess ? (
                <ProfileActionButton
                  label="Unlink username"
                  icon={<AtSign />}
                  tone="unlink"
                  onClick={() => {
                    setUsernameUnlinkPassword("");
                    setUsernameUnlinkError(null);
                    setIsUsernameUnlinkDialogOpen(true);
                  }}
                />
              ) : null}
            </div>
          </section>

          {hasSecurityActions ? (
            <section
              className="profile-section"
              aria-labelledby="profile-security-title"
            >
              <h2 id="profile-security-title">Security</h2>

              <div className="profile-action-list">
                {user.authProvider !== "GOOGLE" ? (
                  <ProfileActionButton
                    label="Change password"
                    icon={<KeyRound />}
                    onClick={onChangePassword}
                  />
                ) : null}
                {hasUsernameAccess ? (
                  <ProfileActionButton
                    label="Reset recovery code"
                    icon={<Key />}
                    onClick={openRecoveryCodeDialog}
                  />
                ) : null}
              </div>
            </section>
          ) : null}

          <section
            className="profile-section"
            aria-labelledby="profile-session-title"
          >
            <h2 id="profile-session-title">Session</h2>

            <div
              className="profile-action-list profile-session-actions"
              aria-label="Session and account actions"
            >
              <ProfileActionButton
                label="Log out"
                icon={<LogOut />}
                onClick={() => {
                  setLogoutError(null);
                  setIsLogoutDialogOpen(true);
                }}
              />
              <ProfileActionButton
                label="Delete account"
                icon={<Trash2 />}
                tone="danger"
                onClick={() => {
                  setDeleteError(null);
                  setDeletePassword("");
                  setDeleteVerificationMethod(
                    user.authProvider === "PASSWORD" ? "password" : "google"
                  );
                  setDeleteDialogMode("confirm");
                }}
              />
            </div>
          </section>
        </div>
      </section>

      <ConfirmDialog
        open={isEditDialogOpen}
        title="Edit profile"
        description="Update your name or starting net worth."
        confirmLabel="Continue"
        confirmingLabel="Saving..."
        icon={<Pencil />}
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
            <label className="text-field-label" htmlFor="profile-name">
              Name
            </label>
            <input
              id="profile-name"
              className="text-field text-field--dialog"
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
            <label
              className="text-field-label"
              htmlFor="profile-starting-net-worth"
            >
              Starting net worth
            </label>
            <input
              id="profile-starting-net-worth"
              className="text-field text-field--dialog"
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
        open={isRecoveryCodeDialogOpen}
        title="Reset recovery code?"
        description={
          "A new recovery code will replace your current one. The old code stops working only when the replacement is ready"
        }
        confirmLabel="Reset code"
        confirmingLabel="Creating..."
        icon={<Key />}
        isConfirming={isResettingRecoveryCode}
        error={recoveryCodeResetError}
        onCancel={closeRecoveryCodeDialog}
        onConfirm={confirmRecoveryCodeReset}
      >
        <label className="recovery-code-reset-option">
          <input
            type="checkbox"
            checked={signOutOtherDevices}
            disabled={isResettingRecoveryCode}
            onChange={(event) => {
              setSignOutOtherDevices(event.target.checked);
              setRecoveryCodeResetError(null);
            }}
          />
          <span
            className="recovery-code-reset-option__checkbox"
            aria-hidden="true"
          >
            <Check />
          </span>
          <span className="recovery-code-reset-option__copy">
            <strong>Sign out other devices</strong>
            <span>This device stays signed in</span>
          </span>
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={googleLinkDialogMode !== null}
        title={
          googleLinkDialogMode === "success"
            ? "Google account linked"
            : googleLinkDialogMode === "mismatch"
              ? "Incorrect Google account"
              : googleLinkDialogMode === "failed"
                ? "Google account not linked"
                : "Link Google account?"
        }
        description={
          googleLinkDialogMode === "success"
            ? "You can now sign in with your password or Google."
            : googleLinkDialogMode === "mismatch"
              ? user.email
                ? `Nothing was linked. Choose ${user.email}, the email used by this account.`
                : "Nothing was linked. Choose a Google account that is not used elsewhere."
              : googleLinkDialogMode === "failed"
                ? user.email
                  ? `We couldn't link Google. Try again and choose ${user.email}.`
                  : "We couldn't link that Google account. Please try again."
                : user.email
                  ? `Keep password access and add Google sign-in. Continue and choose ${user.email}.`
                  : "Keep password access and add Google sign-in. Its verified email will be added to this account."
        }
        confirmLabel={
          googleLinkDialogMode === "success"
            ? "Done"
            : googleLinkDialogMode === "confirm"
              ? "Continue"
              : "Try again"
        }
        confirmingLabel="Opening..."
        icon={
          googleLinkDialogMode === "success" ? (
            <CircleCheck />
          ) : googleLinkDialogMode === "mismatch" ||
            googleLinkDialogMode === "failed" ? (
            <TriangleAlert />
          ) : (
            <GoogleIcon />
          )
        }
        tone={
          googleLinkDialogMode === "mismatch" ||
          googleLinkDialogMode === "failed"
            ? "warning"
            : "default"
        }
        showCancel={googleLinkDialogMode !== "success"}
        isConfirming={isLinkingGoogle}
        error={googleLinkError}
        onCancel={closeGoogleLinkDialog}
        onConfirm={confirmGoogleAccountLink}
      />

      <ConfirmDialog
        open={googleUnlinkDialogMode !== null}
        title={
          googleUnlinkDialogMode === "mismatch"
            ? "Incorrect Google account"
            : googleUnlinkDialogMode === "failed"
              ? "Google account not unlinked"
              : "Unlink Google?"
        }
        description={
          googleUnlinkDialogMode === "mismatch"
            ? `Nothing was unlinked. Choose ${user.email}, the Google account linked to this profile.`
            : googleUnlinkDialogMode === "failed"
              ? `Nothing was unlinked. We couldn't verify ${user.email}. Try again.`
              : getGoogleUnlinkDescription(user)
        }
        confirmLabel={
          googleUnlinkDialogMode === "confirm" ? "Continue" : "Try again"
        }
        confirmingLabel="Opening..."
        icon={
          googleUnlinkDialogMode === "confirm" ? (
            <GoogleIcon />
          ) : (
            <TriangleAlert />
          )
        }
        tone={googleUnlinkDialogMode === "confirm" ? "default" : "warning"}
        confirmTone="danger"
        isConfirming={isUnlinkingGoogle}
        error={googleUnlinkError}
        onCancel={closeGoogleUnlinkDialog}
        onConfirm={confirmGoogleAccountUnlink}
      />

      <ConfirmDialog
        open={isUsernameUnlinkDialogOpen}
        title="Unlink username?"
        description={getUsernameUnlinkDescription(user)}
        confirmLabel="Unlink username"
        confirmingLabel="Unlinking..."
        icon={<AtSign />}
        tone="danger"
        confirmTone="danger"
        isConfirming={isUnlinkingUsername}
        confirmDisabled={!usernameUnlinkPassword}
        error={usernameUnlinkError}
        onCancel={closeUsernameUnlinkDialog}
        onConfirm={confirmUsernameUnlink}
      >
        <form
          className="confirm-dialog__form"
          onSubmit={confirmUsernameUnlink}
        >
          <AuthPasswordField
            id="unlink-username-password"
            label="Confirm your password"
            name="unlinkUsernamePassword"
            placeholder="Enter your password"
            value={usernameUnlinkPassword}
            invalid={usernameUnlinkError === "Incorrect password."}
            autoComplete="current-password"
            variant="dialog"
            disabled={isUnlinkingUsername}
            onChange={(value) => {
              setUsernameUnlinkPassword(value);
              setUsernameUnlinkError(null);
            }}
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
            ? `Nothing was deleted. Choose the Google account linked to ${user.email}.`
            : deleteDialogMode === "rate-limited"
              ? `Too many deletion attempts. Try again in ${deleteRetryAfter}.`
            : deleteDialogMode === "failed"
              ? `Nothing was deleted. We couldn't verify ${user.email}. Try again.`
              : user.authProvider === "PASSWORD_AND_GOOGLE"
                ? "Permanently delete your account.\nChoose how to verify your identity.\nThis cannot be undone."
                : user.authProvider === "GOOGLE"
                  ? "Permanently delete your account.\nContinue to verify with Google.\nThis cannot be undone."
                  : "Permanently delete your account.\nThis cannot be undone."
        }
        confirmLabel={
          deleteDialogMode === "rate-limited"
            ? "Got it"
            : deletesWithGoogle
            ? deleteDialogMode === "confirm"
              ? "Continue"
              : "Try again"
            : "Delete account"
        }
        confirmingLabel={
          deletesWithGoogle ? "Opening..." : "Deleting..."
        }
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
          !deletesWithGoogle &&
          !deletePassword
        }
        error={deleteError}
        onCancel={closeDeleteDialog}
        onConfirm={confirmAccountDeletion}
      >
        {user.authProvider === "PASSWORD_AND_GOOGLE" &&
        deleteDialogMode === "confirm" ? (
          <SlidingSegmentedControl
            className="confirm-dialog__verification-method"
            value={deleteVerificationMethod}
            options={deleteVerificationOptions}
            label="Account deletion verification method"
            tone="expense"
            compact
            allowDrag={false}
            disabled={isDeletingAccount}
            onChange={(method) => {
              setDeleteVerificationMethod(method);
              setDeletePassword("");
              setDeleteError(null);
            }}
          />
        ) : null}

        {!deletesWithGoogle && deleteDialogMode === "confirm" ? (
          <form className="confirm-dialog__form" onSubmit={confirmAccountDeletion}>
            <AuthPasswordField
              id="delete-account-password"
              label="Confirm your password"
              name="deleteAccountPassword"
              placeholder="Enter your password"
              value={deletePassword}
              invalid={deleteError !== null}
              autoComplete="current-password"
              variant="dialog"
              disabled={isDeletingAccount}
              onChange={(value) => {
                setDeletePassword(value);
                setDeleteError(null);
              }}
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
  tone?: "default" | "danger" | "unlink";
  onClick?: () => void;
};

function ProfileActionButton({
  label,
  icon,
  tone = "default",
  onClick
}: ProfileActionButtonProps) {
  return (
    <ActionButton
      className={`profile-action profile-action--${tone}`}
      type="button"
      onClick={onClick}
      disabled={!onClick}
    >
      <span className="profile-action__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="profile-action__label">{label}</span>
      <ChevronRight className="profile-action__chevron" aria-hidden="true" />
    </ActionButton>
  );
}
