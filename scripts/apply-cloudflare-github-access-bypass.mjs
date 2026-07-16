#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const API = "https://api.cloudflare.com/client/v4";
const DEFAULT_ACCOUNT_ID = "f77de112d2019e5456a3198a8bb50bd2";
const DEFAULT_RUNTIME_FILE = "env.secrets.runtime.json";

const TOKEN_ENV_NAMES = [
  "CLOUDFLARE_SYNC_AUTH_TOKEN",
  "CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN",
  "CLOUDFLARE_API_TOKEN",
];

const PUBLIC_APPS = [
  {
    name: "Goldshore API Public - GitHub OAuth Callback",
    domain: "api.goldshore.ai/oauth/github/callback",
    policyName: "Bypass GitHub OAuth callback",
  },
  {
    name: "Goldshore API Public - GitHub Webhook",
    domain: "api.goldshore.ai/webhook/github",
    policyName: "Bypass GitHub webhook receiver",
  },
];

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run"),
    runtimeFile: valueAfter(argv, "--runtime-file") || DEFAULT_RUNTIME_FILE,
    accountId: valueAfter(argv, "--account-id") || "",
  };
}

function valueAfter(argv, flag) {
  const inline = argv.find((arg) => arg.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : "";
}

function loadJsonFile(path) {
  const fullPath = resolve(path);
  if (!existsSync(fullPath)) return {};
  const raw = readFileSync(fullPath, "utf8");
  return raw.trim() ? JSON.parse(raw) : {};
}

function loadAuth(args) {
  const runtime = loadJsonFile(args.runtimeFile);
  const accountId = args.accountId || runtime.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || DEFAULT_ACCOUNT_ID;
  const tokenName = TOKEN_ENV_NAMES.find((name) => runtime[name] || process.env[name]);
  const token = tokenName ? runtime[tokenName] || process.env[tokenName] : "";

  if (!token) {
    throw new Error(`Missing Cloudflare API token. Tried: ${TOKEN_ENV_NAMES.join(", ")}`);
  }

  return { accountId, token, tokenName: tokenName ? `${runtime[tokenName] ? "runtime" : "env"}:${tokenName}` : "" };
}

async function cf(auth, method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const errors = Array.isArray(payload.errors) ? payload.errors.map((error) => error.message || error.code).join("; ") : "";
    throw new Error(`Cloudflare ${method} ${path} failed: HTTP ${response.status}${errors ? `: ${errors}` : ""}`);
  }
  return payload.result;
}

function bypassPolicy(name, precedence = 1) {
  return {
    name,
    decision: "bypass",
    include: [{ everyone: {} }],
    exclude: [],
    require: [],
    precedence,
  };
}

function appPayload(app) {
  return {
    name: app.name,
    type: "self_hosted",
    domain: app.domain,
    self_hosted_domains: [app.domain],
    app_launcher_visible: false,
    auto_redirect_to_identity: false,
    session_duration: "24h",
    policies: [bypassPolicy(app.policyName)],
  };
}

function findApp(apps, desired) {
  return apps.find((app) => {
    const domains = [app.domain, ...(Array.isArray(app.self_hosted_domains) ? app.self_hosted_domains : [])].filter(Boolean);
    return app.name === desired.name || domains.includes(desired.domain);
  });
}

async function ensureBypassPolicy(auth, app, desired, dryRun) {
  const detail = await cf(auth, "GET", `/accounts/${auth.accountId}/access/apps/${app.id}`);
  const policies = Array.isArray(detail.policies) ? detail.policies : [];
  const hasBypass = policies.some((policy) => policy.decision === "bypass" && Array.isArray(policy.include) && policy.include.some((rule) => rule.everyone));

  if (hasBypass) {
    return { action: "reused", appId: app.id, appName: app.name, domain: desired.domain, policy: "present" };
  }

  if (dryRun) {
    return { action: "would-create-policy", appId: app.id, appName: app.name, domain: desired.domain, policy: desired.policyName };
  }

  const policy = await cf(auth, "POST", `/accounts/${auth.accountId}/access/apps/${app.id}/policies`, bypassPolicy(desired.policyName, policies.length + 1));
  return { action: "created-policy", appId: app.id, appName: app.name, domain: desired.domain, policyId: policy.id };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const auth = loadAuth(args);
  const apps = await cf(auth, "GET", `/accounts/${auth.accountId}/access/apps?per_page=100`);
  const results = [];

  for (const desired of PUBLIC_APPS) {
    const existing = findApp(apps, desired);
    if (existing) {
      results.push(await ensureBypassPolicy(auth, existing, desired, args.dryRun));
      continue;
    }

    if (args.dryRun) {
      results.push({ action: "would-create-app", appName: desired.name, domain: desired.domain });
      continue;
    }

    const created = await cf(auth, "POST", `/accounts/${auth.accountId}/access/apps`, appPayload(desired));
    results.push({ action: "created-app", appId: created.id, appName: created.name, domain: desired.domain });
  }

  console.log(JSON.stringify({
    ok: true,
    dryRun: args.dryRun,
    accountId: auth.accountId,
    authSource: auth.tokenName,
    results,
    note: "No token or secret values were printed.",
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message, note: "No token or secret values were printed." }, null, 2));
  process.exit(1);
});
