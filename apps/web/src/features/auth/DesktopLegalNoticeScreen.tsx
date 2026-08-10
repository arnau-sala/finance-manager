import { useEffect } from "react";
import { X } from "lucide-react";

import { ActionButton } from "../../components/ui/ActionButton";
import {
  legalNoticeSummaryItems,
  legalNoticeUpdatedOn,
  privacySections,
  termsSections,
  type LegalNoticeSection
} from "./legal-notice-content";

type DesktopLegalNoticeScreenProps = {
  onClose: () => void;
};

function LegalSection({ section }: { section: LegalNoticeSection }) {
  return (
    <section className="desktop-legal-section">
      <h2>{section.title}</h2>
      <ul>
        {section.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function DesktopLegalNoticeScreen({
  onClose
}: DesktopLegalNoticeScreenProps) {
  useEffect(() => {
    document.documentElement.classList.add("desktop-legal-route");
    window.scrollTo(0, 0);

    return () => {
      document.documentElement.classList.remove("desktop-legal-route");
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <aside
      className="desktop-legal-screen"
      aria-labelledby="desktop-legal-title"
    >
      <div className="desktop-legal-chrome">
        <header className="desktop-legal-header">
          <div>
            <p className="desktop-legal-kicker">Finance Manager</p>
            <h1 id="desktop-legal-title">Privacy & Terms</h1>
            <p className="desktop-legal-updated">{legalNoticeUpdatedOn}</p>
          </div>

          <ActionButton
            shape="icon"
            className="desktop-legal-close"
            type="button"
            aria-label="Close privacy and terms"
            onClick={onClose}
          >
            <X aria-hidden="true" strokeWidth={1.8} />
          </ActionButton>
        </header>

        <div className="desktop-legal-body">
          <section className="desktop-legal-intro">
            <h2>Plain English summary</h2>
            <ul>
              {legalNoticeSummaryItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="desktop-legal-document">
            <h2>Privacy Policy</h2>
            {privacySections.map((section) => (
              <LegalSection key={section.title} section={section} />
            ))}
          </section>

          <section className="desktop-legal-document">
            <h2>Terms of Use</h2>
            {termsSections.map((section) => (
              <LegalSection key={section.title} section={section} />
            ))}
          </section>
        </div>
      </div>
    </aside>
  );
}
