// infra/cf/guards.ts
import { execSync } from "node:child_process";

export function changedPaths(baseRef = process.env.GITHUB_BASE_REF || "origin/main"): string[] {
  const diff = execSync(`git diff --name-only ${baseRef}...`, { encoding: "utf8" });
  return diff.split("\n").filter(Boolean);
}

export function pathsMatchOnly(changed: string[], patterns: string[]): boolean {
  const re = patterns.map(p => new RegExp(p));
  return changed.every(ch => re.some(r => r.test(ch)));
}

export function withinDailyCap(count: number, cap: number) {
  return count < cap;
}

export function nowISO() { return new Date().toISOString(); }
