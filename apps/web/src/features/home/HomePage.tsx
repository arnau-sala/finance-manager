import { type ReactNode, useState } from "react";

import type { SessionUser } from "../auth/auth-api";
import { clearStatisticsCache } from "../statistics/statistics-api";
import { StatsPage } from "../statistics/StatsPage";
import { MovesPage } from "../transactions/MovesPage";
import { NewTransactionComposer } from "../transactions/NewTransactionComposer";
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
    financialRefreshKey
  }) => (
    <HomeOverviewPage
      user={user}
      onSessionExpired={onSessionExpired}
      onNewTransaction={onNewTransaction}
      onSeeAllMoves={onNavigateToMoves}
      refreshKey={financialRefreshKey}
    />
  ),
  moves: ({ onSessionExpired }) => (
    <MovesPage onSessionExpired={onSessionExpired} />
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
  const [financialRefreshKey, setFinancialRefreshKey] = useState(0);
  const ActiveSection = homeSections[activeSection];

  return (
    <main className="home-screen">
      <div
        className="home-main-layer"
        aria-hidden={isTransactionComposerOpen}
        inert={isTransactionComposerOpen}
      >
        {ActiveSection({
          user,
          onProfileUpdated,
          onLogout,
          onAccountDeleted,
          onSessionExpired,
          onNewTransaction: () => setIsTransactionComposerOpen(true),
          onNavigateToMoves: () => setActiveSection("moves"),
          financialRefreshKey,
          googleAccountDeletionFeedback,
          onGoogleAccountDeletionFeedbackHandled
        })}

        <HomeFooterNav
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
      </div>

      <NewTransactionComposer
        open={isTransactionComposerOpen}
        onClose={() => setIsTransactionComposerOpen(false)}
        onCreated={() => {
          clearStatisticsCache();
          setIsTransactionComposerOpen(false);
          setFinancialRefreshKey((current) => current + 1);
        }}
        onSessionExpired={onSessionExpired}
      />
    </main>
  );
}
