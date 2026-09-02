import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import {
  ArrowLeftRight,
  AtSign,
  Info,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  Key,
  KeyRound,
  Landmark,
  LogOut,
  Mail,
  MessageSquare,
  Pencil,
  TriangleAlert,
  Trash2,
  UserRound,
  WalletCards
} from "lucide-react";

import { GoogleIcon } from "../../components/brand/GoogleIcon";
import { ActionButton } from "../../components/ui/ActionButton";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { formatErrorMessage } from "../../components/ui/error-message";
import { SlidingSegmentedControl } from "../../components/ui/SlidingSegmentedControl";
import { prefetchScheduler } from "../../cache/prefetch-scheduler";
import { formatEuroAmount } from "../../money/format-euro";
import {
  ApiRequestError,
  beginEmailUnlink,
  cancelEmailUnlink,
  deleteAccount,
  resendEmailUnlinkCode,
  resetRecoveryCode,
  startGoogleAccountLink,
  startGoogleAccountDeletion,
  startGoogleAccountUnlink,
  unlinkUsername,
  verifyEmailUnlinkCode,
  type RecoveryCodeResetResult,
  type SessionUser
} from "../auth/auth-api";
import { AuthPasswordField } from "../auth/AuthPasswordField";
import {
  EMAIL_VERIFICATION_CODE_LENGTH,
  EmailVerificationCodeInput,
  EmailVerificationResendButton
} from "../auth/EmailVerificationCodeInput";
import { LegalNoticeScreen } from "../auth/LegalNoticeScreen";
import { validateAccountPassword } from "../auth/password-validation";

type ProfilePageProps = {
  user: SessionUser;
  scrollToTopSignal: number;
  initialScrollTop: number;
  onScrollTopChange: (scrollTop: number) => void;
  onEditProfile: () => void;
  onProfileUpdated: (user: SessionUser) => void;
  onChangePassword: () => void;
  onAppVersion: () => void;
  onFeedback: () => void;
  onLinkEmail: () => void;
  onLinkUsername: () => void;
  onUsdWallet: () => void;
  onAddExchange: () => void;
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
type GoogleUnlinkDialogMode = "confirm" | "success" | "mismatch" | "failed";
type EmailUnlinkDialogMode = "confirm" | "code" | "success";
type UsernameUnlinkDialogMode = "confirm" | "success";

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

function getGoogleUnlinkDescription(
  user: Pick<SessionUser, "email" | "emailLoginEnabled" | "username">
) {
  const googleEmail = user.email ?? "your linked Google account";

  if (user.username && user.emailLoginEnabled) {
    return `Google sign-in will be removed\nYou can still sign in with your username or email and password\nYour account will remain linked to ${googleEmail}\n\nContinue and choose ${googleEmail} to verify this change`;
  }

  if (user.username) {
    return `Google sign-in will be removed\nYou will only be able to sign in with your username and password\nYour account will no longer be linked to ${googleEmail}\n\nContinue and choose ${googleEmail} to verify this change`;
  }

  return `Google sign-in will be removed\nYou will only be able to sign in with your email and password\nYour account will remain linked to ${googleEmail}\n\nContinue and choose ${googleEmail} to verify this change`;
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
    return `Sign-in with your username and password will be removed\nYou can still sign in with ${email} and password or Google\nYour recovery code will also stop working`;
  }

  if (user.emailLoginEnabled) {
    return `Sign-in with your username and password will be removed\nYou will only be able to sign in with ${email} and password\nYour recovery code will also stop working`;
  }

  return `Sign-in with your username and password will be removed\nYou will only be able to sign in with Google as ${email}\nYour recovery code will also stop working`;
}

function getEmailUnlinkDescription(
  user: Pick<SessionUser, "authProvider" | "email" | "username">
) {
  const email = user.email ?? "your linked email";
  const hasGoogle = user.authProvider !== "PASSWORD";

  if (user.username && hasGoogle) {
    return `Sign-in with ${email} and password will be removed\nYou can still sign in with your username and password or Google\n${email} will remain linked to your Google sign-in\n\nA confirmation code will be sent to ${email}`;
  }

  if (user.username) {
    return `Sign-in with ${email} and password will be removed\nYou will only be able to sign in with your username and password\nThe email address will be removed from this account\n\nA confirmation code will be sent to ${email}`;
  }

  return `Sign-in with ${email} and password will be removed\nYou will only be able to sign in with Google as ${email}\nYour Finance Manager password will also be removed\n\nA confirmation code will be sent to ${email}`;
}

