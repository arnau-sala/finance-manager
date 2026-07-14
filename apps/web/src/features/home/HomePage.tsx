import { type ReactNode, useState } from "react";

import type { SessionUser } from "../auth/auth-api";
import { HomeFooterNav } from "./HomeFooterNav";
import type { HomeSectionId } from "./home-sections";
import { ProfilePage } from "./ProfilePage";

export type GoogleAccountDeletionFeedback = "mismatch" | "failed" | "cancelled";

type HomePageProps = {
  user: SessionUser;
  onLogout: () => Promise<void>;
  onAccountDeleted: () => void;
  googleAccountDeletionFeedback: GoogleAccountDeletionFeedback | null;
  onGoogleAccountDeletionFeedbackHandled: () => void;
};

type HomeSectionProps = {
  user: SessionUser;
  onLogout: () => Promise<void>;
  onAccountDeleted: () => void;
  googleAccountDeletionFeedback: GoogleAccountDeletionFeedback | null;
  onGoogleAccountDeletionFeedbackHandled: () => void;
};

const homeSections: Record<HomeSectionId, (props: HomeSectionProps) => ReactNode> = {
  home: () => <HomeSection title="Home" />,
  moves: () => <HomeSection title="Moves" />,
  stats: () => <HomeSection title="Stats" />,
  profile: ({
    user,
    onLogout,
    onAccountDeleted,
    googleAccountDeletionFeedback,
    onGoogleAccountDeletionFeedbackHandled
  }) => (
    <ProfilePage
      user={user}
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
