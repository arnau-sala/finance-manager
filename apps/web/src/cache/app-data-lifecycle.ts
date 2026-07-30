import { prefetchScheduler } from "./prefetch-scheduler";
import { queryClient } from "./query-client";

export const APP_BACKGROUND_CACHE_TTL_MS = 3 * 60 * 1000;

const HIDDEN_AT_STORAGE_KEY = "finance-manager-hidden-at";

function readHiddenAt() {
  try {
    const rawValue = window.sessionStorage.getItem(HIDDEN_AT_STORAGE_KEY);
    const hiddenAt = rawValue === null ? Number.NaN : Number(rawValue);

    return Number.isFinite(hiddenAt) ? hiddenAt : null;
  } catch {
    return null;
  }
}

function writeHiddenAt(hiddenAt: number | null) {
  try {
    if (hiddenAt === null) {
      window.sessionStorage.removeItem(HIDDEN_AT_STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(
        HIDDEN_AT_STORAGE_KEY,
        String(hiddenAt)
      );
    }
  } catch {
    // Cache expiry still works in memory when storage is unavailable.
  }
}

export function observeAppDataLifecycle(onCacheExpired: () => void) {
  let expirationTimer: number | null = null;
  let cacheExpiredWhileHidden = false;

  function clearExpirationTimer() {
    if (expirationTimer !== null) {
      window.clearTimeout(expirationTimer);
      expirationTimer = null;
    }
  }

  function expireCache() {
    clearExpirationTimer();
    prefetchScheduler.clear();
    queryClient.clear();
    cacheExpiredWhileHidden = true;
  }

  function markHidden() {
    const hiddenAt = Date.now();
    writeHiddenAt(hiddenAt);
    prefetchScheduler.setSuspended(true);
    clearExpirationTimer();
    expirationTimer = window.setTimeout(
      expireCache,
      APP_BACKGROUND_CACHE_TTL_MS
    );
  }

  function restoreVisible() {
    if (document.visibilityState !== "visible") {
      return;
    }

    const hiddenAt = readHiddenAt();
    const shouldExpire =
      cacheExpiredWhileHidden ||
      (hiddenAt !== null &&
        Date.now() - hiddenAt >= APP_BACKGROUND_CACHE_TTL_MS);

    clearExpirationTimer();
    writeHiddenAt(null);
    prefetchScheduler.setSuspended(false);

    if (!shouldExpire) {
      return;
    }

    if (!cacheExpiredWhileHidden) {
      prefetchScheduler.clear();
      queryClient.clear();
    }

    cacheExpiredWhileHidden = false;
    onCacheExpired();
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
      markHidden();
    } else {
      restoreVisible();
    }
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", markHidden);
  window.addEventListener("pageshow", restoreVisible);

  if (document.visibilityState === "hidden") {
    markHidden();
  } else {
    const hiddenAt = readHiddenAt();

    if (
      hiddenAt !== null &&
      Date.now() - hiddenAt >= APP_BACKGROUND_CACHE_TTL_MS
    ) {
      queryClient.clear();
      onCacheExpired();
    }

    writeHiddenAt(null);
  }

  return () => {
    clearExpirationTimer();
    document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange
    );
    window.removeEventListener("pagehide", markHidden);
    window.removeEventListener("pageshow", restoreVisible);
  };
}
