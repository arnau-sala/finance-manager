import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const requestedTarget = process.argv[2] ?? process.env.ZAP_TARGET_URL;

if (!requestedTarget) {
  console.error(
    "Provide a target URL: npm run security:zap -- http://localhost:5173",
  );
  process.exit(1);
}

let target;

try {
  const parsedTarget = new URL(requestedTarget);

  if (!new Set(["http:", "https:"]).has(parsedTarget.protocol)) {
    throw new Error("Unsupported protocol");
  }

  if (["localhost", "127.0.0.1"].includes(parsedTarget.hostname)) {
    parsedTarget.hostname = "host.docker.internal";
  }

  target = parsedTarget.toString();
} catch {
  console.error("The ZAP target must be a valid HTTP or HTTPS URL");
  process.exit(1);
}

const reportDirectory = resolve("zap-report");
mkdirSync(reportDirectory, { recursive: true });

const result = spawnSync(
  "docker",
  [
    "run",
    "--rm",
    "-v",
    `${reportDirectory}:/zap/wrk:rw`,
    "-t",
    "ghcr.io/zaproxy/zaproxy:stable",
    "zap-baseline.py",
    "-t",
    target,
    "-r",
    "zap-report.html",
    "-J",
    "zap-report.json",
    "-w",
    "zap-report.md",
    "-I",
  ],
  { stdio: "inherit", shell: false },
);

if (result.error) {
  console.error(
    "ZAP requires Docker Desktop to be installed and running",
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
