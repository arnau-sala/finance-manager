export function lockPortraitOrientation() {
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: "portrait") => Promise<void>;
  };

  void orientation.lock?.("portrait").catch(() => {
    // Browsers that do not allow orientation locking should keep running normally.
  });
}
