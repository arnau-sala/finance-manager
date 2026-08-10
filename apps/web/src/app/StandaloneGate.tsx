import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  MoreVertical,
  Share,
  Smartphone,
  SquarePlus
} from "lucide-react";

import { ActionButton } from "../components/ui/ActionButton";
import { LegalNoticeScreen } from "../features/auth/LegalNoticeScreen";

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

type StandaloneGateProps = {
  children: ReactNode;
};

type BrowserInstallPlatform = "apple" | "android";

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
    if (isAppleBrowser) {
      return <BrowserInstallScreen initialPlatform="apple" />;
    }

    if (isAndroidBrowser) {
      return <BrowserInstallScreen initialPlatform="android" />;
    }

    return (
      <main className="browser-placeholder-screen" aria-label="Browser mode">
        <p>Navigator Page</p>
      </main>
    );
  }

  return <>{children}</>;
}

export function AppleBrowserInstallScreen() {
  return <BrowserInstallScreen initialPlatform="apple" />;
}

export function AndroidBrowserInstallScreen() {
  return <BrowserInstallScreen initialPlatform="android" />;
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
                    <img
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
