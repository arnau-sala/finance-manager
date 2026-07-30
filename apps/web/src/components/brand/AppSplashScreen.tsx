export function AppSplashScreen() {
  return (
    <main className="app-splash" role="status" aria-live="polite">
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
