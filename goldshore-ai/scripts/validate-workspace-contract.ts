import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT_REQUIRED_FILES = ["package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml", "turbo.json"];
const ROOT = process.cwd();
const IGNORE_DIRS = new Set([".git", "node_modules", ".turbo", "dist", "build", "coverage"]);

let failed = false;

for (const file of ROOT_REQUIRED_FILES) {
  if (!existsSync(join(ROOT, file))) {
    failed = true;
    console.error(`Missing required workspace root file: ${file}`);
  } else {
    console.log(`✅ Found root workspace file: ${file}`);
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
  failed = true;
  console.error(
    `Nested workspace root markers detected (workspace contract violation): ${nestedMarkers.join(", ")}`,
  );
} else {
  console.log("✅ No nested workspace roots detected");
}

if (failed) {
  process.exit(1);
}

console.log("Workspace root contract checks passed.");
