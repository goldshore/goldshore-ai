import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const CANONICAL_WORKERS = ["gs-agent", "gs-api", "gs-control", "gs-gateway", "gs-mail"];
const APPS_DIR = "apps";

let failed = false;

if (!existsSync(APPS_DIR)) {
  console.error("apps directory not found");
  process.exit(1);
}

for (const worker of CANONICAL_WORKERS) {
  const workerDir = join(APPS_DIR, worker);
  const wranglerPath = join(workerDir, "wrangler.toml");

  if (!existsSync(workerDir)) {
    failed = true;
    console.error(`Missing canonical worker directory: ${workerDir}`);
    continue;
  }

  if (!existsSync(wranglerPath)) {
    failed = true;
    console.error(`Missing wrangler.toml: ${wranglerPath}`);
    continue;
  }

  console.log(`✅ ${workerDir} contains wrangler.toml`);
}

const appsDirs = readdirSync(APPS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith("gs-"))
  .map((entry) => entry.name)
  .sort();

const unexpectedWorkers = appsDirs.filter(
  (dir) => existsSync(join(APPS_DIR, dir, "wrangler.toml")) && !CANONICAL_WORKERS.includes(dir),
);

if (unexpectedWorkers.length > 0) {
  failed = true;
  console.error(
    `Unexpected worker directories with wrangler.toml: ${unexpectedWorkers.map((dir) => `apps/${dir}`).join(", ")}`,
  );
}

if (failed) {
  process.exit(1);
}

console.log("All canonical worker structure checks passed.");
