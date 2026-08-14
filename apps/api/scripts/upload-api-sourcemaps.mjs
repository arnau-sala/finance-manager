import "dotenv/config";

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const requiredEnvironment = [
  "SENTRY_AUTH_TOKEN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
];

if (requiredEnvironment.some((name) => !process.env[name]?.trim())) {
  process.exit(0);
}

const distDirectory = resolve(process.cwd(), "dist");

if (!existsSync(distDirectory)) {
  console.error("API dist directory not found for Sentry source maps");
  process.exit(1);
}

const require = createRequire(import.meta.url);
const sentryCliPath = require.resolve("@sentry/cli/bin/sentry-cli");

function runSentryCli(argumentsList) {
  const result = spawnSync(process.execPath, [sentryCliPath, ...argumentsList], {
    stdio: "inherit",
    shell: false,
  });

  if (result.error || result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runSentryCli(["sourcemaps", "inject", distDirectory]);
runSentryCli([
  "sourcemaps",
  "upload",
  "--org",
  process.env.SENTRY_ORG,
  "--project",
  process.env.SENTRY_PROJECT,
  distDirectory,
]);
