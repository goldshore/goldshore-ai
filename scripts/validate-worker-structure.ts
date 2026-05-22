import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { join } from "node:path";

const APPS_DIR = path.resolve(process.cwd(), "apps");
const REQUIRED_FILES = ["wrangler.toml", "package.json", "tsconfig.json", "src/index.ts"];
const LEGACY_API_WORKER_PATH = "apps/api-worker";
const GS_API_PATH = "apps/gs-api";
const DEPLOYMENT_CONFIG_FILES = [
  ".github/workflows/deploy-gs-api.yml",
  ".github/workflows/preview-gs-api.yml",
  ".github/workflows-disabled/deploy-api-worker.yml",
  "infra/Cloudflare/config.yaml",
  "infra/Cloudflare/desired-state.yaml",
  "infra/Cloudflare/gs-api.wrangler.toml",
  "infra/Cloudflare/legacy/goldshore-api.wrangler.toml",
] as const;

function findWorkerDirectories(): string[] {
  return readdirSync(APPS_DIR)
    .map((entry) => path.join(APPS_DIR, entry))
    .filter((fullPath) => statSync(fullPath).isDirectory())
    .filter((fullPath) => existsSync(path.join(fullPath, "wrangler.toml")))
    .filter((fullPath) => !fullPath.includes(`${path.sep}legacy${path.sep}`));
}

function validateCanonicalApiWorkerPaths(): string[] {
  const failures: string[] = [];

  for (const filePath of DEPLOYMENT_CONFIG_FILES) {
    if (!existsSync(filePath)) {
      failures.push(`missing deployment config file: ${filePath}`);
      continue;
    }

    const content = readFileSync(filePath, "utf8");

    if (content.includes(LEGACY_API_WORKER_PATH)) {
      failures.push(`${filePath}: contains legacy API worker path \"${LEGACY_API_WORKER_PATH}\"`);
    }

    if (!content.includes(GS_API_PATH)) {
      failures.push(`${filePath}: missing canonical API worker path \"${GS_API_PATH}\"`);
    }
  }

  return failures;
}

export function validateWorkerStructure(): string[] {
  const failures: string[] = [];

  for (const workerDir of findWorkerDirectories()) {
    const folderName = path.basename(workerDir);
    // Ignore frontend apps for typical worker validation
    if (folderName === 'gs-admin' || folderName === 'gs-web') continue;

    const missingFiles = REQUIRED_FILES.filter((file) => !existsSync(path.join(workerDir, file)));

    if (missingFiles.length > 0) {
      failures.push(`${folderName}: missing required file(s): ${missingFiles.join(", ")}`);
    }
  }

  failures.push(...validateCanonicalApiWorkerPaths());

  return failures;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const failures = validateWorkerStructure();
  let failed = false;

  if (failures.length > 0) {
    console.error("Worker structure validation failed:\n");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    failed = true;
  }

  const CANONICAL_WORKERS = ["gs-agent", "gs-api", "gs-control", "gs-gateway", "gs-mail"];

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
  }

  const appsDirs = readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("gs-"))
    .map((entry) => entry.name)
    .sort();

  const unexpectedWorkers = appsDirs.filter(
    (dir) => existsSync(join(APPS_DIR, dir, "wrangler.toml")) && !CANONICAL_WORKERS.includes(dir) && dir !== 'gs-admin' && dir !== 'gs-web',
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

  console.log("Worker structure validation passed.");
}
