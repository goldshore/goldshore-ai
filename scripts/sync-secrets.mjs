#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import YAML from "yaml";

const DEFAULT_MANIFEST = "infra/secrets/secret-sync.manifest.yaml";
const WORKFLOW_SECRET_RE = /secrets\.([A-Z0-9_]+)/g;

function parseArgs(argv) {
  const args = {
    command: "audit",
    manifest: DEFAULT_MANIFEST,
    valuesFiles: [],
    dryRun: false,
    strict: false,
    validateAuth: false,
    fingerprints: false,
    allowKvSource: false,
    json: false,
    cloudflareAuth: process.env.CLOUDFLARE_SYNC_AUTH_MODE || "auto",
    githubAuth: process.env.GITHUB_SYNC_AUTH_MODE || "cli",
    target: "all",
    only: new Set(),
  };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const [flag, inlineValue] = arg.split("=", 2);
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${flag}`);
      return argv[index];
    };

    switch (flag) {
      case "--manifest":
        args.manifest = readValue();
        break;
      case "--values":
        args.valuesFiles.push(readValue());
        break;
      case "--target":
        args.target = readValue();
        break;
      case "--only":
        readValue()
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach((item) => args.only.add(item));
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--strict":
        args.strict = true;
        break;
      case "--validate-auth":
        args.validateAuth = true;
        break;
      case "--fingerprints":
        args.fingerprints = true;
        break;
      case "--allow-kv-source":
        args.allowKvSource = true;
        break;
      case "--json":
        args.json = true;
        break;
      case "--cloudflare-auth":
        args.cloudflareAuth = readValue();
        if (!["auto", "token", "wrangler"].includes(args.cloudflareAuth)) {
          throw new Error("--cloudflare-auth must be one of: auto, token, wrangler.");
        }
        break;
      case "--github-auth":
        args.githubAuth = readValue();
        if (!["cli", "token", "auto"].includes(args.githubAuth)) {
          throw new Error("--github-auth must be one of: cli, token, auto.");
        }
        break;
      default:
        throw new Error(`Unknown option: ${flag}`);
    }
  }

  if (positional[0]) args.command = positional[0];
  if (!["audit", "apply", "check"].includes(args.command)) {
    throw new Error(`Unknown command: ${args.command}. Expected audit, apply, or check.`);
  }

  return args;
}

function loadManifest(path) {
  const manifestPath = resolve(path);
  const raw = readFileSync(manifestPath, "utf8");
  const manifest = YAML.parse(raw);
  validateManifest(manifest);
  return { manifest, manifestPath };
}

function validateManifest(manifest) {
  if (!manifest || !Array.isArray(manifest.secrets)) {
    throw new Error("Secret manifest must define a secrets array.");
  }

  const ids = new Set();
  for (const secret of manifest.secrets) {
    if (!secret.id || !secret.sourceEnv) {
      throw new Error("Every secret entry must define id and sourceEnv.");
    }
    if (ids.has(secret.id)) throw new Error(`Duplicate secret id: ${secret.id}`);
    ids.add(secret.id);
  }
}

function parseDotenv(raw) {
  const values = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function loadValues(manifest, explicitFiles) {
  const values = new Map(
    Object.entries(process.env).filter(([, value]) => typeof value === "string" && value.length > 0),
  );
  const files = explicitFiles.length > 0 ? explicitFiles : manifest.localValueFiles ?? [];

  for (const file of files) {
    const path = resolve(file);
    if (!existsSync(path)) continue;
    const raw = readFileSync(path, "utf8");
    const parsed = raw.trimStart().startsWith("{") ? JSON.parse(raw) : parseDotenv(raw);
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.length > 0) values.set(key, value);
    }
  }

  return values;
}

function expandRepos(manifest, target) {
  if (target.repo) return [target.repo];
  if (target.repoGroup) {
    const repos = manifest.repoGroups?.[target.repoGroup];
    if (!Array.isArray(repos) || repos.length === 0) {
      throw new Error(`Unknown or empty repoGroup: ${target.repoGroup}`);
    }
    return repos;
  }
  throw new Error("GitHub target must define repo or repoGroup.");
}

function collectTargets(manifest, secret, targetFilter) {
  const targets = [];
  const include = (kind) => targetFilter === "all" || targetFilter === kind || targetFilter === "github" && (kind === "actions" || kind === "agents");

  for (const target of secret.targets?.githubActions ?? []) {
    if (!include("actions")) continue;
    for (const repo of expandRepos(manifest, target)) {
      targets.push({
        kind: "actions",
        repo,
        name: target.name ?? secret.canonicalName ?? secret.sourceEnv,
        deprecated: Boolean(target.deprecated),
      });
    }
  }

  for (const target of secret.targets?.githubAgents ?? []) {
    if (!include("agents")) continue;
    for (const repo of expandRepos(manifest, target)) {
      targets.push({
        kind: "agents",
        repo,
        name: target.name ?? secret.canonicalName ?? secret.sourceEnv,
        deprecated: Boolean(target.deprecated),
      });
    }
  }

  for (const target of secret.targets?.cloudflareWorkers ?? []) {
    if (!include("cloudflare")) continue;
    targets.push({
      kind: "cloudflare",
      config: target.config,
      env: target.env,
      workerName: target.workerName,
      name: target.name ?? secret.canonicalName ?? secret.sourceEnv,
    });
  }

  return targets;
}

async function resolveSecretValue(manifest, secret, values, args) {
  const sourceNames = [secret.sourceEnv, ...(secret.sourceAliases ?? [])];
  for (const sourceName of sourceNames) {
    const value = values.get(sourceName);
    if (value) return { value, source: sourceName, sourceKind: "env" };
  }

  if (args.allowKvSource && secret.kvFallback) {
    try {
      const kvValue = await fetchCloudflareKvFallback(manifest, secret, args);
      if (kvValue.value) return kvValue;
      if (kvValue.warning) return kvValue;
    } catch (error) {
      if (secret.required === false) {
        return {
          value: "",
          source: null,
          sourceKind: null,
          warning: error instanceof Error ? error.message : String(error),
        };
      }
      throw error;
    }
  }

  return { value: "", source: null, sourceKind: null };
}

function cloudflareKvTokenCandidates(fallback) {
  const names = ["CLOUDFLARE_SYNC_AUTH_TOKEN", fallback.tokenEnv, "CLOUDFLARE_API_TOKEN"].filter(Boolean);
  const seen = new Set();
  const candidates = [];
  for (const name of names) {
    const value = process.env[name];
    if (!value || seen.has(value)) continue;
    seen.add(value);
    candidates.push({ name, value });
  }
  return candidates;
}

async function fetchCloudflareKvFallback(manifest, secret, args) {
  const fallback = manifest.cloudflareKvFallback;
  if (!fallback) return { value: "", source: null, sourceKind: null };

  const accountId = process.env[fallback.accountEnv];
  const tokenCandidates = cloudflareKvTokenCandidates(fallback);
  const authFailures = new Map();

  const key = secret.kvKey ?? secret.sourceEnv;
  if (accountId) {
    for (const candidate of tokenCandidates) {
      for (const namespace of fallback.namespaces ?? []) {
        const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespace.id}/values/${encodeURIComponent(key)}`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${candidate.value}` },
        });
        if (response.status === 404) continue;
        if (response.status === 401 || response.status === 403) {
          authFailures.set(candidate.name, `HTTP ${response.status}`);
          continue;
        }
        if (!response.ok) {
          throw new Error(`Cloudflare KV fallback failed for ${secret.id} in ${namespace.name}: HTTP ${response.status}`);
        }
        const value = await response.text();
        if (value) return { value, source: `${namespace.name}/${key}`, sourceKind: "cloudflare-kv" };
      }
    }
  }

  if ((args.cloudflareAuth === "wrangler" || args.cloudflareAuth === "auto") && secret.required !== false) {
    const wranglerValue = await fetchCloudflareKvFallbackWithWrangler(fallback, key);
    if (wranglerValue.value) return wranglerValue;
    if (wranglerValue.warning) return wranglerValue;
  }

  if (authFailures.size > 0) {
    const summary = Array.from(authFailures, ([name, status]) => `${name}:${status}`).join(", ");
    return {
      value: "",
      source: null,
      sourceKind: null,
      warning: `Cloudflare KV fallback auth failed for ${secret.id}: ${summary}`,
    };
  }

  return { value: "", source: null, sourceKind: null };
}

async function fetchCloudflareKvFallbackWithWrangler(fallback, key) {
  const wrangler = resolveBin("wrangler");
  const authEnv = {
    CLOUDFLARE_API_TOKEN: null,
    CLOUDFLARE_SYNC_AUTH_TOKEN: null,
    CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN: null,
  };
  const failures = [];
  for (const namespace of fallback.namespaces ?? []) {
    try {
      const result = await run(wrangler, ["kv", "key", "get", "--namespace-id", namespace.id, key], "", authEnv);
      const value = result.stdout.replace(/\r?\n$/, "");
      if (value) return { value, source: `${namespace.name}/${key}`, sourceKind: "cloudflare-kv-wrangler" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/not found|10009|key not found/i.test(message)) continue;
      failures.push(`${namespace.name}: ${message.trim().split(/\r?\n/).slice(-1)[0] || "command failed"}`);
    }
  }

  if (failures.length > 0) {
    return {
      value: "",
      source: null,
      sourceKind: null,
      warning: `Cloudflare KV fallback via Wrangler failed: ${failures.join("; ")}`,
    };
  }

  return { value: "", source: null, sourceKind: null };
}

function fingerprint(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function formatTarget(target) {
  if (target.kind === "cloudflare") {
    const env = target.env ? `:${target.env}` : "";
    return `cloudflare:${target.config}${env}:${target.name}`;
  }
  return `github-${target.kind}:${target.repo}:${target.name}`;
}

async function buildPlan(manifest, values, args) {
  const rows = [];
  const selectedSecrets = manifest.secrets.filter((secret) => args.only.size === 0 || args.only.has(secret.id) || args.only.has(secret.sourceEnv));

  for (const secret of selectedSecrets) {
    const targets = collectTargets(manifest, secret, args.target);
    const resolved = await resolveSecretValue(manifest, secret, values, args);
    rows.push({ secret, targets, ...resolved });
  }

  return rows;
}

function printPlan(rows, args) {
  for (const row of rows) {
    const required = row.secret.required !== false;
    const status = row.value ? "ready" : required ? "missing" : "optional-missing";
    const fp = args.fingerprints && row.value ? ` fingerprint=${fingerprint(row.value)}` : "";
    const source = row.source ? ` source=${row.sourceKind}:${row.source}` : "";
    const warning = row.warning ? ` warning="${row.warning}"` : "";
    const targetSummary = `${row.targets.length} target${row.targets.length === 1 ? "" : "s"}`;
    console.log(`[${status}] ${row.secret.id} (${row.secret.sourceEnv}) -> ${targetSummary}${source}${fp}${warning}`);
    for (const target of row.targets) {
      const marker = target.deprecated ? " deprecated" : "";
      console.log(`  - ${formatTarget(target)}${marker}`);
    }
  }
}

function serializePlan(rows, args) {
  return rows.map((row) => {
    const required = row.secret.required !== false;
    const status = row.value ? "ready" : required ? "missing" : "optional-missing";
    return {
      id: row.secret.id,
      canonicalName: row.secret.canonicalName ?? row.secret.sourceEnv,
      sourceEnv: row.secret.sourceEnv,
      required,
      status,
      hasValue: Boolean(row.value),
      sourceKind: row.sourceKind,
      source: row.source,
      warning: row.warning ?? null,
      fingerprint: args.fingerprints && row.value ? fingerprint(row.value) : null,
      targets: row.targets.map((target) => ({
        ...target,
        label: formatTarget(target),
      })),
    };
  });
}

function assertRequiredValues(rows, strict) {
  const missing = rows.filter((row) => row.secret.required !== false && !row.value);
  if (missing.length > 0 && strict) {
    throw new Error(`Missing required secret source values: ${missing.map((row) => row.secret.sourceEnv).join(", ")}`);
  }
}

function resolveBin(name) {
  const extension = process.platform === "win32" ? ".CMD" : "";
  const local = resolve("node_modules", ".bin", `${name}${extension}`);
  return existsSync(local) ? local : name;
}

function deleteEnvKey(env, key) {
  const target = key.toLowerCase();
  for (const existing of Object.keys(env)) {
    if (existing.toLowerCase() === target) delete env[existing];
  }
}

function buildEnv(extraEnv = {}) {
  const env = { ...process.env };
  for (const [key, value] of Object.entries(extraEnv)) {
    if (value === null || value === undefined) {
      deleteEnvKey(env, key);
      continue;
    }
    env[key] = value;
  }
  return env;
}

function run(command, args, input, extraEnv = {}) {
  return new Promise((resolvePromise, reject) => {
    const useShell = process.platform === "win32" && /\.cmd$/i.test(command);
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: buildEnv(extraEnv),
      shell: useShell,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
      } else {
        reject(new Error(`Command failed (${code}): ${command} ${args.join(" ")}\n${stdout}${stderr}`));
      }
    });
    child.stdin.end(input);
  });
}

async function commandSucceeds(command, args, extraEnv = {}) {
  try {
    await run(command, args, "", extraEnv);
    return true;
  } catch {
    return false;
  }
}

function resolveCloudflareAuth(args) {
  if (args.cloudflareAuth === "wrangler") {
    return {
      mode: "wrangler",
      extraEnv: {
        CLOUDFLARE_API_TOKEN: null,
        CLOUDFLARE_SYNC_AUTH_TOKEN: null,
        CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN: null,
      },
    };
  }

  const token = process.env.CLOUDFLARE_SYNC_AUTH_TOKEN || process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN;
  if (token && args.cloudflareAuth !== "wrangler") {
    return { mode: "token", extraEnv: { CLOUDFLARE_API_TOKEN: token } };
  }

  if (args.cloudflareAuth === "token") {
    return { mode: "token", extraEnv: {} };
  }

  return {
    mode: "wrangler",
    extraEnv: {
      CLOUDFLARE_API_TOKEN: null,
      CLOUDFLARE_SYNC_AUTH_TOKEN: null,
      CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN: null,
    },
  };
}

function githubTokenPresent() {
  return Boolean(process.env.GH_TOKEN || process.env.GITHUB_TOKEN);
}

function resolveGithubAuth(args) {
  if (args.githubAuth === "token") {
    return {
      mode: "token",
      extraEnv: {},
    };
  }

  if (args.githubAuth === "auto" && githubTokenPresent()) {
    return {
      mode: "token",
      extraEnv: {},
    };
  }

  return {
    mode: "cli",
    extraEnv: {
      GH_TOKEN: null,
      GITHUB_TOKEN: null,
    },
  };
}

async function applyTarget(target, value, options) {
  if (target.kind === "actions" || target.kind === "agents") {
    const gh = resolveBin("gh");
    const auth = resolveGithubAuth(options);
    await run(gh, ["secret", "set", target.name, "--repo", target.repo, "--app", target.kind], value, auth.extraEnv);
    return;
  }

  if (target.kind === "cloudflare") {
    const wrangler = resolveBin("wrangler");
    const auth = resolveCloudflareAuth(options);
    const buildWranglerArgs = (versioned) => {
      const wranglerArgs = versioned ? ["versions", "secret", "put", target.name] : ["secret", "put", target.name];
      wranglerArgs.push("--config", target.config);
      if (target.env) wranglerArgs.push("--env", target.env);
      if (target.workerName) wranglerArgs.push("--name", target.workerName);
      return wranglerArgs;
    };
    try {
      await run(wrangler, buildWranglerArgs(false), value, auth.extraEnv);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/latest version of your Worker isn't currently deployed|wrangler versions secret put/i.test(message)) throw error;
      await run(wrangler, buildWranglerArgs(true), value, auth.extraEnv);
    }
    return;
  }

  throw new Error(`Unsupported target kind: ${target.kind}`);
}

async function applyPlan(rows, args) {
  const hasGithubTargets = rows.some((row) => row.targets.some((target) => target.kind === "actions" || target.kind === "agents"));
  const hasCloudflareTargets = rows.some((row) => row.targets.some((target) => target.kind === "cloudflare"));
  const shouldValidateAuth = !args.dryRun || args.validateAuth;
  if (shouldValidateAuth && hasGithubTargets) {
    const auth = resolveGithubAuth(args);
    if (auth.mode === "cli") {
      const gh = resolveBin("gh");
      const ghReady = await commandSucceeds(gh, ["auth", "status", "-h", "github.com"], auth.extraEnv);
      if (!ghReady) throw new Error("An authenticated GitHub CLI session is required to write GitHub secrets. Run gh auth login -h github.com or use --github-auth token with a valid GH_TOKEN.");
    } else if (!githubTokenPresent()) {
      throw new Error("GH_TOKEN or GITHUB_TOKEN is required when --github-auth token is selected.");
    } else {
      const gh = resolveBin("gh");
      const ghReady = await commandSucceeds(gh, ["auth", "status", "-h", "github.com"], auth.extraEnv);
      if (!ghReady) throw new Error("The selected GH_TOKEN/GITHUB_TOKEN is not valid for GitHub secret writes. Use --github-auth cli or refresh the token.");
    }
  }
  if (shouldValidateAuth && hasCloudflareTargets) {
    const auth = resolveCloudflareAuth(args);
    if (auth.mode === "wrangler") {
      const wrangler = resolveBin("wrangler");
      const wranglerReady = await commandSucceeds(wrangler, ["whoami"], auth.extraEnv);
      if (!wranglerReady) throw new Error("Cloudflare SSO is not ready. Run wrangler login or use Cloudflare SSO Login in the local app.");
    } else if (!process.env.CLOUDFLARE_SYNC_AUTH_TOKEN && !process.env.CLOUDFLARE_API_TOKEN && !process.env.CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN) {
      throw new Error("CLOUDFLARE_SYNC_AUTH_TOKEN, CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN, CLOUDFLARE_API_TOKEN, or Wrangler SSO is required to write Cloudflare Worker secrets.");
    }
  }

  for (const row of rows) {
    if (!row.value) {
      if (row.secret.required === false) continue;
      throw new Error(`Cannot apply missing required secret: ${row.secret.sourceEnv}`);
    }
    for (const target of row.targets) {
      if (args.dryRun) {
        console.log(`[dry-run] would set ${formatTarget(target)}`);
        continue;
      }
      console.log(`[apply] setting ${formatTarget(target)}`);
      await applyTarget(target, row.value, args);
    }
  }
}

function checkWorkflows(manifest) {
  const disallowed = new Set(manifest.policy?.disallowedWorkflowSecrets ?? []);
  const workflowDir = resolve(".github", "workflows");
  if (!existsSync(workflowDir)) return;

  const files = readdirSync(workflowDir)
    .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
    .map((file) => join(workflowDir, file))
    .filter((file) => statSync(file).isFile());

  let failures = 0;
  for (const file of files) {
    const raw = readFileSync(file, "utf8");
    for (const match of raw.matchAll(WORKFLOW_SECRET_RE)) {
      if (disallowed.has(match[1])) {
        console.error(`[workflow-secret] ${file}: disallowed secret reference secrets.${match[1]}`);
        failures += 1;
      }
    }
  }

  if (failures > 0) {
    throw new Error(`Found ${failures} disallowed workflow secret reference${failures === 1 ? "" : "s"}.`);
  }
  console.log("Workflow secret-name check passed.");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { manifest, manifestPath } = loadManifest(args.manifest);
  if (!args.json) console.log(`Secret sync manifest: ${manifestPath}`);

  if (args.command === "check") {
    checkWorkflows(manifest);
    return;
  }

  const values = loadValues(manifest, args.valuesFiles);
  const rows = await buildPlan(manifest, values, args);
  if (args.json) {
    console.log(
      JSON.stringify(
        {
          manifestPath,
          generatedAt: new Date().toISOString(),
          rows: serializePlan(rows, args),
        },
        null,
        2,
      ),
    );
  } else {
    printPlan(rows, args);
  }
  assertRequiredValues(rows, args.strict);

  if (args.command === "apply") {
    await applyPlan(rows, args);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
