import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import {
  invalidateAfterExchangeWrite,
  invalidateAfterStartingNetWorthWrite,
  invalidateAfterTransactionWrite
} from "../../cache/financial-cache";
import { prefetchScheduler } from "../../cache/prefetch-scheduler";
import type {
  RecoveryCodeResetResult,
  SessionUser
} from "../auth/auth-api";
import { StatsPage } from "../statistics/StatsPage";
import {
  createInitialMovesPageState,
  MovesPage,
  type MovesScrollTarget,
  type MovesPageState
} from "../transactions/MovesPage";
import {
  createEmptyMovesFilters,
  type MovesFilters
} from "../transactions/moves-filters";
import { TransactionComposer } from "../transactions/TransactionComposer";
import { TransactionDetailSheet } from "../transactions/TransactionDetailSheet";
import type { TransactionPreview } from "../transactions/transaction-api";
import type { CurrencyExchangeListItem } from "../currency/currency-api";
import { AddExchangePage } from "./AddExchangePage";
import { HomeFooterNav } from "./HomeFooterNav";
import { HomeOverviewPage } from "./HomeOverviewPage";
import { AppVersionPage } from "./AppVersionPage";
import { ChangePasswordPage } from "./ChangePasswordPage";
import { EditProfilePage } from "./EditProfilePage";
import { EmailLinkFlow } from "./EmailLinkFlow";
import { FeatureSuggestionPage } from "./FeatureSuggestionPage";
import type { HomeSectionId } from "./home-sections";
import { ProfilePage } from "./ProfilePage";
import { RecoveryCodeResetPage } from "./RecoveryCodeResetPage";
import { UsernameLinkFlow } from "./UsernameLinkFlow";
import { UsdWalletPage } from "./UsdWalletPage";

export type GoogleAccountDeletionFeedback = "mismatch" | "failed" | "cancelled";
export type GoogleAccountLinkFeedback =
  | "success"
  | "mismatch"
  | "failed"
  | "cancelled";
export type GoogleAccountUnlinkFeedback =
  | "success"
  | "mismatch"
  | "failed"
  | "cancelled";

type HomePageProps = {
  user: SessionUser;
  initialSection?: HomeSectionId;
  lockSectionNavigation?: boolean;
  allowLockedNewTransaction?: boolean;
  onProfileUpdated: (user: SessionUser) => void;
  onLogout: () => Promise<void>;
  onAccountDeleted: () => void;
  onSessionExpired: () => void;
  onInitialContentReady: () => void;
  googleAccountDeletionFeedback: GoogleAccountDeletionFeedback | null;
  onGoogleAccountDeletionFeedbackHandled: () => void;
  googleAccountLinkFeedback: GoogleAccountLinkFeedback | null;
  onGoogleAccountLinkFeedbackHandled: () => void;
  googleAccountUnlinkFeedback: GoogleAccountUnlinkFeedback | null;
  onGoogleAccountUnlinkFeedbackHandled: () => void;
};

type HomeSectionProps = {
  user: SessionUser;
  onProfileUpdated: (user: SessionUser) => void;
  onEditProfile: () => void;
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
  onInitialContentReady: () => void;
  scrollToTopSignal: number;
  sectionScrollTops: Record<HomeSectionId, number>;
  onSectionScrollTopChange: (
    section: HomeSectionId,
    scrollTop: number
  ) => void;
  onNewTransaction: () => void;
  onExchangeEdit: (exchange: CurrencyExchangeListItem) => void;
  editingExchangeId: string | null;
  updatedExchange: CurrencyExchangeListItem | null;
  onNavigateToMoves: (filters?: MovesFilters) => void;
  onTransactionSelect: (
    transaction: TransactionPreview,
    viewportOffset?: number | null
  ) => void;
  movesScrollTarget: MovesScrollTarget | null;
  onMovesScrollTargetHandled: () => void;
  movesViewState: MovesPageState;
  onMovesViewStateChange: (state: MovesPageState) => void;
  googleAccountDeletionFeedback: GoogleAccountDeletionFeedback | null;
  onGoogleAccountDeletionFeedbackHandled: () => void;
  googleAccountLinkFeedback: GoogleAccountLinkFeedback | null;
  onGoogleAccountLinkFeedbackHandled: () => void;
  googleAccountUnlinkFeedback: GoogleAccountUnlinkFeedback | null;
  onGoogleAccountUnlinkFeedbackHandled: () => void;
};

