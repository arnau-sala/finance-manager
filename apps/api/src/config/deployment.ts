const LOCAL_WEB_ORIGIN = "http://localhost:5173";

export const productionWebOrigin = "https://financemanager-mobile.vercel.app";
export const productionApiOrigin = "https://financemanager-api.vercel.app";
export const authContactEmail = "financemanager.auth@gmail.com";

export function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

export function getWebAppUrl() {
  const configured = process.env.WEB_APP_URL?.trim();

  if (configured) {
    return stripTrailingSlash(configured);
  }

  return process.env.NODE_ENV === "production"
    ? productionWebOrigin
    : LOCAL_WEB_ORIGIN;
}

export function getGoogleRedirectUri() {
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim();

  if (configured) {
    return stripTrailingSlash(configured);
  }

  return `${getWebAppUrl()}/api/auth/google/callback`;
}

export function getProductionAllowedOrigins() {
  return [productionWebOrigin];
}