export function ProfilePage({
  user,
  scrollToTopSignal,
  initialScrollTop,
  onScrollTopChange,
  onEditProfile,
  onProfileUpdated,
  onChangePassword,
  onAppVersion,
  onFeedback,
  onLinkEmail,
  onLinkUsername,
  onUsdWallet,
  onAddExchange,
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
  const persistedScrollTop = useRef(initialScrollTop);
  const [isProfileScrollable, setIsProfileScrollable] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isLegalScreenOpen, setIsLegalScreenOpen] = useState(false);
  const [isLegalScreenClosing, setIsLegalScreenClosing] = useState(false);
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
        : googleAccountUnlinkFeedback === "success" ||
            googleAccountUnlinkFeedback === "mismatch" ||
            googleAccountUnlinkFeedback === "failed"
          ? googleAccountUnlinkFeedback
          : null
    );
  const [isUnlinkingGoogle, setIsUnlinkingGoogle] = useState(false);
  const [googleUnlinkError, setGoogleUnlinkError] = useState<string | null>(null);
  const emailUnlinkCodeInputRef = useRef<HTMLInputElement>(null);
  const [emailUnlinkDialogMode, setEmailUnlinkDialogMode] =
    useState<EmailUnlinkDialogMode | null>(null);
  const [isUnlinkingEmail, setIsUnlinkingEmail] = useState(false);
  const [isCancellingEmailUnlink, setIsCancellingEmailUnlink] = useState(false);
  const [isResendingEmailUnlinkCode, setIsResendingEmailUnlinkCode] =
    useState(false);
  const [emailUnlinkCode, setEmailUnlinkCode] = useState("");
  const [emailUnlinkError, setEmailUnlinkError] = useState<string | null>(null);
  const [emailUnlinkStatus, setEmailUnlinkStatus] = useState<string | null>(null);
  const [usernameUnlinkDialogMode, setUsernameUnlinkDialogMode] =
    useState<UsernameUnlinkDialogMode | null>(null);
  const [isUnlinkingUsername, setIsUnlinkingUsername] = useState(false);
  const [usernameUnlinkPassword, setUsernameUnlinkPassword] = useState("");
  const [usernameUnlinkError, setUsernameUnlinkError] = useState<string | null>(
    null
  );
  const summaryGoogleInfoRef = useRef<HTMLDivElement>(null);
  const [isSummaryGoogleInfoOpen, setIsSummaryGoogleInfoOpen] = useState(false);
  const [isSummaryGoogleInfoClosing, setIsSummaryGoogleInfoClosing] =
    useState(false);
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

  const deletesWithGoogle =
    user.authProvider === "GOOGLE" ||
    (user.authProvider === "PASSWORD_AND_GOOGLE" &&
      deleteVerificationMethod === "google");

  function openSummaryGoogleInfo() {
    setIsSummaryGoogleInfoClosing(false);
    setIsSummaryGoogleInfoOpen(true);
  }

  function closeSummaryGoogleInfo() {
    setIsSummaryGoogleInfoClosing(true);
  }

  useEffect(() => {
    if (!isSummaryGoogleInfoOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!summaryGoogleInfoRef.current?.contains(event.target as Node)) {
        closeSummaryGoogleInfo();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeSummaryGoogleInfo();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSummaryGoogleInfoOpen]);

  useLayoutEffect(() => {
    const root = profileScrollRef.current;

    persistedScrollTop.current = initialScrollTop;

    if (root) {
      root.scrollTop = initialScrollTop;
    }
  }, [initialScrollTop]);

  useEffect(
    () => () => {
      onScrollTopChange(
        profileScrollRef.current?.scrollTop ?? persistedScrollTop.current
      );
    },
    [onScrollTopChange]
  );

  function syncPersistedScrollTop() {
    const root = profileScrollRef.current;

    if (root) {
      persistedScrollTop.current = root.scrollTop;
    }
  }

  useEffect(() => {
    if (scrollToTopSignal > 0) {
      profileScrollRef.current?.scrollTo({
        top: 0,
        behavior: "smooth"
      });
      syncPersistedScrollTop();
    }
  }, [scrollToTopSignal]);

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
      setLogoutError("We couldn't log you out\nPlease try again");
      setIsLoggingOut(false);
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
      setDeleteError("Incorrect password");
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
        error instanceof Error ? error.message : "Unable to delete account"
      );
    }

    setIsDeletingAccount(false);
  }

  function openLegalScreen() {
    setIsLegalScreenClosing(false);
    setIsLegalScreenOpen(true);
  }

  function closeLegalScreen() {
    setIsLegalScreenClosing(true);
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
          : "Unable to link your Google account"
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
    if (googleUnlinkDialogMode === "success") {
      closeGoogleUnlinkDialog();
      return;
    }

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
          : "Unable to unlink your Google account"
      );
      setIsUnlinkingGoogle(false);
    }
  }

  function resetEmailUnlinkDialog() {
    setEmailUnlinkDialogMode(null);
    setEmailUnlinkCode("");
    setEmailUnlinkError(null);
    setEmailUnlinkStatus(null);
    setIsCancellingEmailUnlink(false);
    setIsResendingEmailUnlinkCode(false);
  }

  async function closeEmailUnlinkDialog() {
    if (
      isUnlinkingEmail ||
      isCancellingEmailUnlink ||
      isResendingEmailUnlinkCode
    ) {
      return;
    }

    if (emailUnlinkDialogMode === "code") {
      setEmailUnlinkError(null);
      setEmailUnlinkStatus("Cancelling");
      setIsCancellingEmailUnlink(true);

      try {
        await cancelEmailUnlink();
      } catch (error) {
        setEmailUnlinkError(
          error instanceof Error
            ? error.message
            : "Unable to cancel email unlinking"
        );
        setIsCancellingEmailUnlink(false);
        return;
      }
    }

    resetEmailUnlinkDialog();
  }

  async function confirmEmailUnlink(event?: FormEvent) {
    event?.preventDefault();

    if (emailUnlinkDialogMode === "success") {
      resetEmailUnlinkDialog();
      return;
    }

    if (
      isUnlinkingEmail ||
      isCancellingEmailUnlink ||
      isResendingEmailUnlinkCode ||
      !canUnlinkMethods ||
      !hasEmailAccess ||
      !user.email
    ) {
      return;
    }

    if (
      emailUnlinkDialogMode === "code" &&
      emailUnlinkCode.length !== EMAIL_VERIFICATION_CODE_LENGTH
    ) {
      return;
    }

    setEmailUnlinkError(null);
    setEmailUnlinkStatus(null);
    setIsUnlinkingEmail(true);
    prefetchScheduler.prioritizeUserRequest();

    try {
      if (emailUnlinkDialogMode === "confirm") {
        await beginEmailUnlink();
        setEmailUnlinkCode("");
        setEmailUnlinkDialogMode("code");
      } else if (emailUnlinkDialogMode === "code") {
        const updatedUser = await verifyEmailUnlinkCode(emailUnlinkCode);
        onProfileUpdated(updatedUser);
        setEmailUnlinkCode("");
        setEmailUnlinkError(null);
        setEmailUnlinkStatus(null);
        setEmailUnlinkDialogMode("success");
      }
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        resetEmailUnlinkDialog();
        onSessionExpired();
        return;
      }

      if (
        emailUnlinkDialogMode === "code" &&
        error instanceof ApiRequestError &&
        error.status === 400
      ) {
        setEmailUnlinkCode("");
        window.requestAnimationFrame(() => {
          emailUnlinkCodeInputRef.current?.focus({ preventScroll: true });
        });
      }

      setEmailUnlinkError(
        error instanceof Error ? error.message : "Unable to unlink email"
      );
    } finally {
      setIsUnlinkingEmail(false);
    }
  }

  async function resendEmailUnlinkVerificationCode() {
    prefetchScheduler.prioritizeUserRequest();
    await resendEmailUnlinkCode();
  }

  function handleEmailUnlinkResendError(error: unknown) {
    if (error instanceof ApiRequestError && error.status === 401) {
      resetEmailUnlinkDialog();
      onSessionExpired();
      return;
    }

    setEmailUnlinkError(
      error instanceof Error
        ? error.message
        : "Unable to resend the verification code"
    );
  }

  function closeUsernameUnlinkDialog() {
    if (isUnlinkingUsername) {
      return;
    }

    setUsernameUnlinkDialogMode(null);
    setUsernameUnlinkPassword("");
    setUsernameUnlinkError(null);
  }

  async function confirmUsernameUnlink(event?: FormEvent) {
    event?.preventDefault();

    if (usernameUnlinkDialogMode === "success") {
      closeUsernameUnlinkDialog();
      return;
    }

    if (isUnlinkingUsername || !canUnlinkMethods || !hasUsernameAccess) {
      return;
    }

    const parsedPassword = validateAccountPassword(usernameUnlinkPassword);

    if (!parsedPassword.success) {
      setUsernameUnlinkError("Incorrect password");
      return;
    }

    setUsernameUnlinkError(null);
    setIsUnlinkingUsername(true);
    prefetchScheduler.prioritizeUserRequest();

    try {
      const updatedUser = await unlinkUsername(parsedPassword.data);
      onProfileUpdated(updatedUser);
      setIsUnlinkingUsername(false);
      setUsernameUnlinkPassword("");
      setUsernameUnlinkDialogMode("success");
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
          ? "Incorrect password"
          : error instanceof Error
            ? error.message
            : "Unable to unlink username"
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
          `Too many recovery code resets\nTry again in ${
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
        onScroll={syncPersistedScrollTop}
      >
        <div ref={profileContentRef} className="profile-page">
          <section
            className="profile-section profile-summary-section"
            aria-label="Account summary"
          >
            <div className="profile-summary-card">
              <div className="profile-summary-card__body">
                {user.email ? (
                  <div
                    className={`profile-summary-card__item profile-summary-card__item--email${
                      showsGoogleProviderBadge
                        ? " profile-summary-card__item--with-provider"
                        : ""
                    }`}
                  >
                    <span
                      className={`profile-summary-card__item-icon${
                        showsGoogleAccountDetail
                          ? " profile-summary-card__item-icon--google"
                          : ""
                      }`}
                      aria-hidden="true"
                    >
                      {showsGoogleAccountDetail ? <GoogleIcon /> : <Mail />}
                    </span>
                    <div>
                      <span>
                        {showsGoogleAccountDetail ? "Google account" : "Email"}
                      </span>
                      <strong>{user.email}</strong>
                    </div>
                    {showsGoogleProviderBadge ? (
                      <div
                        ref={summaryGoogleInfoRef}
                        className="profile-summary-card__provider-anchor"
                      >
                        <button
                          type="button"
                          className="profile-summary-card__provider"
                          aria-label="View Google sign-in details"
                          aria-expanded={isSummaryGoogleInfoOpen}
                          aria-controls="profile-summary-google-info"
                          onClick={() => {
                            if (isSummaryGoogleInfoOpen) {
                              closeSummaryGoogleInfo();
                              return;
                            }

                            openSummaryGoogleInfo();
                          }}
                        >
                          <GoogleIcon />
                        </button>

                        {isSummaryGoogleInfoOpen ? (
                          <div
                            id="profile-summary-google-info"
                            className={`profile-summary-card__google-info${
                              isSummaryGoogleInfoClosing
                                ? " profile-summary-card__google-info--closing"
                                : ""
                            }`}
                            role="note"
                            onAnimationEnd={(event) => {
                              if (
                                event.target !== event.currentTarget ||
                                !isSummaryGoogleInfoClosing
                              ) {
                                return;
                              }

                              setIsSummaryGoogleInfoOpen(false);
                              setIsSummaryGoogleInfoClosing(false);
                            }}
                          >
                            <strong>Google sign in activated</strong>
                            <p>
                              {`You can sign in with Google as ${user.email}, or use your email and password`}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div
                  className={`profile-summary-card__identity${
                    user.username ? "" : " profile-summary-card__identity--single"
                  }`}
                >
                  <div className="profile-summary-card__item">
                    <span className="profile-summary-card__item-icon" aria-hidden="true">
                      <UserRound />
                    </span>
                    <div>
                      <span>Name</span>
                      <strong>{user.name}</strong>
                    </div>
                  </div>

                  {user.username ? (
                    <div className="profile-summary-card__item">
                      <span className="profile-summary-card__item-icon" aria-hidden="true">
                        <AtSign />
                      </span>
                      <div>
                        <span>Username</span>
                        <strong>@{user.username}</strong>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="profile-summary-card__meta">
                  <div className="profile-summary-card__item">
                    <span className="profile-summary-card__item-icon" aria-hidden="true">
                      <CalendarDays />
                    </span>
                    <div>
                      <span>Created</span>
                      <strong>{formatCreationDate(user.createdAt)}</strong>
                    </div>
                  </div>
                  <div className="profile-summary-card__item">
                    <span className="profile-summary-card__item-icon" aria-hidden="true">
                      <Landmark />
                    </span>
                    <div>
                      <span>Starting net worth</span>
                      <strong>{formatStartingNetWorth(user.startingNetWorth)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
                onClick={onEditProfile}
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
                  onClick={() => {
                    setEmailUnlinkCode("");
                    setEmailUnlinkError(null);
                    setEmailUnlinkStatus(null);
                    setEmailUnlinkDialogMode("confirm");
                  }}
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
                    setUsernameUnlinkDialogMode("confirm");
                  }}
                />
              ) : null}
            </div>
          </section>

          <section
            className="profile-section"
            aria-labelledby="profile-money-title"
          >
            <h2 id="profile-money-title">Money</h2>

            <div className="profile-action-list">
              <ProfileActionButton
                label="USD wallet"
                icon={<WalletCards />}
                onClick={onUsdWallet}
              />
              <ProfileActionButton
                label="Add exchange"
                icon={<ArrowLeftRight />}
                onClick={onAddExchange}
              />
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
            aria-labelledby="profile-about-title"
          >
            <h2 id="profile-about-title">About</h2>

            <div className="profile-action-list">
              <ProfileActionButton
                label="Feedback"
                icon={<MessageSquare />}
                onClick={onFeedback}
              />
              <ProfileActionButton
                label="App version"
                icon={<Info />}
                onClick={onAppVersion}
              />
              <ProfileActionButton
                label="Privacy & Terms"
                icon={<FileText />}
                onClick={openLegalScreen}
              />
            </div>
          </section>

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
        open={isRecoveryCodeDialogOpen}
        title="Reset recovery code?"
        description={
          "A new recovery code will replace your current one\nThe old code stops working only when the replacement is ready"
        }
        confirmLabel="Reset code"
        confirmingLabel="Creating"
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
            ? "You can now sign in with your password or Google"
            : googleLinkDialogMode === "mismatch"
              ? user.email
                ? `Nothing was linked\nChoose ${user.email}, the email used by this account`
                : "Nothing was linked\nChoose a Google account that is not used elsewhere"
              : googleLinkDialogMode === "failed"
                ? user.email
                  ? `We couldn't link Google\nTry again and choose ${user.email}`
                  : "We couldn't link that Google account\nPlease try again"
                : user.email
                  ? `Add Google sign-in and keep password\nContinue and choose ${user.email}`
                  : "Add Google sign-in and keep password\nIts verified email will be added to this account"
        }
        confirmLabel={
          googleLinkDialogMode === "success"
            ? "Done"
            : googleLinkDialogMode === "confirm"
              ? "Continue"
              : "Try again"
        }
        confirmingLabel="Opening"
        icon={
          googleLinkDialogMode === "success" ? (
            <Check />
          ) : googleLinkDialogMode === "mismatch" ||
            googleLinkDialogMode === "failed" ? (
            <TriangleAlert />
          ) : (
            <GoogleIcon />
          )
        }
        iconClassName={
          googleLinkDialogMode === "success" ? "success-check-icon" : undefined
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
          googleUnlinkDialogMode === "success"
            ? "Google account unlinked"
            : googleUnlinkDialogMode === "mismatch"
              ? "Incorrect Google account"
              : googleUnlinkDialogMode === "failed"
                ? "Google account not unlinked"
                : "Unlink Google?"
        }
        description={
          googleUnlinkDialogMode === "success"
            ? "Google sign-in has been removed from your account"
            : googleUnlinkDialogMode === "mismatch"
              ? `Nothing was unlinked\nChoose ${user.email}, the Google account linked to this profile`
              : googleUnlinkDialogMode === "failed"
                ? `Nothing was unlinked\nWe couldn't verify ${user.email}\nTry again`
                : getGoogleUnlinkDescription(user)
        }
        confirmLabel={
          googleUnlinkDialogMode === "success"
            ? "Done"
            : googleUnlinkDialogMode === "confirm"
              ? "Continue"
              : "Try again"
        }
        confirmingLabel="Opening"
        icon={
          googleUnlinkDialogMode === "success" ? (
            <Check />
          ) : googleUnlinkDialogMode === "confirm" ? (
            <GoogleIcon />
          ) : (
            <TriangleAlert />
          )
        }
        iconClassName={
          googleUnlinkDialogMode === "success"
            ? "success-check-icon"
            : undefined
        }
        tone={
          googleUnlinkDialogMode === "mismatch" ||
          googleUnlinkDialogMode === "failed"
            ? "warning"
            : "default"
        }
        confirmTone={
          googleUnlinkDialogMode === "success" ? "default" : "danger"
        }
        showCancel={googleUnlinkDialogMode !== "success"}
        isConfirming={isUnlinkingGoogle}
        error={googleUnlinkError}
        onCancel={closeGoogleUnlinkDialog}
        onConfirm={confirmGoogleAccountUnlink}
      />

      <ConfirmDialog
        open={emailUnlinkDialogMode !== null}
        title={
          emailUnlinkDialogMode === "success"
            ? "Email unlinked"
            : emailUnlinkDialogMode === "code"
              ? "Enter verification code"
              : "Unlink email?"
        }
        description={
          emailUnlinkDialogMode === "success"
            ? "Email sign-in with your password has been removed from your account"
            : emailUnlinkDialogMode === "code"
              ? `Enter the 6-digit code sent to\n${user.email}`
              : getEmailUnlinkDescription(user)
        }
        confirmLabel={
          emailUnlinkDialogMode === "success"
            ? "Done"
            : emailUnlinkDialogMode === "code"
              ? "Unlink email"
              : "Continue"
        }
        confirmingLabel={
          emailUnlinkDialogMode === "code" ? "Unlinking" : "Sending"
        }
        icon={
          emailUnlinkDialogMode === "success" ? <Check /> : <Mail />
        }
        iconClassName={
          emailUnlinkDialogMode === "success" ? "success-check-icon" : undefined
        }
        tone={emailUnlinkDialogMode === "success" ? "default" : "danger"}
        confirmTone={
          emailUnlinkDialogMode === "success" ? "default" : "danger"
        }
        showCancel={emailUnlinkDialogMode !== "success"}
        isConfirming={isUnlinkingEmail}
        interactionLocked={
          isCancellingEmailUnlink || isResendingEmailUnlinkCode
        }
        confirmDisabled={
          emailUnlinkDialogMode === "code" &&
          emailUnlinkCode.length !== EMAIL_VERIFICATION_CODE_LENGTH
        }
        error={
          emailUnlinkDialogMode === "confirm" ? emailUnlinkError : null
        }
        onCancel={closeEmailUnlinkDialog}
        onConfirm={confirmEmailUnlink}
      >
        {emailUnlinkDialogMode === "code" ? (
          <form
            className="confirm-dialog__form confirm-dialog__email-code-form"
            noValidate
            onSubmit={confirmEmailUnlink}
          >
            <EmailVerificationCodeInput
              ref={emailUnlinkCodeInputRef}
              id="unlink-email-code"
              value={emailUnlinkCode}
              invalid={emailUnlinkError !== null}
              disabled={
                isUnlinkingEmail ||
                isCancellingEmailUnlink ||
                isResendingEmailUnlinkCode
              }
              tone="danger"
              describedBy="unlink-email-code-feedback"
              onChange={(value) => {
                setEmailUnlinkCode(value);
                setEmailUnlinkError(null);
                setEmailUnlinkStatus(null);
              }}
            />

            <p className="auth-verification-expiry">
              The code expires in 10 minutes
            </p>

            <p
              id="unlink-email-code-feedback"
              className={`auth-field-message auth-verification-feedback${
                emailUnlinkError ? " auth-field-message--error" : ""
              }`}
              role={emailUnlinkError ? "alert" : "status"}
              aria-live="polite"
            >
              {emailUnlinkError
                ? formatErrorMessage(emailUnlinkError)
                : (emailUnlinkStatus ?? "\u00a0")}
            </p>

            <EmailVerificationResendButton
              disabled={isUnlinkingEmail || isCancellingEmailUnlink}
              tone="danger"
              onResend={resendEmailUnlinkVerificationCode}
              onResendStart={() => {
                setEmailUnlinkError(null);
                setEmailUnlinkStatus(null);
              }}
              onResendSuccess={() =>
                setEmailUnlinkStatus("A new code has been sent")
              }
              onResendError={handleEmailUnlinkResendError}
              onBusyChange={setIsResendingEmailUnlinkCode}
            />
          </form>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={usernameUnlinkDialogMode !== null}
        title={
          usernameUnlinkDialogMode === "success"
            ? "Username unlinked"
            : "Unlink username?"
        }
        description={
          usernameUnlinkDialogMode === "success"
            ? "Username sign-in and its recovery code have been removed from your account"
            : getUsernameUnlinkDescription(user)
        }
        confirmLabel={
          usernameUnlinkDialogMode === "success" ? "Done" : "Unlink username"
        }
        confirmingLabel="Unlinking"
        icon={
          usernameUnlinkDialogMode === "success" ? <Check /> : <AtSign />
        }
        iconClassName={
          usernameUnlinkDialogMode === "success"
            ? "success-check-icon"
            : undefined
        }
        tone={usernameUnlinkDialogMode === "success" ? "default" : "danger"}
        confirmTone={
          usernameUnlinkDialogMode === "success" ? "default" : "danger"
        }
        showCancel={usernameUnlinkDialogMode !== "success"}
        isConfirming={isUnlinkingUsername}
        confirmDisabled={
          usernameUnlinkDialogMode === "confirm" && !usernameUnlinkPassword
        }
        error={
          usernameUnlinkDialogMode === "confirm"
            ? usernameUnlinkError
            : null
        }
        onCancel={closeUsernameUnlinkDialog}
        onConfirm={confirmUsernameUnlink}
      >
        {usernameUnlinkDialogMode === "confirm" ? (
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
              invalid={usernameUnlinkError === "Incorrect password"}
              autoComplete="current-password"
              variant="dialog"
              disabled={isUnlinkingUsername}
              onChange={(value) => {
                setUsernameUnlinkPassword(value);
                setUsernameUnlinkError(null);
              }}
            />
          </form>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={isLogoutDialogOpen}
        title="Log out?"
        description="You'll need to sign in again"
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
            ? `Nothing was deleted\nChoose the Google account linked to ${user.email}`
            : deleteDialogMode === "rate-limited"
              ? `Too many deletion attempts\nTry again in ${deleteRetryAfter}`
            : deleteDialogMode === "failed"
              ? `Nothing was deleted\nWe couldn't verify ${user.email}\nTry again`
              : user.authProvider === "PASSWORD_AND_GOOGLE"
                ? "Permanently delete your account\nChoose how to verify your identity\nThis cannot be undone"
                : user.authProvider === "GOOGLE"
                  ? "Permanently delete your account\nContinue to verify with Google\nThis cannot be undone"
                  : "Permanently delete your account\nThis cannot be undone"
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
          deletesWithGoogle ? "Opening" : "Deleting"
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
