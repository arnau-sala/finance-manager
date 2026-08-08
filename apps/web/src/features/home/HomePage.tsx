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
import { ChangePasswordPage } from "./ChangePasswordPage";
import { EmailLinkFlow } from "./EmailLinkFlow";
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
};

type HomeSectionProps = {
  user: SessionUser;
  onProfileUpdated: (user: SessionUser) => void;
  onChangePassword: () => void;
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
    onGoogleAccountLinkFeedbackHandled
  }) => (
    <ProfilePage
      user={user}
      onProfileUpdated={onProfileUpdated}
      onChangePassword={onChangePassword}
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
  onGoogleAccountLinkFeedbackHandled
}: HomePageProps) {
  const [activeSection, setActiveSection] = useState<HomeSectionId>(
    googleAccountDeletionFeedback || googleAccountLinkFeedback
      ? "profile"
      : "home"
  );
  const [isTransactionComposerOpen, setIsTransactionComposerOpen] =
    useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
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
    isChangePasswordOpen ||
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
          onChangePassword: () => {
            prefetchScheduler.prioritizeUserRequest();
            setIsChangePasswordOpen(true);
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
          onGoogleAccountLinkFeedbackHandled
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
