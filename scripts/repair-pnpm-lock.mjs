#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { execFileSync, execSync } from "node:child_process";

const LOCKFILE = "pnpm-lock.yaml";
const BASE_REF = process.env.LOCKFILE_BASE_REF || "origin/main";
const shouldRegenerate =
  process.argv.includes("--regenerate") || process.env.REGENERATE_LOCKFILE === "1";

function run(file, args, options = {}) {
  return execFileSync(file, args, {
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : "pipe",
    ...options,
  })?.trim();
}

function git(args, options = {}) {
  return run("git", args, options);
}

function pnpm(args, options = {}) {
  if (process.env.npm_execpath && existsSync(process.env.npm_execpath)) {
    return run(process.execPath, [process.env.npm_execpath, ...args], options);
  }

  const quotedArgs = args.map((arg) => JSON.stringify(arg)).join(" ");
  return execSync(`pnpm ${quotedArgs}`, {
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : "pipe",
  })?.trim();
}

function hasConflictMarkers(file) {
  return existsSync(file) && readFileSync(file, "utf8").includes("<<<<<<<");
}

function changedFiles(baseRef = BASE_REF) {
  try {
    const output = git(["diff", "--name-only", `${baseRef}...HEAD`]);
    return output ? output.split(/\r?\n/).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function isManifestPath(file) {
  return (
    file === "package.json" ||
    file === "pnpm-workspace.yaml" ||
    file.endsWith("/package.json")
  );
}

function checkoutLockfileFromMain() {
  try {
    git(["checkout", "--theirs", "--", LOCKFILE], { inherit: true });
  } catch {
    git(["checkout", BASE_REF, "--", LOCKFILE], { inherit: true });
  }
}

if (!existsSync(LOCKFILE)) {
  console.error(`Missing ${LOCKFILE}.`);
  process.exit(1);
}

const files = changedFiles();
const manifestChanges = files.filter(isManifestPath);
const lockfileChanged = files.includes(LOCKFILE);
const conflicted = hasConflictMarkers(LOCKFILE);

if (conflicted && manifestChanges.length === 0 && !shouldRegenerate) {
  console.log(
    `${LOCKFILE} is conflicted, but this branch has no package manifest changes. Keeping ${BASE_REF}'s lockfile.`,
  );
  checkoutLockfileFromMain();
  git(["add", LOCKFILE], { inherit: true });
}

if (shouldRegenerate || (conflicted && manifestChanges.length > 0)) {
  console.log("Regenerating pnpm lockfile from current package manifests.");
  pnpm(["install", "--lockfile-only", "--ignore-scripts"], { inherit: true });
  git(["add", LOCKFILE], { inherit: true });
}

if (lockfileChanged && manifestChanges.length === 0 && !conflicted && !shouldRegenerate) {
  console.error(
    `${LOCKFILE} changed without package manifest changes. Restore it from ${BASE_REF} or run with --regenerate intentionally.`,
  );
  process.exit(1);
}

pnpm(["install", "--frozen-lockfile", "--ignore-scripts"], { inherit: true });
console.log("pnpm lockfile is consistent.");
