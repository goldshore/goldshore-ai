#!/usr/bin/env -S npx tsx
// infra/cron/agent_poll.ts
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { gh, findOpenConflicts, openOpsIssue, commentOnPR, createFixBranchAndPR } from "./helpers/github";
import { getPagesProjectBuildStatus, getDNSRecords, getWorkerBindings } from "./helpers/cloudflare";
import { createLogger } from "./helpers/logger";

const logger = createLogger("agent");

type Cfg = ReturnType<typeof loadConfig>;
function loadConfig() {
  const cfgPath = path.join(process.cwd(), "infra/cron/config.yaml");
  return YAML.parse(fs.readFileSync(cfgPath, "utf8"));
}
const cfg: any = loadConfig();

function log(...a: any[]) { console.log("[agent]", ...a); }
function err(...a: any[]) { console.error("[agent:ERROR]", ...a); }

async function ensurePagesOutputDirRule() {
  const rule = cfg.rules?.pages_output_dirs?.[0];
  if (!rule) return;
  const { repo, path: out } = rule;
  const owner = cfg.github.org;
  const pkgRes: any = await gh.rest.repos.getContent({ owner, repo, path: "package.json" }).catch(() => null);
  if (!pkgRes || Array.isArray(pkgRes.data)) return;
  const pkg = JSON.parse(Buffer.from((pkgRes.data as any).content, "base64").toString("utf8"));
  const build = pkg.scripts?.build ?? "";
  if (!build.includes(out)) {
    const title = "fix(pages): ensure build outputs to " + out;
    const body = `Automated fix: ensure Cloudflare Pages output path is **${out}**.`;
    const changes = [{
      path: "package.json",
      content: JSON.stringify({
        ...pkg,
        scripts: {
          ...pkg.scripts,
          build: `${build} && mkdir -p ${out.split("/").slice(0,-1).join("/")} && rm -rf ${out} && cp -r dist ${out}`
        }
      }, null, 2)
    }];
    const pr = await createFixBranchAndPR(owner, repo, "main", "chore/agent-fix-pages-output", title, body, changes);
    logger.info("Opened PR", pr.html_url);
    log("Opened PR", pr.html_url);
  }
}

async function checkCloudflare() {
  const maxConcurrent = cfg.max_parallel_checks || 6;
  const checks = cfg.cloudflare.checks as any[];
  const executing = new Set<Promise<void>>();

  for (const check of checks) {
    const p = Promise.resolve().then(async () => {
      try {
        if (check.type === "pages_build_status") {
          const status = await getPagesProjectBuildStatus(check.project);
          if (!["success", "completed"].includes(status)) {
            await openOpsIssue(cfg.github.org, "goldshore", `Pages build issue: ${check.project}`,
              `Latest build stage status: \`${status}\`. Trigger rebuild or inspect Pages logs.`, cfg.ai_agent.triage_labels);
          }
        } else if (check.type === "dns_records") {
          const dns = await getDNSRecords();
          const dnsIndex = new Map<string, any[]>();
          for (const d of dns as any[]) {
            const key = `${d.name}|${d.type}`;
            if (!dnsIndex.has(key)) dnsIndex.set(key, []);
            dnsIndex.get(key)!.push(d);
          }
          for (const req of check.required) {
            const key = `${req.name}|${req.type}`;
            const records = dnsIndex.get(key) || [];
            const hit = records.find((d: any) => (req.contains ? (String(d.content || "").includes(req.contains)) : true));
            if (!hit) {
              await openOpsIssue(cfg.github.org, "goldshore", `DNS missing/invalid: ${req.name} (${req.type})`,
                `Record is missing or does not match required constraints.\n\nRequired: \`${JSON.stringify(req)}\``, cfg.ai_agent.triage_labels);
            }
          }
        } else if (check.type === "worker_health") {
          const bindings = await getWorkerBindings(check.script);
          const hasEnv = (bindings as any[]).length > 0;
          if (!hasEnv) {
            await openOpsIssue(cfg.github.org, "goldshore", `Worker missing bindings: ${check.script}`,
              `No bindings returned for Worker \`${check.script}\`. Verify wrangler.toml and deployment.`, cfg.ai_agent.triage_labels);
          }
        }
      } catch (err: any) {
        logger.error(`Error processing check ${check.type}:`, err);
      }
    });

    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean).catch(clean);

    if (executing.size >= maxConcurrent) {
      await Promise.race(executing);
    }
  }

  // Wait for the remaining checks to complete
  await Promise.all(executing);
}

async function scanGitConflicts() {
  const repos = cfg.github.repos as string[];
  await Promise.all(
    repos.map(async (repo) => {
      const conflicts = await findOpenConflicts(cfg.github.org, repo);
      await Promise.all(
        (conflicts as any[]).map(async (pr) => {
          if (cfg.rules.open_conflicts.open_pr_comment) {
            await commentOnPR(
              cfg.github.org,
              repo,
              pr.number,
              "Automated notice: this PR is in a conflicted state (`mergeable_state=dirty`). " +
                "Recommended fix: `git fetch origin && git rebase origin/main`, then resolve, then `git push --force-with-lease`."
            );
          }
        })
      );
    })
  );
}

async function main() {
  await checkCloudflare();
  await ensurePagesOutputDirRule();
  await scanGitConflicts();
  logger.info("Agent poll completed.");
  log("Agent poll completed.");
}

main().catch(e => {
  logger.error(e.stack || e);
  err(e.stack || e);
  process.exit(1);
});
