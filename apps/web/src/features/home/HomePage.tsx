import { type ReactNode, useState } from "react";

import { HomeFooterNav } from "./HomeFooterNav";
import type { HomeSectionId } from "./home-sections";

type HomePageProps = {
  onLogout: () => void;
};

type HomeSectionProps = {
  onLogout: () => void;
};

const homeSections: Record<HomeSectionId, (props: HomeSectionProps) => ReactNode> = {
  home: () => <HomeSection title="Home" />,
  moves: () => <HomeSection title="Moves" />,
  stats: () => <HomeSection title="Stats" />,
  profile: ({ onLogout }) => (
    <HomeSection title="Profile">
      <button className="home-logout-button" type="button" onClick={onLogout}>
        Log out
      </button>
    </HomeSection>
  )
};

export function HomePage({ onLogout }: HomePageProps) {
  const [activeSection, setActiveSection] = useState<HomeSectionId>("home");
  const ActiveSection = homeSections[activeSection];

  return (
    <main className="home-screen">
      {ActiveSection({ onLogout })}

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
