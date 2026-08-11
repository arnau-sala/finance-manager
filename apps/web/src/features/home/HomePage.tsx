import { type ReactNode, useEffect, useState } from "react";

import {
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
  type MovesPageState
} from "../transactions/MovesPage";
import {
  createEmptyMovesFilters,
  type MovesFilters
} from "../transactions/moves-filters";
import { TransactionComposer } from "../transactions/TransactionComposer";
import { TransactionDetailSheet } from "../transactions/TransactionDetailSheet";
import type { TransactionPreview } from "../transactions/transaction-api";
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
  onLinkEmail: () => void;
  onLinkUsername: () => void;
  onRecoveryCodeReset: (result: RecoveryCodeResetResult) => void;
  onLogout: () => Promise<void>;
  onAccountDeleted: () => void;
  onSessionExpired: () => void;
  onInitialContentReady: () => void;
  onNewTransaction: () => void;
  onNavigateToMoves: (filters?: MovesFilters) => void;
  onTransactionSelect: (transaction: TransactionPreview) => void;
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
    onNewTransaction,
    onNavigateToMoves,
    onTransactionSelect
  }) => (
    <HomeOverviewPage
      user={user}
      onSessionExpired={onSessionExpired}
      onInitialContentReady={onInitialContentReady}
      onNewTransaction={onNewTransaction}
      onNavigateToMoves={onNavigateToMoves}
      onTransactionSelect={onTransactionSelect}
    />
  ),
  moves: ({
    user,
    onSessionExpired,
    onNewTransaction,
    onTransactionSelect,
    movesViewState,
    onMovesViewStateChange
  }) => (
    <MovesPage
      userId={user.id}
      initialState={movesViewState}
      onStateChange={onMovesViewStateChange}
      onNewTransaction={onNewTransaction}
      onTransactionSelect={onTransactionSelect}
      onSessionExpired={onSessionExpired}
    />
  ),
  stats: ({
    user,
    onSessionExpired,
    onNewTransaction,
    onTransactionSelect
  }) => (
    <StatsPage
      userId={user.id}
      onNewTransaction={onNewTransaction}
      onTransactionSelect={onTransactionSelect}
      onSessionExpired={onSessionExpired}
    />
  ),
  profile: ({
    user,
    onProfileUpdated,
    onEditProfile,
    onChangePassword,
    onAppVersion,
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
  }) => (
    <ProfilePage
      user={user}
      onEditProfile={onEditProfile}
      onProfileUpdated={onProfileUpdated}
      onChangePassword={onChangePassword}
      onAppVersion={onAppVersion}
      onLinkEmail={onLinkEmail}
      onLinkUsername={onLinkUsername}
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
      : "home"
  );
  const [isTransactionComposerOpen, setIsTransactionComposerOpen] =
    useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isAppVersionOpen, setIsAppVersionOpen] = useState(false);
  const [isFeatureSuggestionOpen, setIsFeatureSuggestionOpen] =
    useState(false);
  const [isEmailLinkOpen, setIsEmailLinkOpen] = useState(false);
  const [isUsernameLinkOpen, setIsUsernameLinkOpen] = useState(false);
  const [recoveryCodeReset, setRecoveryCodeReset] =
    useState<RecoveryCodeResetResult | null>(null);
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionPreview | null>(null);
  const [transactionBeingEdited, setTransactionBeingEdited] =
    useState<TransactionPreview | null>(null);
  const [movesViewState, setMovesViewState] = useState<MovesPageState>(
    createInitialMovesPageState
  );
  const ActiveSection = homeSections[activeSection];
  const isOverlayOpen =
    isEditProfileOpen ||
    isChangePasswordOpen ||
    isAppVersionOpen ||
    isFeatureSuggestionOpen ||
    isEmailLinkOpen ||
    isUsernameLinkOpen ||
    recoveryCodeReset !== null ||
    isTransactionComposerOpen ||
    selectedTransaction !== null;

  useEffect(() => {
    if (activeSection !== "home") {
      onInitialContentReady();
    }
  }, [activeSection, onInitialContentReady]);

  function openNewTransaction() {
    prefetchScheduler.prioritizeUserRequest();
    setTransactionBeingEdited(null);
    setIsTransactionComposerOpen(true);
  }

  function finishFinancialWrite() {
    setIsTransactionComposerOpen(false);
    void invalidateAfterTransactionWrite(user.id);
  }

  function finishProfileUpdate(updatedUser: SessionUser) {
    if (updatedUser.startingNetWorth !== user.startingNetWorth) {
      void invalidateAfterStartingNetWorthWrite(user.id);
    }

    onProfileUpdated(updatedUser);
  }

  function navigateToMoves(filters = createEmptyMovesFilters()) {
    prefetchScheduler.prioritizeUserRequest();
    setMovesViewState(createInitialMovesPageState(filters));
    setActiveSection("moves");
  }

  function changeSection(section: HomeSectionId) {
    if (section === activeSection) {
      return;
    }

    prefetchScheduler.prioritizeUserRequest();
    setActiveSection(section);
  }

  function openTransaction(transaction: TransactionPreview) {
    prefetchScheduler.prioritizeUserRequest();
    setSelectedTransaction(transaction);
  }

  return (
    <main className="home-screen">
      <div
        className={`home-main-layer${
          isChangePasswordOpen ||
          isEditProfileOpen ||
          isAppVersionOpen ||
          isFeatureSuggestionOpen ||
          isEmailLinkOpen ||
          isUsernameLinkOpen ||
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
            prefetchScheduler.prioritizeUserRequest();
            setIsEditProfileOpen(true);
          },
          onChangePassword: () => {
            prefetchScheduler.prioritizeUserRequest();
            setIsChangePasswordOpen(true);
          },
          onAppVersion: () => {
            prefetchScheduler.prioritizeUserRequest();
            setIsAppVersionOpen(true);
          },
          onLinkEmail: () => {
            prefetchScheduler.prioritizeUserRequest();
            setIsEmailLinkOpen(true);
          },
          onLinkUsername: () => {
            prefetchScheduler.prioritizeUserRequest();
            setIsUsernameLinkOpen(true);
          },
          onRecoveryCodeReset: setRecoveryCodeReset,
          onLogout,
          onAccountDeleted,
          onSessionExpired,
          onInitialContentReady,
          onNewTransaction: openNewTransaction,
          onNavigateToMoves: navigateToMoves,
          onTransactionSelect: openTransaction,
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
          onSectionChange={changeSection}
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
        user={user}
        onBack={() => setIsFeatureSuggestionOpen(false)}
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

      <RecoveryCodeResetPage
        result={recoveryCodeReset}
        onDone={() => setRecoveryCodeReset(null)}
        onSessionExpired={onSessionExpired}
      />

      <TransactionComposer
        open={isTransactionComposerOpen}
        transaction={transactionBeingEdited}
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
