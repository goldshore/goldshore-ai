import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const APPS_DIR = path.resolve(process.cwd(), "apps");
const REQUIRED_APP_DIRS = ["gs-api", "gs-web"] as const;
const ALLOWED_APP_DIRS = new Set<string>(REQUIRED_APP_DIRS);
const GS_API_REQUIRED_FILES = ["wrangler.toml", "package.json", "tsconfig.json", "src/index.ts"];
const GS_WEB_REQUIRED_FILES = ["wrangler.jsonc", "package.json", "astro.config.mjs", "src"];
const DISALLOWED_APP_DIRS = ["gs-admin", "gs-agent", "gs-control", "gs-gateway", "gs-mail"];
const ACTIVE_DEPLOY_WORKFLOWS = [".github/workflows/deploy-gs-api.yml", ".github/workflows/deploy-gs-web.yml"];

function appDirectories(): string[] {
  if (!existsSync(APPS_DIR)) {
    return [];
  }

  return readdirSync(APPS_DIR)
    .map((entry) => path.join(APPS_DIR, entry))
    .filter((fullPath) => statSync(fullPath).isDirectory());
}

function missingFiles(appName: string, requiredFiles: readonly string[]): string[] {
  const appPath = path.join(APPS_DIR, appName);
  return requiredFiles.filter((file) => !existsSync(path.join(appPath, file)));
}

function validateActiveDeployWorkflows(): string[] {
  const failures: string[] = [];

  if (!existsSync(".github/workflows")) {
    return failures;
  }

  const deployWorkflows = readdirSync(".github/workflows")
    .filter((file) => /^deploy-.*\.ya?ml$/.test(file))
    .map((file) => `.github/workflows/${file}`)
    .sort();

  for (const workflow of ACTIVE_DEPLOY_WORKFLOWS) {
    if (!existsSync(workflow)) {
      failures.push(`missing active deploy workflow: ${workflow}`);
    }
  }

  for (const workflow of deployWorkflows) {
    if (!ACTIVE_DEPLOY_WORKFLOWS.includes(workflow)) {
      failures.push(`unexpected active deploy workflow: ${workflow}`);
    }
  }

  return failures;
}

function validateDeploymentConfigReferences(): string[] {
  const failures: string[] = [];
  const files = [
    ".github/workflows/deploy-gs-api.yml",
    ".github/workflows/preview-gs-api.yml",
    ".github/workflows/deploy-gs-web.yml",
    ".github/workflows/preview-gs-web.yml",
    "pnpm-workspace.yaml",
  ];

  for (const file of files) {
    if (!existsSync(file)) {
      failures.push(`missing deployment/workspace config file: ${file}`);
      continue;
    }

    const content = readFileSync(file, "utf8");
    for (const disallowed of DISALLOWED_APP_DIRS) {
      if (content.includes(`apps/${disallowed}`)) {
        failures.push(`${file}: contains disallowed app path "apps/${disallowed}"`);
      }
    }
  }

  return failures;
}

export function validateWorkerStructure(): string[] {
  const failures: string[] = [];

  if (!existsSync(APPS_DIR)) {
    return ["apps directory not found"];
  }

  const apps = appDirectories().map((dir) => path.basename(dir)).sort();

  for (const app of REQUIRED_APP_DIRS) {
    if (!apps.includes(app)) {
      failures.push(`missing required app directory: apps/${app}`);
    }
  }

  for (const app of apps) {
    if (!ALLOWED_APP_DIRS.has(app)) {
      failures.push(`unexpected app directory after consolidation: apps/${app}`);
    }
  }

  const apiMissing = missingFiles("gs-api", GS_API_REQUIRED_FILES);
  if (apiMissing.length > 0) {
    failures.push(`gs-api: missing required file(s): ${apiMissing.join(", ")}`);
  }

  const webMissing = missingFiles("gs-web", GS_WEB_REQUIRED_FILES);
  if (webMissing.length > 0) {
    failures.push(`gs-web: missing required file(s): ${webMissing.join(", ")}`);
  }

  failures.push(...validateActiveDeployWorkflows());
  failures.push(...validateDeploymentConfigReferences());

  return failures;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const failures = validateWorkerStructure();

  if (failures.length > 0) {
    console.error("Worker structure validation failed:\n");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Worker structure validation passed.");
}
