import { homeNavItems, type HomeSectionId } from "./home-sections";

type HomeFooterNavProps = {
  activeSection: HomeSectionId;
  onSectionSelect: (section: HomeSectionId) => void;
};

export function HomeFooterNav({
  activeSection,
  onSectionSelect
}: HomeFooterNavProps) {
  return (
    <>
      <div className="home-footer-nav__hit-shield" aria-hidden="true" />

      <nav className="home-footer-nav" aria-label="Primary navigation">
        {homeNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeSection;

          return (
            <button
              key={item.id}
              className={`home-footer-nav__item${isActive ? " is-active" : ""}`}
              type="button"
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSectionSelect(item.id)}
            >
              <span className="home-footer-nav__icon" aria-hidden="true">
                <Icon className="home-footer-nav__icon-svg" />
              </span>
              <span className="home-footer-nav__label">
                <span className="home-footer-nav__label-text">
                  {item.label}
                </span>
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
