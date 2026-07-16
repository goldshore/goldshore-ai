#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const API = "https://api.cloudflare.com/client/v4";
const DEFAULT_ACCOUNT_ID = "f77de112d2019e5456a3198a8bb50bd2";
const DEFAULT_RUNTIME_FILE = "env.secrets.runtime.json";
const AGENT_SERVICE_TOKEN_CLIENT_ID = "9ca952086adc30cf53634d78d099ce58.access";

const TOKEN_ENV_NAMES = [
  "CLOUDFLARE_GOLDCLAW_AGENT_ADMIN_TOKEN",
  "CLOUDFLARE_AGENT_ADMIN_TOKEN",
  "CLOUDFLARE_SYNC_AUTH_TOKEN",
  "CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN",
  "CLOUDFLARE_API_TOKEN",
];

const HUMAN_EMAILS = [
  "goldshorelabs@gmail.com",
  "marstonr6@gmail.com",
  "admin@goldshore.org",
];

const HUMAN_EMAIL_DOMAINS = ["goldshore.ai"];

const SELF_HOSTED_APPS = [
  {
    name: "GoldShore-Admin-ZT",
    domains: ["admin.goldshore.ai", "admin.goldshore.org", "admin-preview.goldshore.ai"],
    idps: ["google", "githubDeploy", "githubGeneric", "otp"],
  },
  {
    name: "Goldshore Ops",
    domains: ["ops.goldshore.ai"],
    idps: ["google", "githubDeploy", "githubGeneric", "otp"],
  },
  {
    name: "GoldShore-Web-Preview",
    domains: ["preview.goldshore.ai"],
    idps: ["google", "githubDeploy", "githubGeneric", "otp"],
  },
  {
    name: "GoldShore-Trading-ZT",
    domains: ["trading.goldshore.ai", "dashboard.goldshore.ai", "dash.goldshore.ai"],
    idps: ["google", "githubDeploy", "githubGeneric", "otp"],
  },
];

const BYPASS_APPS = [
  {
    name: "GoldShore Trading Public Bypass",
    domains: [
      "trading.goldshore.ai/health",
      "trading.goldshore.ai/version",
      "trading.goldshore.ai/oauth/schwab/callback",
      "trading.goldshore.ai/oauth/robinhood/callback",
      "dashboard.goldshore.ai/health",
      "dashboard.goldshore.ai/version",
      "dashboard.goldshore.ai/oauth/schwab/callback",
      "dashboard.goldshore.ai/oauth/robinhood/callback",
      "dash.goldshore.ai/health",
      "dash.goldshore.ai/version",
      "dash.goldshore.ai/oauth/schwab/callback",
      "dash.goldshore.ai/oauth/robinhood/callback",
    ],
  },
];

function parseArgs(argv) {
  return {
    apply: argv.includes("--apply"),
    accountId: valueAfter(argv, "--account-id") || "",
    runtimeFile: valueAfter(argv, "--runtime-file") || DEFAULT_RUNTIME_FILE,
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
  const accountId =
    args.accountId || runtime.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || DEFAULT_ACCOUNT_ID;
  const tokenName = TOKEN_ENV_NAMES.find((name) => runtime[name] || process.env[name]);
  const token = tokenName ? runtime[tokenName] || process.env[tokenName] : "";
  if (!token) throw new Error(`Missing Cloudflare API token. Tried: ${TOKEN_ENV_NAMES.join(", ")}`);
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
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok || payload.success === false) {
    const errors = Array.isArray(payload.errors)
      ? payload.errors.map((error) => `${error.code ?? ""}:${error.message ?? "Cloudflare API error"}`).join("; ")
      : `HTTP ${response.status}`;
    throw new Error(`Cloudflare ${method} ${path} failed: ${errors}`);
  }
  return payload.result;
}

