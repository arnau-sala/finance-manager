import type { ElementType } from "react";
import { useState } from "react";
import { Briefcase, Calendar, Home, Settings, Shield } from "lucide-react";

type FooterNavItem = {
  label: string;
  icon: ElementType<{ className?: string }>;
};

const footerItems: FooterNavItem[] = [
  { label: "home", icon: Home },
  { label: "strategy", icon: Briefcase },
  { label: "period", icon: Calendar },
  { label: "security", icon: Shield },
  { label: "settings", icon: Settings }
];

export function HomeFooterNav() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <nav className="home-footer-nav" aria-label="Primary navigation">
      {footerItems.map((item, index) => {
        const Icon = item.icon;
        const isActive = index === activeIndex;

        return (
          <button
            key={item.label}
            className={`home-footer-nav__item${isActive ? " is-active" : ""}`}
            type="button"
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            onClick={() => setActiveIndex(index)}
          >
            <span className="home-footer-nav__icon" aria-hidden="true">
              <Icon className="home-footer-nav__icon-svg" />
            </span>
            <span className="home-footer-nav__label">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
