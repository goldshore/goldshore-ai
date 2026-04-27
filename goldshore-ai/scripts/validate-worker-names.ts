import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CANONICAL_WORKERS = ["gs-agent", "gs-api", "gs-control", "gs-gateway", "gs-mail"];
const APPS_DIR = "apps";

let failed = false;

for (const worker of CANONICAL_WORKERS) {
  const wranglerPath = join(APPS_DIR, worker, "wrangler.toml");

  if (!existsSync(wranglerPath)) {
    failed = true;
    console.error(`Missing wrangler.toml for ${worker}: ${wranglerPath}`);
    continue;
  }

  const content = readFileSync(wranglerPath, "utf8");
  const match = content.match(/^\s*name\s*=\s*["']([^"']+)["']/m);

  if (!match) {
    failed = true;
    console.error(`Could not parse worker name from ${wranglerPath}`);
    continue;
  }

  const configuredName = match[1]?.trim();
  if (configuredName !== worker) {
    failed = true;
    console.error(`Worker name mismatch in ${wranglerPath}: expected '${worker}', got '${configuredName}'`);
    continue;
  }

  console.log(`✅ ${worker} name matches wrangler.toml`);
}

if (failed) {
  process.exit(1);
}

console.log("All canonical worker name checks passed.");
