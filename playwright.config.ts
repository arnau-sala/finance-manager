import { devices, defineConfig } from "@playwright/test";

const localWebUrl = "http://127.0.0.1:5173";
const baseURL = process.env.E2E_BASE_URL ?? localWebUrl;
const usesExternalServer = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  expect: {
    timeout: 10_000,
  },
  webServer: usesExternalServer
    ? undefined
    : [
        {
          command: "npm run dev:api",
          url: "http://127.0.0.1:3001/health",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            ...process.env,
            NODE_ENV: "test",
            PORT: "3001",
            DATABASE_URL:
              process.env.E2E_DATABASE_URL ??
              process.env.DATABASE_URL ??
              "postgresql://test:test@127.0.0.1:5432/finance_manager_e2e",
            SESSION_KEY:
              process.env.SESSION_KEY ?? "1".repeat(64),
            ALLOWED_ORIGINS: localWebUrl,
            WEB_APP_URL: localWebUrl,
          },
        },
        {
          command: "npm run dev:web",
          url: localWebUrl,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            ...process.env,
            VITE_SENTRY_DSN: "",
          },
        },
      ],
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "desktop-webkit",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "mobile-webkit",
      use: { ...devices["iPhone 15 Pro"] },
    },
  ],
});
