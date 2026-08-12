import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChartColumn,
  LockKeyhole,
  MoreVertical,
  Share,
  Smartphone,
  SquarePlus,
  WalletCards
} from "lucide-react";
import { createPortal } from "react-dom";

import { ActionButton } from "../components/ui/ActionButton";
import { LandingFloatingActionButton } from "../components/ui/floating-action-button";
import { DesktopLegalNoticeScreen } from "../features/auth/DesktopLegalNoticeScreen";
import {
  DESKTOP_LEGAL_PATH,
  isDesktopLegalPath,
  normalizeAppPath
} from "../features/auth/desktop-legal-path";
import { LegalNoticeScreen } from "../features/auth/LegalNoticeScreen";

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

type StandaloneGateProps = {
  children: ReactNode;
};

type BrowserInstallPlatform = "apple" | "android";

const DESKTOP_APP_PATH = "/app";

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

function getIsAndroidBrowser() {
  return window.navigator.userAgent.toLowerCase().includes("android");
}

function isDesktopAppPath(pathname = window.location.pathname) {
  return normalizeAppPath(pathname) === DESKTOP_APP_PATH;
}

function DesktopAppBackLink() {
  return createPortal(
    <a className="desktop-app-back-link" href="/">
      <ArrowLeft aria-hidden="true" />
      <span>Back to landing</span>
    </a>,
    document.body
  );
}

function AndroidIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`${className ?? ""} browser-install-platform__icon--android`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M17.6 9.7H6.4v7.9c0 .7.5 1.2 1.2 1.2h.8v2.3c0 .5.4.9.9.9s.9-.4.9-.9v-2.3h3.6v2.3c0 .5.4.9.9.9s.9-.4.9-.9v-2.3h.8c.7 0 1.2-.5 1.2-1.2V9.7ZM4.4 9.8c-.5 0-.9.4-.9.9v5.2c0 .5.4.9.9.9s.9-.4.9-.9v-5.2c0-.5-.4-.9-.9-.9Zm15.2 0c-.5 0-.9.4-.9.9v5.2c0 .5.4.9.9.9s.9-.4.9-.9v-5.2c0-.5-.4-.9-.9-.9ZM8.1 4.3 6.8 2.1a.4.4 0 0 0-.7.4l1.3 2.2A5.4 5.4 0 0 0 6.4 8h11.2a5.4 5.4 0 0 0-1-3.3l1.3-2.2a.4.4 0 0 0-.7-.4l-1.3 2.2A5.5 5.5 0 0 0 12 2.8a5.5 5.5 0 0 0-3.9 1.5Zm1.2 1.9a.7.7 0 1 1 0 1.4.7.7 0 0 1 0-1.4Zm5.4 0a.7.7 0 1 1 0 1.4.7.7 0 0 1 0-1.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`${className ?? ""} browser-install-platform__icon--apple`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M16.7 12.8c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8-.7 0-1.7-.8-2.8-.7-1.4 0-2.7.8-3.4 2.1-1.5 2.6-.4 6.4 1.1 8.5.7 1 1.5 2.2 2.6 2.1 1.1 0 1.5-.7 2.8-.7 1.3 0 1.7.7 2.8.7 1.2 0 1.9-1 2.6-2.1.8-1.2 1.1-2.3 1.1-2.4 0-.1-2.4-1-2.5-3.4ZM14.6 6.5c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.6.7-1 1.6-.9 2.6.9.1 1.9-.5 2.5-1.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

const installContent = {
  apple: {
    platformName: "Apple",
    PlatformIcon: AppleIcon,
    infoTitle: "Apple guide",
    infoText: "These steps show how to add Finance Manager from Safari",
    switchLabel: "Switch to Android",
    steps: [
      {
        title: "Tap Share",
        detail: "Use the Safari button at the bottom",
        icon: <Share strokeWidth={1.9} />
      },
      {
        title: "Add to Home Screen",
        detail: "Choose it from the share menu",
        icon: <SquarePlus strokeWidth={1.9} />
      },
      {
        title: "Open Finance Manager",
        detail: "Use the new Home Screen icon",
        icon: null
      }
    ]
  },
  android: {
    platformName: "Android",
    PlatformIcon: AndroidIcon,
    infoTitle: "Android guide",
    infoText:
      "These steps work across Chrome, Edge, Firefox and Samsung Internet",
    switchLabel: "Switch to Apple",
    steps: [
      {
        title: "Open browser menu",
        detail: "Tap the three dots in your browser",
        icon: <MoreVertical strokeWidth={1.9} />
      },
      {
        title: "Add to Home Screen",
        detail: "Choose Install app or Add to Home screen",
        icon: <SquarePlus strokeWidth={1.9} />
      },
      {
        title: "Open Finance Manager",
        detail: "Use the new Home Screen icon",
        icon: null
      }
    ]
  }
} satisfies Record<
  BrowserInstallPlatform,
  {
    platformName: string;
    PlatformIcon: ({ className }: { className?: string }) => ReactNode;
    infoTitle: string;
    infoText: string;
    switchLabel: string;
    steps: { title: string; detail: string; icon: ReactNode }[];
  }