const homeSections: Record<HomeSectionId, (props: HomeSectionProps) => ReactNode> = {
  home: ({
    user,
    onSessionExpired,
    onInitialContentReady,
    scrollToTopSignal,
    sectionScrollTops,
    onSectionScrollTopChange,
    onNewTransaction,
    onNavigateToMoves,
    onTransactionSelect
  }) => (
    <HomeOverviewPage
      user={user}
      onSessionExpired={onSessionExpired}
      onInitialContentReady={onInitialContentReady}
      scrollToTopSignal={scrollToTopSignal}
      initialScrollTop={sectionScrollTops.home}
      onScrollTopChange={(scrollTop) =>
        onSectionScrollTopChange("home", scrollTop)
      }
      onNewTransaction={onNewTransaction}
      onNavigateToMoves={onNavigateToMoves}
      onTransactionSelect={onTransactionSelect}
    />
  ),
  moves: ({
    user,
    onSessionExpired,
    scrollToTopSignal,
    sectionScrollTops,
    onSectionScrollTopChange,
    onNewTransaction,
    onExchangeEdit,
    editingExchangeId,
    updatedExchange,
    onTransactionSelect,
    movesScrollTarget,
    onMovesScrollTargetHandled,
    movesViewState,
    onMovesViewStateChange
  }) => (
    <MovesPage
      userId={user.id}
      initialState={movesViewState}
      onStateChange={onMovesViewStateChange}
      onNewTransaction={onNewTransaction}
      onExchangeEdit={onExchangeEdit}
      editingExchangeId={editingExchangeId}
      updatedExchange={updatedExchange}
      onTransactionSelect={onTransactionSelect}
      scrollTarget={movesScrollTarget}
      onScrollTargetHandled={onMovesScrollTargetHandled}
      scrollToTopSignal={scrollToTopSignal}
      onSessionExpired={onSessionExpired}
    />
  ),
  stats: ({
    user,
    onSessionExpired,
    scrollToTopSignal,
    sectionScrollTops,
    onSectionScrollTopChange,
    onNewTransaction,
    onTransactionSelect
  }) => (
    <StatsPage
      userId={user.id}
      scrollToTopSignal={scrollToTopSignal}
      initialScrollTop={sectionScrollTops.stats}
      onScrollTopChange={(scrollTop) =>
        onSectionScrollTopChange("stats", scrollTop)
      }
      onNewTransaction={onNewTransaction}
      onTransactionSelect={onTransactionSelect}
      onSessionExpired={onSessionExpired}
    />
  ),
  profile: ({
    user,
    scrollToTopSignal,
    sectionScrollTops,
    onSectionScrollTopChange,
    onProfileUpdated,
    onEditProfile,
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
  }) => (
    <ProfilePage
      user={user}
      scrollToTopSignal={scrollToTopSignal}
      initialScrollTop={sectionScrollTops.profile}
      onScrollTopChange={(scrollTop) =>
        onSectionScrollTopChange("profile", scrollTop)
      }
      onEditProfile={onEditProfile}
      onProfileUpdated={onProfileUpdated}
      onChangePassword={onChangePassword}
      onAppVersion={onAppVersion}
      onFeedback={onFeedback}
      onLinkEmail={onLinkEmail}
      onLinkUsername={onLinkUsername}
      onUsdWallet={onUsdWallet}
      onAddExchange={onAddExchange}
      onRecoveryCodeReset={onRecoveryCodeReset}
      onLogout={onLogout}
      onAccountDeleted={onAccountDeleted}
      onSessionExpired={onSessionExpired}
      googleAccountDeletionFeedback={googleAccountDeletionFeedback}
      onGoogleAccountDeletionFeedbackHandled={
        onGoogleAccountDeletionFeedbackHandled
      }
      googleAccountLinkFeedback={googleAccountLinkFeedback}
      onGoogleAccountLinkFeedbackHandled={
        onGoogleAccountLinkFeedbackHandled
      }
      googleAccountUnlinkFeedback={googleAccountUnlinkFeedback}
      onGoogleAccountUnlinkFeedbackHandled={
        onGoogleAccountUnlinkFeedbackHandled
      }
    />
  )
};

