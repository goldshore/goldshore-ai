#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const WORKSPACE_DIRS = ['apps', 'packages', 'infra'];
const TARGET_PROTOCOL = 'workspace:^';

async function getPackageJsonPaths() {
  const paths = [];

  for (const dir of WORKSPACE_DIRS) {
    const absDir = path.join(ROOT, dir);
    let entries = [];
    try {
      entries = await readdir(absDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      paths.push(path.join(absDir, entry.name, 'package.json'));
    }
  }

  return paths;
}

async function loadWorkspacePackageNames(packageJsonPaths) {
  const names = new Set();

  for (const packagePath of packageJsonPaths) {
    try {
      const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
      if (pkg.name) names.add(pkg.name);
    } catch {
      // Ignore missing/invalid package.json so check can continue for valid packages.
    }
  }

  return names;
}

function collectDependencyFields(pkg) {
  return [
    ['dependencies', pkg.dependencies ?? {}],
    ['devDependencies', pkg.devDependencies ?? {}],
    ['peerDependencies', pkg.peerDependencies ?? {}],
    ['optionalDependencies', pkg.optionalDependencies ?? {}],
  ];
}

async function main() {
  const packageJsonPaths = await getPackageJsonPaths();
  const workspacePackageNames = await loadWorkspacePackageNames(packageJsonPaths);
  const violations = [];

  for (const packagePath of packageJsonPaths) {
    let pkg;
    try {
      pkg = JSON.parse(await readFile(packagePath, 'utf8'));
    } catch {
      continue;
    }

    for (const [fieldName, deps] of collectDependencyFields(pkg)) {
      for (const [depName, depVersion] of Object.entries(deps)) {
        if (!workspacePackageNames.has(depName)) continue;
        if (depVersion !== TARGET_PROTOCOL) {
          violations.push({
            packagePath: path.relative(ROOT, packagePath),
            fieldName,
            depName,
            depVersion,
          });
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error(`Workspace protocol policy violation: internal deps must use ${TARGET_PROTOCOL}.`);
    for (const v of violations) {
      console.error(`- ${v.packagePath} :: ${v.fieldName}.${v.depName} = ${JSON.stringify(v.depVersion)}`);
    }
    process.exit(1);
  }

  console.log(`Workspace protocol check passed (${TARGET_PROTOCOL}).`);
}

main();
