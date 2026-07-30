import { type ReactNode, useEffect, useState } from "react";

import {
  invalidateAfterStartingNetWorthWrite,
  invalidateAfterTransactionWrite
} from "../../cache/financial-cache";
import { prefetchScheduler } from "../../cache/prefetch-scheduler";
import type { SessionUser } from "../auth/auth-api";
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
import type { HomeSectionId } from "./home-sections";
import { ProfilePage } from "./ProfilePage";

export type GoogleAccountDeletionFeedback = "mismatch" | "failed" | "cancelled";

type HomePageProps = {
  user: SessionUser;
  onProfileUpdated: (user: SessionUser) => void;
  onLogout: () => Promise<void>;
  onAccountDeleted: () => void;
  onSessionExpired: () => void;
  onInitialContentReady: () => void;
  googleAccountDeletionFeedback: GoogleAccountDeletionFeedback | null;
  onGoogleAccountDeletionFeedbackHandled: () => void;
};

type HomeSectionProps = {
  user: SessionUser;
  onProfileUpdated: (user: SessionUser) => void;
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
    onLogout,
    onAccountDeleted,
    googleAccountDeletionFeedback,
    onGoogleAccountDeletionFeedbackHandled
  }) => (
    <ProfilePage
      user={user}
      onProfileUpdated={onProfileUpdated}
      onLogout={onLogout}
      onAccountDeleted={onAccountDeleted}
      googleAccountDeletionFeedback={googleAccountDeletionFeedback}
      onGoogleAccountDeletionFeedbackHandled={
        onGoogleAccountDeletionFeedbackHandled
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
  onGoogleAccountDeletionFeedbackHandled
}: HomePageProps) {
  const [activeSection, setActiveSection] = useState<HomeSectionId>(
    googleAccountDeletionFeedback ? "profile" : "home"
  );
  const [isTransactionComposerOpen, setIsTransactionComposerOpen] =
    useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionPreview | null>(null);
  const [transactionBeingEdited, setTransactionBeingEdited] =
    useState<TransactionPreview | null>(null);
  const [movesViewState, setMovesViewState] = useState<MovesPageState>(
    createInitialMovesPageState
  );
  const ActiveSection = homeSections[activeSection];
  const isOverlayOpen =
    isTransactionComposerOpen || selectedTransaction !== null;

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
        className="home-main-layer"
        aria-hidden={isOverlayOpen}
        inert={isOverlayOpen}
      >
        {ActiveSection({
          user,
          onProfileUpdated: finishProfileUpdate,
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
          onGoogleAccountDeletionFeedbackHandled
        })}

        <HomeFooterNav
          activeSection={activeSection}
          onSectionChange={changeSection}
        />
      </div>

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
