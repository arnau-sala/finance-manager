import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { Share, Smartphone, SquarePlus } from "lucide-react";

import { ActionButton } from "../components/ui/ActionButton";
import { LegalNoticeScreen } from "../features/auth/LegalNoticeScreen";

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

type StandaloneGateProps = {
  children: ReactNode;
};

const standaloneMediaQueries = [
  "(display-mode: standalone)",
  "(display-mode: fullscreen)",
  "(display-mode: minimal-ui)",
  "(display-mode: window-controls-overlay)"
];

function getIsStandaloneApp() {
  const navigatorWithStandalone = window.navigator as NavigatorWithStandalone;

  return (
    navigatorWithStandalone.standalone === true ||
    standaloneMediaQueries.some((query) => window.matchMedia(query).matches) ||
    document.referrer.startsWith("android-app://")
  );
}

function getIsAppleBrowser() {
  const platform = window.navigator.platform.toLowerCase();
  const userAgent = window.navigator.userAgent.toLowerCase();
  const hasTouchScreen = window.navigator.maxTouchPoints > 1;

  return (
    /iphone|ipad|ipod/.test(userAgent) ||
    /iphone|ipad|ipod/.test(platform) ||
    (platform === "macintel" && hasTouchScreen)
  );
}

export function StandaloneGate({ children }: StandaloneGateProps) {
  const [isStandalone, setIsStandalone] = useState(getIsStandaloneApp);
  const [isAppleBrowser, setIsAppleBrowser] = useState(getIsAppleBrowser);
  const [isLegalScreenOpen, setIsLegalScreenOpen] = useState(false);
  const [isLegalScreenClosing, setIsLegalScreenClosing] = useState(false);

  useLayoutEffect(() => {
    if (isStandalone) {
      return;
    }

    document.getElementById("app-startup-splash")?.remove();
  }, [isStandalone]);

  useEffect(() => {
    const mediaQueryLists = standaloneMediaQueries.map((query) =>
      window.matchMedia(query)
    );

    function updateStandaloneMode() {
      setIsStandalone(getIsStandaloneApp());
      setIsAppleBrowser(getIsAppleBrowser());
    }

    mediaQueryLists.forEach((mediaQueryList) => {
      mediaQueryList.addEventListener("change", updateStandaloneMode);
    });

    window.addEventListener("focus", updateStandaloneMode);
    window.addEventListener("pageshow", updateStandaloneMode);

    return () => {
      mediaQueryLists.forEach((mediaQueryList) => {
        mediaQueryList.removeEventListener("change", updateStandaloneMode);
      });

      window.removeEventListener("focus", updateStandaloneMode);
      window.removeEventListener("pageshow", updateStandaloneMode);
    };
  }, []);

  if (!isStandalone) {
    if (!isAppleBrowser) {
      return (
        <main className="browser-placeholder-screen" aria-label="Browser mode">
          <p>Navigator Page</p>
        </main>
      );
    }

    return (
      <>
        <main className="browser-install-screen" aria-labelledby="browser-install-title">
          <section className="browser-install-panel">
            <header className="browser-install-hero">
              <div className="browser-install-icon" aria-hidden="true">
                <img
                  src="/icons/app-icon-512.png"
                  width={512}
                  height={512}
                  alt=""
                  decoding="sync"
                />
              </div>
              <div className="browser-install-copy">
                <p className="browser-install-kicker">Finance Manager</p>
                <h1 id="browser-install-title">Add it to your Home Screen</h1>
                <p>Use it from your Home Screen like a mobile app</p>
              </div>
            </header>

            <div className="browser-install-reason">
              <Smartphone aria-hidden="true" strokeWidth={1.8} />
              <span>Home Screen access, no browser bar, smoother mobile flow</span>
            </div>

            <ol className="browser-install-steps" aria-label="Install steps">
              <li>
                <span className="browser-install-step__number">1</span>
                <span className="browser-install-step__icon" aria-hidden="true">
                  <Share strokeWidth={1.9} />
                </span>
                <span className="browser-install-step__content">
                  <strong>Tap Share</strong>
                  <span>Use the Safari button at the bottom</span>
                </span>
              </li>
              <li>
                <span className="browser-install-step__number">2</span>
                <span className="browser-install-step__icon" aria-hidden="true">
                  <SquarePlus strokeWidth={1.9} />
                </span>
                <span className="browser-install-step__content">
                  <strong>Add to Home Screen</strong>
                  <span>Choose it from the share menu</span>
                </span>
              </li>
              <li>
                <span className="browser-install-step__number">3</span>
                <span
                  className="browser-install-step__icon browser-install-step__icon--app"
                  aria-hidden="true"
                >
                  <img
                    src="/icons/app-icon-512.png"
                    width={512}
                    height={512}
                    alt=""
                    decoding="sync"
                  />
                </span>
                <span className="browser-install-step__content">
                  <strong>Open Finance Manager</strong>
                  <span>Use the new Home Screen icon</span>
                </span>
              </li>
            </ol>

            <ActionButton
              className="browser-install-legal"
              type="button"
              onClick={() => {
                setIsLegalScreenClosing(false);
                setIsLegalScreenOpen(true);
              }}
            >
              Privacy & Terms
            </ActionButton>
          </section>
        </main>

        {isLegalScreenOpen ? (
          <LegalNoticeScreen
            closing={isLegalScreenClosing}
            onClose={() => setIsLegalScreenClosing(true)}
            onClosed={() => {
              setIsLegalScreenOpen(false);
              setIsLegalScreenClosing(false);
            }}
          />
        ) : null}
      </>
    );
  }

  return <>{children}</>;
}
