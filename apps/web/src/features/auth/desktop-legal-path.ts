export const DESKTOP_LEGAL_PATH = "/privacy-and-terms";

export function normalizeAppPath(pathname: string) {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : "/";
}

export function isDesktopLegalPath(pathname = window.location.pathname) {
  return normalizeAppPath(pathname) === DESKTOP_LEGAL_PATH;
}
