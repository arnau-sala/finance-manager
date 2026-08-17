import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  authContactEmail,
  getGoogleRedirectUri,
  getWebAppUrl,
  productionApiOrigin,
  productionWebOrigin,
  stripTrailingSlash,
} from "../src/config/deployment.js";

const webVercelConfig = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../web/vercel.json"),
    "utf8",
  ),
) as {
  rewrites: { source: string; destination: string }[];
};

describe("canonical production URLs", () => {
  it("keeps the web API rewrite on the canonical API origin", () => {
    const apiRewrite = webVercelConfig.rewrites.find(
      (rewrite) => rewrite.source === "/api/:path*",
    );

    expect(apiRewrite?.destination).toBe(`${productionApiOrigin}/:path*`);
  });

  it("keeps the product auth email aligned across apps", () => {
    const webBrand = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../web/src/config/brand.ts",
      ),
      "utf8",
    );

    expect(authContactEmail).toBe("financemanager.auth@gmail.com");
    expect(webBrand).toContain(`"${authContactEmail}"`);
  });

  it("derives the Google redirect URI from the canonical web origin", () => {
    const previousWebAppUrl = process.env.WEB_APP_URL;
    const previousGoogleRedirectUri = process.env.GOOGLE_REDIRECT_URI;
    const previousNodeEnv = process.env.NODE_ENV;

    delete process.env.WEB_APP_URL;
    delete process.env.GOOGLE_REDIRECT_URI;
    process.env.NODE_ENV = "production";

    try {
      expect(stripTrailingSlash(`${productionWebOrigin}/`)).toBe(
        productionWebOrigin,
      );
      expect(getWebAppUrl()).toBe(productionWebOrigin);
      expect(getGoogleRedirectUri()).toBe(
        `${productionWebOrigin}/api/auth/google/callback`,
      );
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      if (previousWebAppUrl === undefined) {
        delete process.env.WEB_APP_URL;
      } else {
        process.env.WEB_APP_URL = previousWebAppUrl;
      }
      if (previousGoogleRedirectUri === undefined) {
        delete process.env.GOOGLE_REDIRECT_URI;
      } else {
        process.env.GOOGLE_REDIRECT_URI = previousGoogleRedirectUri;
      }
    }
  });
});
