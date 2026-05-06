import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { join, relative } from "node:path";
import { validateWorkerStructure } from "./validate-worker-structure";
import { validateWorkerNames } from "./validate-worker-names";

const APPS_DIR = path.resolve(process.cwd(), "apps");

function getWorkerDirectories(): string[] {
  return readdirSync(APPS_DIR)
    .map((entry) => path.join(APPS_DIR, entry))
    .filter((fullPath) => statSync(fullPath).isDirectory())
    .filter((fullPath) => existsSync(path.join(fullPath, "wrangler.toml")))
    .filter((fullPath) => !fullPath.includes(`${path.sep}legacy${path.sep}`));
}

function validatePackageNames(): string[] {
  const failures: string[] = [];

  for (const workerDir of getWorkerDirectories()) {
    const folderName = path.basename(workerDir);
    const packagePath = path.join(workerDir, "package.json");

    if (!existsSync(packagePath)) {
      failures.push(`${folderName}: missing package.json`);
      continue;
    }

    const parsed = JSON.parse(readFileSync(packagePath, "utf8")) as { name?: string };
    const packageName = parsed.name;

    if (!packageName) {
      failures.push(`${folderName}: missing package.json name field`);
      continue;
    }

    if (!packageName.startsWith("@goldshore/")) {
      failures.push(`${folderName}: package name must start with @goldshore/ (found ${packageName})`);
    }
  }

  return failures;
}

function main() {
  const failures = [...validateWorkerStructure(), ...validateWorkerNames(), ...validatePackageNames()];

  let hasErrors = false;
  if (failures.length > 0) {
    console.error("Workspace worker contract validation failed:\n");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    hasErrors = true;
  }

  const ROOT_REQUIRED_FILES = ["package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml", "turbo.json"];
  const ROOT = process.cwd();
  const IGNORE_DIRS = new Set([".git", "node_modules", ".turbo", "dist", "build", "coverage", "archive"]);

  for (const file of ROOT_REQUIRED_FILES) {
    if (!existsSync(join(ROOT, file))) {
      hasErrors = true;
      console.error(`Missing required workspace root file: ${file}`);
    }
  }

  const workspaceRootMarkers = ["pnpm-workspace.yaml", "turbo.json"];
  const nestedMarkers: string[] = [];

  const scan = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      if (IGNORE_DIRS.has(entry.name)) {
        continue;
      }

      const fullPath = join(dir, entry.name);

      for (const marker of workspaceRootMarkers) {
        const markerPath = join(fullPath, marker);
        if (existsSync(markerPath)) {
          nestedMarkers.push(relative(ROOT, markerPath));
        }
      }

      scan(fullPath);
    }
  };

  scan(ROOT);

  if (nestedMarkers.length > 0) {
    hasErrors = true;
    console.error(
      `Nested workspace root markers detected (workspace contract violation): ${nestedMarkers.join(", ")}`,
    );
  }

  const appsDir = "apps";
  const requiredApps = ["gs-admin", "gs-api", "gs-control", "gs-gateway", "gs-web", "gs-agent"];

  if (!existsSync(appsDir)) {
    console.error("apps directory missing");
    process.exit(1);
  }

  for (const app of requiredApps) {
    const appPath = join(appsDir, app);
    if (!existsSync(appPath)) {
      console.error(`Missing app directory: ${app}`);
      hasErrors = true;
      continue;
    }

    const pkgPath = join(appPath, "package.json");
    if (!existsSync(pkgPath)) {
      console.error(`Missing package.json in ${app}`);
      hasErrors = true;
      continue;
    }

    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    if (pkg.name !== `@goldshore/${app}`) {
      console.error(`Invalid package name in ${app}: ${pkg.name}. Expected @goldshore/${app}`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log("Workspace worker contract validation passed.");
}

main();
