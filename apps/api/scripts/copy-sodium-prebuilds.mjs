import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

function resolveSodiumPrebuilds() {
  try {
    return join(dirname(require.resolve("sodium-native/package.json")), "prebuilds");
  } catch {
    return join(apiRoot, "../../node_modules/sodium-native/prebuilds");
  }
}

const source = resolveSodiumPrebuilds();
const destinations = [join(apiRoot, "prebuilds"), join(apiRoot, "api/prebuilds")];

if (!existsSync(source)) {
  console.warn("sodium-native prebuilds not found; skipping Vercel copy");
  process.exit(0);
}

for (const destination of destinations) {
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  cpSync(source, destination, { recursive: true });
}
