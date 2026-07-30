type AppSplashScreenProps = {
  exiting?: boolean;
  onExitComplete?: () => void;
};

export function AppSplashScreen({
  exiting = false,
  onExitComplete
}: AppSplashScreenProps) {
  return (
    <main
      className={`app-splash${exiting ? " app-splash--exiting" : ""}`}
      role="status"
      aria-live="polite"
      onAnimationEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          event.animationName === "app-splash-exit"
        ) {
          onExitComplete?.();
        }
      }}
    >
      <div className="app-splash__center" aria-hidden="true">
        <img
          className="app-splash__logo"
          src="/icons/app-icon-512.png"
          alt=""
          fetchPriority="high"
        />
      </div>

      <p className="app-splash__brand" aria-hidden="true">
        Finance Manager
      </p>
      <span className="sr-only">Loading Finance Manager</span>
    </main>
  );
}
