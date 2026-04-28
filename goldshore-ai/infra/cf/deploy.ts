// infra/cf/deploy.ts
import fs from "node:fs";
import YAML from "yaml";
import FormData from "form-data";
import { cf } from "./client";
import { latestPagesStatus, workerBindingsOk } from "./checks";
import { smoke, lighthouse } from "./tests";
import { changedPaths, pathsMatchOnly, withinDailyCap } from "./guards";

type Cfg = ReturnType<typeof loadCfg>;
function loadCfg() { return YAML.parse(fs.readFileSync("infra/cf/config.yaml","utf8")); }

async function countTodayDeploys(deployments: any[]) {
  const today = new Date().toISOString().slice(0,10);
  return deployments.filter((d: any) => (d.created_on || d.created_at || "").startsWith(today)).length;
}

async function deployPages(p: any) {
  const changed = changedPaths();
  if (p.skip_if_paths_only && pathsMatchOnly(changed, p.skip_if_paths_only)) {
    console.log(`[pages:${p.name}] Skipping deploy: non-app changes only`);
    return;
  }

  const list = await cf.pages.deployments(p.name);
  const todayCount = await countTodayDeploys(list);
  if (!withinDailyCap(todayCount, p.max_daily_deploys)) {
    console.log(`[pages:${p.name}] Daily cap reached (${todayCount}/${p.max_daily_deploys})`);
    return;
  }

  if (p.require_checks?.includes("smoke")) {
    await smoke(`https://${p.name}.goldshore.org/`, 200).catch(()=>{});
  }

  const status = await latestPagesStatus(p.name);
  if (status === "building") {
    console.log(`[pages:${p.name}] Build in progress; skipping to avoid duplicate.`);
    return;
  }

  console.log(`[pages:${p.name}] Triggering new build…`);
  const build = await cf.pages.triggerBuild(p.name);

  let tries = 30;
  while (tries--) {
    const d = await cf.pages.getDeployment(p.name, build.id);
    const s = d?.latest_stage?.status;
    if (s === "success") break;
    if (s === "failed") throw new Error(`[pages:${p.name}] Build failed`);
    await new Promise(r => setTimeout(r, 5000));
  }

  if (p.require_checks?.includes("smoke")) {
    await smoke(`https://${p.name}.goldshore.org/`, 200, 8000);
  }
  if (p.require_checks?.includes("lighthouse")) {
    await lighthouse(`https://${p.name}.goldshore.org/`, 0.8);
  }
  console.log(`[pages:${p.name}] Deploy OK.`);
}

async function deployWorker(w: any) {
  const changed = changedPaths();
  if (w.skip_if_paths_only && pathsMatchOnly(changed, w.skip_if_paths_only)) {
    console.log(`[worker:${w.script}] Skipping deploy: non-app changes only`);
    return;
  }

  const versions = await cf.workers.versions(w.script);
  const todayCount = await countTodayDeploys(versions);
  if (!withinDailyCap(todayCount, w.max_daily_deploys)) {
    console.log(`[worker:${w.script}] Daily cap reached (${todayCount}/${w.max_daily_deploys})`);
    return;
  }

  if (!(await workerBindingsOk(w.script))) {
    throw new Error(`[worker:${w.script}] No bindings found; aborting deploy`);
  }

  const fd = new FormData();
  fd.append("main", fs.createReadStream(w.entry), { filename: "index.js", contentType: "application/javascript" });

  console.log(`[worker:${w.script}] Deploying…`);
  await cf.workers.deploy(w.script, fd);

  if (w.require_checks?.includes("smoke")) {
    await smoke("https://api.goldshore.org/health", 200, 8000);
  }

  console.log(`[worker:${w.script}] Deploy OK.`);
}

async function main() {
  const cfg = loadCfg();
  const pages = cfg.projects?.pages ?? [];
  const workers = cfg.projects?.workers ?? [];

  await Promise.all([
    ...pages.map(p => deployPages(p)),
    ...workers.map(w => deployWorker(w)),
  ]);
}

// Redact sensitive environment values from error messages before logging
function redactSensitive(err: unknown): string {
  // List of sensitive env values to redact if present
  const SENSITIVE = [
    process.env.CF_API_TOKEN,
    process.env.CF_ACCOUNT_ID,
    process.env.CF_ZONE_ID,
  ].filter(Boolean) as string[]; // remove undefined/null
  let str = (err instanceof Error) ? (err.stack || err.message) : String(err);
  for (const value of SENSITIVE) {
    if (typeof value === "string" && value.length > 4) {
      // Replace all occurrences with "[REDACTED]"
      const regex = new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g");
      str = str.replace(regex, "[REDACTED]");
    }
  }
  return str;
}

main().catch(e => {
  console.error(redactSensitive(e));
  process.exit(1);
});
