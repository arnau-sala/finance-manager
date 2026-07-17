import { type ReactNode, useState } from "react";

import type { SessionUser } from "../auth/auth-api";
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
  googleAccountDeletionFeedback: GoogleAccountDeletionFeedback | null;
  onGoogleAccountDeletionFeedbackHandled: () => void;
};

type HomeSectionProps = {
  user: SessionUser;
  onProfileUpdated: (user: SessionUser) => void;
  onLogout: () => Promise<void>;
  onAccountDeleted: () => void;
  googleAccountDeletionFeedback: GoogleAccountDeletionFeedback | null;
  onGoogleAccountDeletionFeedbackHandled: () => void;
};

const homeSections: Record<HomeSectionId, (props: HomeSectionProps) => ReactNode> = {
  home: ({ user }) => <HomeOverviewPage user={user} />,
  moves: () => <HomeSection title="Moves" />,
  stats: () => <HomeSection title="Stats" />,
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
  googleAccountDeletionFeedback,
  onGoogleAccountDeletionFeedbackHandled
}: HomePageProps) {
  const [activeSection, setActiveSection] = useState<HomeSectionId>(
    googleAccountDeletionFeedback ? "profile" : "home"
  );
  const ActiveSection = homeSections[activeSection];

  return (
    <main className="home-screen">
      {ActiveSection({
        user,
        onProfileUpdated,
        onLogout,
        onAccountDeleted,
        googleAccountDeletionFeedback,
        onGoogleAccountDeletionFeedbackHandled
      })}

      <HomeFooterNav
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />
    </main>
  );
}

type HomeSectionComponentProps = {
  title: string;
  children?: ReactNode;
};

function HomeSection({ title, children }: HomeSectionComponentProps) {
  const titleId = `home-section-${title.toLowerCase()}`;

  return (
    <section className="home-content" aria-labelledby={titleId}>
      <h1 id={titleId}>{title}</h1>
      {children}
    </section>
  );
}
