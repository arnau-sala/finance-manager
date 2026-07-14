import { type ReactNode, useState } from "react";

import type { SessionUser } from "../auth/auth-api";
import { HomeFooterNav } from "./HomeFooterNav";
import type { HomeSectionId } from "./home-sections";
import { ProfilePage } from "./ProfilePage";

type HomePageProps = {
  user: SessionUser;
  onLogout: () => Promise<void>;
  onAccountDeleted: () => void;
};

type HomeSectionProps = {
  user: SessionUser;
  onLogout: () => Promise<void>;
  onAccountDeleted: () => void;
};

const homeSections: Record<HomeSectionId, (props: HomeSectionProps) => ReactNode> = {
  home: () => <HomeSection title="Home" />,
  moves: () => <HomeSection title="Moves" />,
  stats: () => <HomeSection title="Stats" />,
  profile: ({ user, onLogout, onAccountDeleted }) => (
    <ProfilePage
      user={user}
      onLogout={onLogout}
      onAccountDeleted={onAccountDeleted}
    />
  )
};

export function HomePage({ user, onLogout, onAccountDeleted }: HomePageProps) {
  const [activeSection, setActiveSection] = useState<HomeSectionId>("home");
  const ActiveSection = homeSections[activeSection];

  return (
    <main className="home-screen">
      {ActiveSection({ user, onLogout, onAccountDeleted })}

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
