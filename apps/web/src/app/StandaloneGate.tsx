import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";

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

export function StandaloneGate({ children }: StandaloneGateProps) {
  const [isStandalone, setIsStandalone] = useState(getIsStandaloneApp);

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
    return (
      <main className="browser-placeholder-screen" aria-label="Browser mode">
        <p>Navigator Page</p>
      </main>
    );
  }

  return <>{children}</>;
}