function domainsOf(app) {
  return [app.domain, ...(Array.isArray(app.self_hosted_domains) ? app.self_hosted_domains : [])]
    .filter(Boolean)
    .map(String);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function idpMap(idps) {
  const github = idps.filter((idp) => idp.type === "github");
  const deploy =
    github.find((idp) => /deploy/i.test(idp.name || "")) ||
    github.find((idp) => /gold shore|goldshore/i.test(idp.name || "")) ||
    github[0];
  const generic = github.find((idp) => idp.id !== deploy?.id) || deploy;
  return {
    google: idps.find((idp) => idp.type === "google")?.id,
    githubDeploy: deploy?.id,
    githubGeneric: generic?.id,
    otp: idps.find((idp) => idp.type === "onetimepin")?.id,
  };
}

function humanIncludes() {
  return [
    ...HUMAN_EMAIL_DOMAINS.map((domain) => ({ email_domain: { domain } })),
    ...HUMAN_EMAILS.map((email) => ({ email: { email } })),
  ];
}

function humanPolicy(name, precedence = 2) {
  return {
    name,
    decision: "allow",
    include: humanIncludes(),
    exclude: [],
    require: [],
    precedence,
  };
}

function servicePolicy(tokenId, precedence = 1) {
  return {
    name: "Agent Service Token",
    decision: "non_identity",
    include: [{ service_token: { token_id: tokenId } }],
    exclude: [],
    require: [],
    precedence,
  };
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

function appPayload(def, allowedIdps, policies) {
  return {
    name: def.name,
    type: "self_hosted",
    domain: def.domains[0],
    self_hosted_domains: def.domains,
    allowed_idps: allowedIdps,
    app_launcher_visible: true,
    auto_redirect_to_identity: false,
    session_duration: "24h",
    policies,
  };
}

function findApp(apps, def) {
  return apps.find((app) => app.name === def.name) ||
    apps.find((app) => def.domains.some((domain) => domainsOf(app).includes(domain)));
}

async function ensureApp(auth, apps, def, policies, allowedIdps, apply) {
  const existing = findApp(apps, def);
  const payload = appPayload(def, allowedIdps, policies);
  if (!apply) {
    return {
      action: existing ? "would-update-app" : "would-create-app",
      name: def.name,
      domains: def.domains,
    };
  }
  if (existing) {
    const updated = await cf(auth, "PUT", `/accounts/${auth.accountId}/access/apps/${existing.id}`, payload);
    return { action: "updated-app", name: updated.name, id: updated.id, domains: def.domains };
  }
  const created = await cf(auth, "POST", `/accounts/${auth.accountId}/access/apps`, payload);
  apps.push(created);
  return { action: "created-app", name: created.name, id: created.id, domains: def.domains };
}

function hasSelector(selectors, key, value) {
  return selectors.some((selector) => {
    if (key === "email") return selector.email?.email?.toLowerCase() === value.toLowerCase();
    if (key === "email_domain") return selector.email_domain?.domain?.toLowerCase() === value.toLowerCase();
    return false;
  });
}

function mergedHumanIncludes(existing = []) {
  const selectors = Array.isArray(existing) ? [...existing] : [];
  for (const domain of HUMAN_EMAIL_DOMAINS) {
    if (!hasSelector(selectors, "email_domain", domain)) selectors.push({ email_domain: { domain } });
  }
  for (const email of HUMAN_EMAILS) {
    if (!hasSelector(selectors, "email", email)) selectors.push({ email: { email } });
  }
  return selectors.filter((selector) => !selector.everyone);
}

async function ensureMcpPolicies(auth, apps, tokenId, apply) {
  const app = apps.find((candidate) => candidate.name === "Goldshore MCP Portal");
  if (!app) return [{ action: "missing-mcp-app" }];
  const detail = await cf(auth, "GET", `/accounts/${auth.accountId}/access/apps/${app.id}`);
  const policies = Array.isArray(detail.policies) ? detail.policies : [];
  const results = [];

  const service = policies.find((policy) => policy.name === "Service Login") || policies.find((policy) => policy.name === "Agent Service Token");
  const servicePayload = servicePolicy(tokenId, 1);
  if (apply && service) {
    const updated = await cf(auth, "PUT", `/accounts/${auth.accountId}/access/apps/${app.id}/policies/${service.id}`, servicePayload);
    results.push({ action: "updated-mcp-service-policy", policy: updated.name, id: updated.id });
  } else if (apply) {
    const created = await cf(auth, "POST", `/accounts/${auth.accountId}/access/apps/${app.id}/policies`, servicePayload);
    results.push({ action: "created-mcp-service-policy", policy: created.name, id: created.id });
  } else {
    results.push({ action: service ? "would-update-mcp-service-policy" : "would-create-mcp-service-policy" });
  }

  const human =
    policies.find((policy) => policy.name === "Cloudflare Workers Preview URLs") ||
    policies.find((policy) => /human|mcp/i.test(policy.name || "") && policy.decision === "allow");
  const humanPayload = {
    ...(humanPolicy("GoldShore-MCP-ZT Human Access", 2)),
    include: mergedHumanIncludes(human?.include),
  };
  if (apply && human) {
    const updated = await cf(auth, "PUT", `/accounts/${auth.accountId}/access/apps/${app.id}/policies/${human.id}`, humanPayload);
    results.push({ action: "updated-mcp-human-policy", policy: updated.name, id: updated.id });
  } else if (apply) {
    const created = await cf(auth, "POST", `/accounts/${auth.accountId}/access/apps/${app.id}/policies`, humanPayload);
    results.push({ action: "created-mcp-human-policy", policy: created.name, id: created.id });
  } else {
    results.push({ action: human ? "would-update-mcp-human-policy" : "would-create-mcp-human-policy" });
  }

  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const auth = loadAuth(args);
  const [idps, serviceTokens, apps] = await Promise.all([
    cf(auth, "GET", `/accounts/${auth.accountId}/access/identity_providers?per_page=100`),
    cf(auth, "GET", `/accounts/${auth.accountId}/access/service_tokens?per_page=100`),
    cf(auth, "GET", `/accounts/${auth.accountId}/access/apps?per_page=100`),
  ]);
  const ids = idpMap(idps);
  const missingIdps = Object.entries(ids).filter(([, id]) => !id).map(([name]) => name);
  if (missingIdps.length > 0) throw new Error(`Missing required IdP(s): ${missingIdps.join(", ")}`);
  const serviceToken = serviceTokens.find((token) => token.client_id === AGENT_SERVICE_TOKEN_CLIENT_ID);
  if (!serviceToken) throw new Error("Could not find Agent Service Token by client_id.");

  const results = [];
  for (const def of SELF_HOSTED_APPS) {
    const allowedIdps = unique(def.idps.map((name) => ids[name]));
    results.push(
      await ensureApp(
        auth,
        apps,
        def,
        [servicePolicy(serviceToken.id, 1), humanPolicy(`${def.name} Human Access`, 2)],
        allowedIdps,
        args.apply,
      ),
    );
  }
  for (const def of BYPASS_APPS) {
    results.push(
      await ensureApp(
        auth,
        apps,
        def,
        [bypassPolicy(`${def.name} Policy`, 1)],
        [],
        args.apply,
      ),
    );
  }
  results.push(...(await ensureMcpPolicies(auth, apps, serviceToken.id, args.apply)));

  console.log(JSON.stringify({
    ok: true,
    applied: args.apply,
    accountId: auth.accountId,
    authSource: auth.tokenName,
    identityProviders: {
      google: ids.google,
      githubDeploy: ids.githubDeploy,
      githubGeneric: ids.githubGeneric,
      otp: ids.otp,
    },
    serviceToken: {
      id: serviceToken.id,
      name: serviceToken.name,
      client_id: serviceToken.client_id,
    },
    results,
    note: "No API token, OAuth client secret, or Access service-token secret values were printed.",
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    note: "No token or secret values were printed.",
  }, null, 2));
  process.exit(1);
});