>;

export function StandaloneGate({ children }: StandaloneGateProps) {
  const [isStandalone, setIsStandalone] = useState(getIsStandaloneApp);
  const [isAppleBrowser, setIsAppleBrowser] = useState(getIsAppleBrowser);
  const [isAndroidBrowser, setIsAndroidBrowser] = useState(
    getIsAndroidBrowser
  );
  const isDesktopAppAccess =
    !isStandalone && !isAppleBrowser && !isAndroidBrowser && isDesktopAppPath();

  useLayoutEffect(() => {
    if (isStandalone || isDesktopAppAccess) {
      return;
    }

    document.getElementById("app-startup-splash")?.remove();
  }, [isDesktopAppAccess, isStandalone]);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle(
      "desktop-app-route",
      isDesktopAppAccess
    );

    return () => {
      document.documentElement.classList.remove("desktop-app-route");
    };
  }, [isDesktopAppAccess]);

  useEffect(() => {
    const mediaQueryLists = standaloneMediaQueries.map((query) =>
      window.matchMedia(query)
    );

    function updateStandaloneMode() {
      setIsStandalone(getIsStandaloneApp());
      setIsAppleBrowser(getIsAppleBrowser());
      setIsAndroidBrowser(getIsAndroidBrowser());
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
    if (isDesktopAppAccess) {
      return (
        <>
          {children}
          <DesktopAppBackLink />
        </>
      );
    }

    if (isAppleBrowser) {
      return <BrowserInstallScreen initialPlatform="apple" />;
    }

    if (isAndroidBrowser) {
      return <BrowserInstallScreen initialPlatform="android" />;
    }

    return <DesktopBrowserLandingScreen />;
  }

  return <>{children}</>;
}

export function AppleBrowserInstallScreen() {
  return <BrowserInstallScreen initialPlatform="apple" />;
}

export function AndroidBrowserInstallScreen() {
  return <BrowserInstallScreen initialPlatform="android" />;
}

export function DesktopBrowserLandingScreen() {
  const [guidePlatform, setGuidePlatform] =
    useState<BrowserInstallPlatform>("apple");
  const [pathname, setPathname] = useState(() =>
    normalizeAppPath(window.location.pathname)
  );
  const openedLegalViaPushRef = useRef(false);
  const guideContent = installContent[guidePlatform];
  const GuidePlatformIcon = guideContent.PlatformIcon;
  const showLegalScreen = isDesktopLegalPath(pathname);

  useEffect(() => {
    function syncPathname() {
      setPathname(normalizeAppPath(window.location.pathname));
      openedLegalViaPushRef.current = false;
    }

    window.addEventListener("popstate", syncPathname);
    return () => {
      window.removeEventListener("popstate", syncPathname);
    };
  }, []);

  function openLegalScreen(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (showLegalScreen) {
      return;
    }

    openedLegalViaPushRef.current = true;
    window.history.pushState({}, "", DESKTOP_LEGAL_PATH);
    setPathname(DESKTOP_LEGAL_PATH);
  }

  function closeLegalScreen() {
    if (openedLegalViaPushRef.current) {
      openedLegalViaPushRef.current = false;
      window.history.back();
      return;
    }

    window.history.replaceState({}, "", "/");
    setPathname("/");
  }

  const featureCards = [
    {
      title: "Track daily moves",
      text: "Add income and expenses with categories, dates and details",
      icon: WalletCards
    },
    {
      title: "Understand your money",
      text: "See net worth, balance, savings, categories and period insights",
      icon: ChartColumn
    },
    {
      title: "Stay in control",
      text: "Use email, Google or username accounts with recovery options",
      icon: LockKeyhole
    }
  ];

  if (showLegalScreen) {
    return <DesktopLegalNoticeScreen onClose={closeLegalScreen} />;
  }

  return (
    <main
      className="desktop-landing-screen"
      aria-labelledby="desktop-landing-title"
    >
      <header className="desktop-landing-nav" aria-label="Finance Manager">
        <span className="desktop-landing-brand">
          <img draggable={false}
            src="/icons/app-icon-512.png"
            width={512}
            height={512}
            alt=""
            decoding="sync"
          />
          <span>Finance Manager</span>
        </span>
      </header>

        <section className="desktop-landing-shell">
          <section className="desktop-landing-hero">
            <div className="desktop-landing-copy">
              <p className="desktop-landing-kicker">Mobile-first finance app</p>
              <h1 id="desktop-landing-title">Money, made clear.</h1>
              <p>
                Track your personal finances from a mobile PWA built for quick
                daily use and clean statistics
              </p>
              <div className="desktop-landing-actions">
                <div className="desktop-landing-action-row">
                  <button
                    className="desktop-landing-primary"
                    type="button"
                    onClick={() => {
                      document
                        .getElementById("desktop-install")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start"
                        });
                    }}
                  >
                    <span>Use it on your phone</span>
                    <ArrowRight aria-hidden="true" />
                  </button>
                  <span className="desktop-landing-note">
                    Open this website on mobile and add it to your Home Screen
                  </span>
                </div>
                <div className="desktop-landing-action-row">
                  <button
                    className="desktop-landing-secondary"
                    type="button"
                    onClick={() => {
                      window.location.assign(DESKTOP_APP_PATH);
                    }}
                  >
                    <span>Launch on this device</span>
                    <ArrowRight aria-hidden="true" />
                  </button>
                  <span className="desktop-landing-note">
                    You can use it here, but the interface is designed for
                    mobile
                  </span>
                </div>
              </div>
            </div>

            <div className="desktop-landing-preview" aria-hidden="true">
              <div className="desktop-landing-phone-frame">
                <span className="desktop-landing-phone-frame__island" />
                <img draggable={false}
                  className="desktop-landing-preview__image"
                  src="/landing/home-mockup.png"
                  width={390}
                  height={844}
                  alt=""
                  decoding="async"
                />
              </div>
            </div>
          </section>

          <section className="desktop-landing-features" aria-label="App summary">
            {featureCards.map((feature) => {
              const FeatureIcon = feature.icon;

              return (
                <article key={feature.title} className="desktop-landing-card">
                  <span className="desktop-landing-card__icon" aria-hidden="true">
                    <FeatureIcon strokeWidth={1.8} />
                  </span>
                  <div>
                    <h2>{feature.title}</h2>
                    <p>{feature.text}</p>
                  </div>
                </article>
              );
            })}
          </section>

          <section
            id="desktop-install"
            className="desktop-landing-install"
            aria-labelledby="desktop-install-title"
          >
            <div className="desktop-landing-guide">
              <div
                className="desktop-landing-platform-switch"
                aria-label="Choose mobile platform"
              >
                {(["apple", "android"] as const).map((platform) => {
                  const option = installContent[platform];
                  const OptionIcon = option.PlatformIcon;
                  const isSelected = guidePlatform === platform;

                  return (
                    <ActionButton
                      key={platform}
                      type="button"
                      className={`desktop-landing-platform-switch__button${
                        isSelected
                          ? " desktop-landing-platform-switch__button--selected"
                          : ""
                      }`}
                      onClick={() => setGuidePlatform(platform)}
                    >
                      <OptionIcon />
                      <span>{option.platformName}</span>
                    </ActionButton>
                  );
                })}
              </div>

              <div className="desktop-landing-guide__header">
                <span aria-hidden="true">
                  <GuidePlatformIcon />
                </span>
                <div>
                  <strong>{guideContent.platformName} guide</strong>
                  <p>{guideContent.infoText}</p>
                </div>
              </div>

              <ol className="desktop-landing-guide__steps">
                {guideContent.steps.map((step, index) => (
                  <li key={step.title}>
                    <span className="desktop-landing-guide__number">
                      {index + 1}
                    </span>
                    <span
                      className={`desktop-landing-guide__icon${
                        step.icon ? "" : " desktop-landing-guide__icon--app"
                      }`}
                      aria-hidden="true"
                    >
                      {step.icon ?? (
                        <img draggable={false}
                          src="/icons/app-icon-512.png"
                          width={512}
                          height={512}
                          alt=""
                          decoding="sync"
                        />
                      )}
                    </span>
                    <div>
                      <strong>{step.title}</strong>
                      <span>{step.detail}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="desktop-landing-install__intro">
              <p className="desktop-landing-kicker">How to use it</p>
              <h2 id="desktop-install-title">Add it from your phone</h2>
              <p>
                Finance Manager is meant to run from the Home Screen, without a
                browser bar and with a smoother mobile flow
              </p>
            </div>
          </section>
        </section>
        <footer className="desktop-landing-footer">
          <p className="desktop-landing-footer__copy">© 2026 Arnau Sala</p>
          <a
            className="desktop-landing-legal"
            href={DESKTOP_LEGAL_PATH}
            onClick={openLegalScreen}
          >
            Privacy & Terms
          </a>
          <LandingFloatingActionButton />
        </footer>
      </main>
  );
}

function BrowserInstallScreen({
  initialPlatform
}: {
  initialPlatform: BrowserInstallPlatform;
}) {
  const [platform, setPlatform] =
    useState<BrowserInstallPlatform>(initialPlatform);
  const [isLegalScreenOpen, setIsLegalScreenOpen] = useState(false);
  const [isLegalScreenClosing, setIsLegalScreenClosing] = useState(false);
  const [isPlatformInfoOpen, setIsPlatformInfoOpen] = useState(false);
  const [isPlatformInfoClosing, setIsPlatformInfoClosing] = useState(false);
  const platformSelectorRef = useRef<HTMLDivElement>(null);
  const content = installContent[platform];
  const alternatePlatform = platform === "apple" ? "android" : "apple";
  const PlatformIcon = content.PlatformIcon;

  function openPlatformInfo() {
    setIsPlatformInfoClosing(false);
    setIsPlatformInfoOpen(true);
  }

  function closePlatformInfo() {
    setIsPlatformInfoClosing(true);
  }

  useEffect(() => {
    if (!isPlatformInfoOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        platformSelectorRef.current?.contains(event.target)
      ) {
        return;
      }

      closePlatformInfo();
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isPlatformInfoOpen]);

  return (
    <>
      <main
        className="browser-install-screen"
        aria-labelledby="browser-install-title"
      >
        <section className="browser-install-panel">
          <div className="browser-install-platform" ref={platformSelectorRef}>
            <ActionButton
              shape="icon"
              className="browser-install-platform__button"
              type="button"
              aria-label={`Show ${content.platformName} guide info`}
              aria-expanded={isPlatformInfoOpen}
              onClick={() => {
                if (isPlatformInfoOpen) {
                  closePlatformInfo();
                  return;
                }

                openPlatformInfo();
              }}
            >
              <PlatformIcon className="browser-install-platform__icon" />
            </ActionButton>

            {isPlatformInfoOpen ? (
              <aside
                className={`browser-install-platform__info${
                  isPlatformInfoClosing
                    ? " browser-install-platform__info--closing"
                    : ""
                }`}
                onAnimationEnd={(event) => {
                  if (
                    event.target === event.currentTarget &&
                    isPlatformInfoClosing
                  ) {
                    setIsPlatformInfoOpen(false);
                    setIsPlatformInfoClosing(false);
                  }
                }}
              >
                <strong>{content.infoTitle}</strong>
                <p>{content.infoText}</p>
                <ActionButton
                  className="browser-install-platform__switch"
                  type="button"
                  onClick={() => {
                    setPlatform(alternatePlatform);
                    setIsPlatformInfoOpen(false);
                    setIsPlatformInfoClosing(false);
                  }}
                >
                  {content.switchLabel}
                </ActionButton>
              </aside>
            ) : null}
          </div>

          <header className="browser-install-hero">
            <div className="browser-install-icon" aria-hidden="true">
              <img draggable={false}
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
            {content.steps.map((step, index) => (
              <li key={step.title}>
                <span className="browser-install-step__number">{index + 1}</span>
                <span
                  className={`browser-install-step__icon${
                    step.icon ? "" : " browser-install-step__icon--app"
                  }`}
                  aria-hidden="true"
                >
                  {step.icon ?? (
                    <img draggable={false}
                      src="/icons/app-icon-512.png"
                      width={512}
                      height={512}
                      alt=""
                      decoding="sync"
                    />
                  )}
                </span>
                <span className="browser-install-step__content">
                  <strong>{step.title}</strong>
                  <span>{step.detail}</span>
                </span>
              </li>
            ))}
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
