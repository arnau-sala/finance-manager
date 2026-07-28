import { type ReactNode, useState } from "react";

import type { SessionUser } from "../auth/auth-api";
import { clearStatisticsCache } from "../statistics/statistics-api";
import { StatsPage } from "../statistics/StatsPage";
import { MovesPage } from "../transactions/MovesPage";
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
  googleAccountDeletionFeedback: GoogleAccountDeletionFeedback | null;
  onGoogleAccountDeletionFeedbackHandled: () => void;
};

type HomeSectionProps = {
  user: SessionUser;
  onProfileUpdated: (user: SessionUser) => void;
  onLogout: () => Promise<void>;
  onAccountDeleted: () => void;
  onSessionExpired: () => void;
  onNewTransaction: () => void;
  onNavigateToMoves: () => void;
  onTransactionSelect: (transaction: TransactionPreview) => void;
  financialRefreshKey: number;
  googleAccountDeletionFeedback: GoogleAccountDeletionFeedback | null;
  onGoogleAccountDeletionFeedbackHandled: () => void;
};

const homeSections: Record<HomeSectionId, (props: HomeSectionProps) => ReactNode> = {
  home: ({
    user,
    onSessionExpired,
    onNewTransaction,
    onNavigateToMoves,
    onTransactionSelect,
    financialRefreshKey
  }) => (
    <HomeOverviewPage
      user={user}
      onSessionExpired={onSessionExpired}
      onNewTransaction={onNewTransaction}
      onSeeAllMoves={onNavigateToMoves}
      onTransactionSelect={onTransactionSelect}
      refreshKey={financialRefreshKey}
    />
  ),
  moves: ({
    user,
    onSessionExpired,
    onNewTransaction,
    onTransactionSelect,
    financialRefreshKey
  }) => (
    <MovesPage
      userId={user.id}
      refreshKey={financialRefreshKey}
      onNewTransaction={onNewTransaction}
      onTransactionSelect={onTransactionSelect}
      onSessionExpired={onSessionExpired}
    />
  ),
  stats: ({
    user,
    onSessionExpired,
    onNewTransaction,
    financialRefreshKey
  }) => (
    <StatsPage
      userId={user.id}
      refreshKey={financialRefreshKey}
      onNewTransaction={onNewTransaction}
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
  const [financialRefreshKey, setFinancialRefreshKey] = useState(0);
  const [transactionDetailRefreshKey, setTransactionDetailRefreshKey] =
    useState(0);
  const ActiveSection = homeSections[activeSection];
  const isOverlayOpen =
    isTransactionComposerOpen || selectedTransaction !== null;

  function openNewTransaction() {
    setTransactionBeingEdited(null);
    setIsTransactionComposerOpen(true);
  }

  function finishFinancialWrite() {
    clearStatisticsCache();
    setIsTransactionComposerOpen(false);
    setFinancialRefreshKey((current) => current + 1);
  }

  function finishProfileUpdate(updatedUser: SessionUser) {
    if (updatedUser.startingNetWorth !== user.startingNetWorth) {
      clearStatisticsCache();
      setFinancialRefreshKey((current) => current + 1);
    }

    onProfileUpdated(updatedUser);
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
          onNewTransaction: openNewTransaction,
          onNavigateToMoves: () => setActiveSection("moves"),
          onTransactionSelect: setSelectedTransaction,
          financialRefreshKey,
          googleAccountDeletionFeedback,
          onGoogleAccountDeletionFeedbackHandled
        })}

        <HomeFooterNav
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
      </div>

      <TransactionComposer
        open={isTransactionComposerOpen}
        transaction={transactionBeingEdited}
        onClose={() => setIsTransactionComposerOpen(false)}
        onCreated={finishFinancialWrite}
        onUpdated={() => {
          finishFinancialWrite();
          setTransactionDetailRefreshKey((current) => current + 1);
        }}
        onSessionExpired={onSessionExpired}
      />

      <TransactionDetailSheet
        ownerId={user.id}
        transaction={selectedTransaction}
        refreshKey={transactionDetailRefreshKey}
        suspended={
          isTransactionComposerOpen && transactionBeingEdited !== null
        }
        onClose={() => setSelectedTransaction(null)}
        onDeleted={() => {
          clearStatisticsCache();
          setSelectedTransaction(null);
          setFinancialRefreshKey((current) => current + 1);
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