export function HomePage({
  user,
  initialSection,
  lockSectionNavigation = false,
  allowLockedNewTransaction = false,
  onProfileUpdated,
  onLogout,
  onAccountDeleted,
  onSessionExpired,
  onInitialContentReady,
  googleAccountDeletionFeedback,
  onGoogleAccountDeletionFeedbackHandled,
  googleAccountLinkFeedback,
  onGoogleAccountLinkFeedbackHandled,
  googleAccountUnlinkFeedback,
  onGoogleAccountUnlinkFeedbackHandled
}: HomePageProps) {
  const [activeSection, setActiveSection] = useState<HomeSectionId>(
    googleAccountDeletionFeedback ||
      googleAccountLinkFeedback ||
      googleAccountUnlinkFeedback
      ? "profile"
      : initialSection ?? "home"
  );
  const [isTransactionComposerOpen, setIsTransactionComposerOpen] =
    useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isAppVersionOpen, setIsAppVersionOpen] = useState(false);
  const [isGeneralFeedbackOpen, setIsGeneralFeedbackOpen] = useState(false);
  const [isFeatureSuggestionOpen, setIsFeatureSuggestionOpen] =
    useState(false);
  const [isEmailLinkOpen, setIsEmailLinkOpen] = useState(false);
  const [isUsernameLinkOpen, setIsUsernameLinkOpen] = useState(false);
  const [isUsdWalletOpen, setIsUsdWalletOpen] = useState(false);
  const [isAddExchangeOpen, setIsAddExchangeOpen] = useState(false);
  const [recoveryCodeReset, setRecoveryCodeReset] =
    useState<RecoveryCodeResetResult | null>(null);
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionPreview | null>(null);
  const [transactionBeingEdited, setTransactionBeingEdited] =
    useState<TransactionPreview | null>(null);
  const [exchangeBeingEdited, setExchangeBeingEdited] =
    useState<CurrencyExchangeListItem | null>(null);
  const [lastSavedExchange, setLastSavedExchange] =
    useState<CurrencyExchangeListItem | null>(null);
  const [movesScrollTarget, setMovesScrollTarget] =
    useState<MovesScrollTarget | null>(null);
  const movesSelectedTransactionViewportOffset = useRef<number | null>(
    null
  );
  const [movesViewState, setMovesViewState] = useState<MovesPageState>(
    createInitialMovesPageState
  );
  const [sectionScrollTops, setSectionScrollTops] = useState<
    Record<HomeSectionId, number>
  >({
    home: 0,
    moves: 0,
    stats: 0,
    profile: 0
  });
  const [scrollToTopRequest, setScrollToTopRequest] = useState<{
    section: HomeSectionId;
    signal: number;
  } | null>(null);
  const ActiveSection = homeSections[activeSection];
  const activeScrollToTopSignal =
    scrollToTopRequest?.section === activeSection
      ? scrollToTopRequest.signal
      : 0;

  const updateSectionScrollTop = useCallback(
    (section: HomeSectionId, scrollTop: number) => {
      setSectionScrollTops((current) =>
        current[section] === scrollTop
          ? current
          : {
              ...current,
              [section]: scrollTop
            }
      );
    },
    []
  );
  const isOverlayOpen =
    isEditProfileOpen ||
    isChangePasswordOpen ||
    isAppVersionOpen ||
    isGeneralFeedbackOpen ||
    isFeatureSuggestionOpen ||
    isEmailLinkOpen ||
    isUsernameLinkOpen ||
    isUsdWalletOpen ||
    isAddExchangeOpen ||
    recoveryCodeReset !== null ||
    isTransactionComposerOpen ||
    selectedTransaction !== null;

  useEffect(() => {
    if (activeSection !== "home") {
      onInitialContentReady();
    }
  }, [activeSection, onInitialContentReady]);

  function openNewTransaction() {
    if (lockSectionNavigation && !allowLockedNewTransaction) {
      return;
    }

    prefetchScheduler.prioritizeUserRequest();
    setTransactionBeingEdited(null);
    setIsTransactionComposerOpen(true);
  }

  function finishFinancialWrite(updatedTransactionId?: string) {
    const shouldRestoreEditedTransaction =
      activeSection === "moves" &&
      transactionBeingEdited !== null &&
      updatedTransactionId === transactionBeingEdited.id;
    const scrollTarget =
      shouldRestoreEditedTransaction && updatedTransactionId
        ? {
            transactionId: updatedTransactionId,
            viewportOffset:
              movesSelectedTransactionViewportOffset.current,
            isReady: false
          }
        : null;

    if (scrollTarget) {
      setMovesScrollTarget(scrollTarget);
    }

    setIsTransactionComposerOpen(false);
    void invalidateAfterTransactionWrite(user.id).finally(() => {
      if (scrollTarget) {
        setMovesScrollTarget((current) =>
          current?.transactionId === scrollTarget.transactionId
            ? { ...current, isReady: true }
            : current
        );
      }
    });
  }

  function finishExchangeWrite(exchange?: CurrencyExchangeListItem) {
    setIsAddExchangeOpen(false);
    setExchangeBeingEdited(null);
    setLastSavedExchange(exchange ?? null);
    void invalidateAfterExchangeWrite(user.id);
  }

  function finishProfileUpdate(updatedUser: SessionUser) {
    if (updatedUser.startingNetWorth !== user.startingNetWorth) {
      void invalidateAfterStartingNetWorthWrite(user.id);
    }

    onProfileUpdated(updatedUser);
  }

  function navigateToMoves(filters = createEmptyMovesFilters()) {
    if (lockSectionNavigation) {
      return;
    }

    prefetchScheduler.prioritizeUserRequest();
    setScrollToTopRequest(null);
    setMovesViewState(createInitialMovesPageState(filters));
    setActiveSection("moves");
  }

  function changeSection(section: HomeSectionId) {
    if (lockSectionNavigation) {
      return;
    }

    if (section === activeSection) {
      setScrollToTopRequest((current) => ({
        section,
        signal: (current?.signal ?? 0) + 1
      }));
      return;
    }

    prefetchScheduler.prioritizeUserRequest();
    setScrollToTopRequest(null);
    setActiveSection(section);
  }

  function openTransaction(
    transaction: TransactionPreview,
    viewportOffset: number | null = null
  ) {
    prefetchScheduler.prioritizeUserRequest();
    movesSelectedTransactionViewportOffset.current =
      activeSection === "moves" ? viewportOffset : null;
    setSelectedTransaction(transaction);
  }

  function openNewExchange() {
    if (lockSectionNavigation) {
      return;
    }

    prefetchScheduler.prioritizeUserRequest();
    setExchangeBeingEdited(null);
    setIsAddExchangeOpen(true);
  }

  function openExchangeEdit(exchange: CurrencyExchangeListItem) {
    if (lockSectionNavigation) {
      return;
    }

    prefetchScheduler.prioritizeUserRequest();
    setExchangeBeingEdited(exchange);
    setIsAddExchangeOpen(true);
  }

  return (
    <main className="home-screen">
      <div
        className={`home-main-layer${
          isChangePasswordOpen ||
          isEditProfileOpen ||
          isAppVersionOpen ||
          isGeneralFeedbackOpen ||
          isFeatureSuggestionOpen ||
          isEmailLinkOpen ||
          isUsernameLinkOpen ||
          isUsdWalletOpen ||
          recoveryCodeReset
            ? " is-account-page-open"
            : ""
        }`}
        aria-hidden={isOverlayOpen}
        inert={isOverlayOpen}
      >
        {ActiveSection({
          user,
          onProfileUpdated: finishProfileUpdate,
          onEditProfile: () => {
            if (lockSectionNavigation) {
              return;
            }

            prefetchScheduler.prioritizeUserRequest();
            setIsEditProfileOpen(true);
          },
          onChangePassword: () => {
            if (lockSectionNavigation) {
              return;
            }

            prefetchScheduler.prioritizeUserRequest();
            setIsChangePasswordOpen(true);
          },
          onAppVersion: () => {
            if (lockSectionNavigation) {
              return;
            }

            prefetchScheduler.prioritizeUserRequest();
            setIsAppVersionOpen(true);
          },
          onFeedback: () => {
            if (lockSectionNavigation) {
              return;
            }

            prefetchScheduler.prioritizeUserRequest();
            setIsGeneralFeedbackOpen(true);
          },
          onLinkEmail: () => {
            if (lockSectionNavigation) {
              return;
            }

            prefetchScheduler.prioritizeUserRequest();
            setIsEmailLinkOpen(true);
          },
          onLinkUsername: () => {
            if (lockSectionNavigation) {
              return;
            }

            prefetchScheduler.prioritizeUserRequest();
            setIsUsernameLinkOpen(true);
          },
          onUsdWallet: () => {
            if (lockSectionNavigation) {
              return;
            }

            prefetchScheduler.prioritizeUserRequest();
            setIsUsdWalletOpen(true);
          },
          onAddExchange: () => {
            openNewExchange();
          },
          onRecoveryCodeReset: setRecoveryCodeReset,
          onLogout,
          onAccountDeleted,
          onSessionExpired,
          onInitialContentReady,
          scrollToTopSignal: activeScrollToTopSignal,
          sectionScrollTops,
          onSectionScrollTopChange: updateSectionScrollTop,
          onNewTransaction: openNewTransaction,
          onExchangeEdit: openExchangeEdit,
          editingExchangeId: exchangeBeingEdited?.id ?? null,
          updatedExchange: lastSavedExchange,
          onNavigateToMoves: navigateToMoves,
          onTransactionSelect: openTransaction,
          movesScrollTarget,
          onMovesScrollTargetHandled: () =>
            setMovesScrollTarget(null),
          movesViewState,
          onMovesViewStateChange: setMovesViewState,
          googleAccountDeletionFeedback,
          onGoogleAccountDeletionFeedbackHandled,
          googleAccountLinkFeedback,
          onGoogleAccountLinkFeedbackHandled,
          googleAccountUnlinkFeedback,
          onGoogleAccountUnlinkFeedbackHandled
        })}

        <HomeFooterNav
          activeSection={activeSection}
          onSectionSelect={changeSection}
          disabled={lockSectionNavigation}
        />
      </div>

      <ChangePasswordPage
        open={isChangePasswordOpen}
        onBack={() => setIsChangePasswordOpen(false)}
      />

      <EditProfilePage
        open={isEditProfileOpen}
        user={user}
        onBack={() => setIsEditProfileOpen(false)}
        onProfileUpdated={finishProfileUpdate}
        onSessionExpired={onSessionExpired}
      />

      <AppVersionPage
        open={isAppVersionOpen}
        onSuggestFeature={() => {
          prefetchScheduler.prioritizeUserRequest();
          setIsFeatureSuggestionOpen(true);
        }}
        onBack={() => setIsAppVersionOpen(false)}
      />

      <FeatureSuggestionPage
        open={isFeatureSuggestionOpen}
        kind="suggestion"
        user={user}
        onBack={() => setIsFeatureSuggestionOpen(false)}
        onSessionExpired={onSessionExpired}
      />

      <FeatureSuggestionPage
        open={isGeneralFeedbackOpen}
        kind="general"
        user={user}
        onBack={() => setIsGeneralFeedbackOpen(false)}
        onSessionExpired={onSessionExpired}
      />

      <EmailLinkFlow
        open={isEmailLinkOpen}
        user={user}
        onProfileUpdated={finishProfileUpdate}
        onClose={() => setIsEmailLinkOpen(false)}
        onSessionExpired={onSessionExpired}
      />

      <UsernameLinkFlow
        open={isUsernameLinkOpen}
        user={user}
        onProfileUpdated={finishProfileUpdate}
        onClose={() => setIsUsernameLinkOpen(false)}
        onSessionExpired={onSessionExpired}
      />

      <AddExchangePage
        open={isAddExchangeOpen}
        exchange={exchangeBeingEdited}
        onClose={() => {
          setIsAddExchangeOpen(false);
          setExchangeBeingEdited(null);
        }}
        onCreated={finishExchangeWrite}
        onUpdated={finishExchangeWrite}
        onSessionExpired={onSessionExpired}
      />

      <UsdWalletPage
        open={isUsdWalletOpen}
        userId={user.id}
        onBack={() => setIsUsdWalletOpen(false)}
        onNewExchange={openNewExchange}
        onExchangeEdit={openExchangeEdit}
        editingExchangeId={exchangeBeingEdited?.id ?? null}
        updatedExchange={lastSavedExchange}
        onTransactionSelect={openTransaction}
        onSessionExpired={onSessionExpired}
      />

      <RecoveryCodeResetPage
        result={recoveryCodeReset}
        onDone={() => setRecoveryCodeReset(null)}
        onSessionExpired={onSessionExpired}
      />

      <TransactionComposer
        userId={user.id}
        open={isTransactionComposerOpen}
        transaction={transactionBeingEdited}
        disablePersistence={lockSectionNavigation}
        onClose={() => setIsTransactionComposerOpen(false)}
        onCreated={finishFinancialWrite}
        onUpdated={finishFinancialWrite}
        onSessionExpired={onSessionExpired}
      />

      <TransactionDetailSheet
        ownerId={user.id}
        transaction={selectedTransaction}
        suspended={
          isTransactionComposerOpen && transactionBeingEdited !== null
        }
        onClose={() => setSelectedTransaction(null)}
        onDeleted={() => {
          setSelectedTransaction(null);
          void invalidateAfterTransactionWrite(user.id);
        }}
        onEdit={(transaction) => {
          setTransactionBeingEdited(transaction);
          setIsTransactionComposerOpen(true);
        }}
        onSessionExpired={onSessionExpired}
      />
    </main>
  );
}
