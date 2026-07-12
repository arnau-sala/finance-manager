import { type ReactNode, useState } from "react";

import type { SessionUser } from "../auth/auth-api";
import { HomeFooterNav } from "./HomeFooterNav";
import type { HomeSectionId } from "./home-sections";
import { ProfilePage } from "./ProfilePage";

type HomePageProps = {
  user: SessionUser;
};

type HomeSectionProps = {
  user: SessionUser;
};

const homeSections: Record<HomeSectionId, (props: HomeSectionProps) => ReactNode> = {
  home: () => <HomeSection title="Home" />,
  moves: () => <HomeSection title="Moves" />,
  stats: () => <HomeSection title="Stats" />,
  profile: ({ user }) => <ProfilePage user={user} />
};

export function HomePage({ user }: HomePageProps) {
  const [activeSection, setActiveSection] = useState<HomeSectionId>("home");
  const ActiveSection = homeSections[activeSection];

  return (
    <main className="home-screen">
      {ActiveSection({ user })}

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
