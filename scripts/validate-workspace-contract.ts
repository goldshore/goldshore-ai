import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { validateWorkerStructure } from "./validate-worker-structure";
import { validateWorkerNames } from "./validate-worker-names";

const REQUIRED_ROOT_FILES = ["package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml", "turbo.json"];
const REQUIRED_APPS = ["gs-api", "gs-web"] as const;
const ALLOWED_APP_DIRS = new Set<string>(REQUIRED_APPS);
const DISALLOWED_APP_PATTERNS = ["apps/*", "apps/gs-admin", "apps/gs-agent", "apps/gs-control", "apps/gs-gateway", "apps/gs-mail"];
const IGNORE_DIRS = new Set([".git", "node_modules", ".turbo", "dist", "build", "coverage", "archive"]);

function validateRootFiles(): string[] {
  return REQUIRED_ROOT_FILES
    .filter((file) => !existsSync(file))
    .map((file) => `missing required workspace root file: ${file}`);
}

function validateAppsDirectory(): string[] {
  const failures: string[] = [];

  if (!existsSync("apps")) {
    return ["apps directory missing"];
  }

  const apps = readdirSync("apps", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const app of REQUIRED_APPS) {
    if (!apps.includes(app)) {
      failures.push(`missing app directory: apps/${app}`);
    }
  }

  for (const app of apps) {
    if (!ALLOWED_APP_DIRS.has(app)) {
      failures.push(`unexpected app directory after consolidation: apps/${app}`);
    }
  }

  return failures;
}

function validateWorkspaceYaml(): string[] {
  const failures: string[] = [];
  const workspacePath = "pnpm-workspace.yaml";

  if (!existsSync(workspacePath)) {
    return [`missing ${workspacePath}`];
  }

  const content = readFileSync(workspacePath, "utf8");
  for (const required of ["apps/gs-web", "apps/gs-api", "packages/*"]) {
    if (!content.includes(required)) {
      failures.push(`${workspacePath}: missing required workspace entry "${required}"`);
    }
  }

  for (const disallowed of DISALLOWED_APP_PATTERNS) {
    if (content.includes(disallowed)) {
      failures.push(`${workspacePath}: contains disallowed app workspace entry "${disallowed}"`);
    }
  }

  return failures;
}

function validatePackageNames(): string[] {
  const failures: string[] = [];

  for (const app of REQUIRED_APPS) {
    const pkgPath = join("apps", app, "package.json");

    if (!existsSync(pkgPath)) {
      failures.push(`apps/${app}: missing package.json`);
      continue;
    }

    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string };
    const expected = `@goldshore/${app}`;

    if (pkg.name !== expected) {
      failures.push(`apps/${app}: expected package name "${expected}", found "${pkg.name ?? "(missing)"}"`);
    }
  }

  return failures;
}

function validateNestedWorkspaceMarkers(): string[] {
  const markers = ["pnpm-workspace.yaml", "turbo.json"];
  const nestedMarkers: string[] = [];
  const root = process.cwd();

  const scan = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || IGNORE_DIRS.has(entry.name)) {
        continue;
      }

      const fullPath = join(dir, entry.name);

      for (const marker of markers) {
        const markerPath = join(fullPath, marker);
        if (existsSync(markerPath)) {
          nestedMarkers.push(relative(root, markerPath));
        }
      }

      scan(fullPath);
    }
  };

  scan(root);
  return nestedMarkers.map((marker) => `nested workspace root marker detected: ${marker}`);
}

function main() {
  const failures = [
    ...validateWorkerStructure(),
    ...validateWorkerNames(),
    ...validateRootFiles(),
    ...validateAppsDirectory(),
    ...validateWorkspaceYaml(),
    ...validatePackageNames(),
    ...validateNestedWorkspaceMarkers(),
  ];

  if (failures.length > 0) {
    console.error("Workspace contract validation failed:\n");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Workspace contract validation passed.");
}

main();
