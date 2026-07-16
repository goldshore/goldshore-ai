#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";

const API = "https://api.cloudflare.com/client/v4";
const DEFAULT_ACCOUNT_ID = "f77de112d2019e5456a3198a8bb50bd2";
const DEFAULT_DESIRED_STATE = "infra/Cloudflare/desired-state.yaml";
const DEFAULT_RUNTIME_FILE = "env.secrets.runtime.json";

const TOKEN_ENV_NAMES = [
  "CLOUDFLARE_GOLDCLAW_AGENT_ADMIN_TOKEN",
  "CLOUDFLARE_AGENT_ADMIN_TOKEN",
  "CLOUDFLARE_SYNC_AUTH_TOKEN",
  "CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN",
  "CLOUDFLARE_API_TOKEN",
];

const DOC_EXPECTED_APPS = [
  {
    source: "docs/domains-and-auth.md",
    name: "GoldShore-MCP-ZT",
    domains: ["mcp.goldshore.ai"],
    action: "allow",
    rules: {
      include: [{ email_domain: "goldshore.ai" }, { email: "marstonr6@gmail.com" }],
      allowed_identity_providers: ["github_goldshore_deploy", "github", "email_otp"],
    },
    notes: ["Documented private MCP surface is not currently encoded in desired-state.yaml."],
  },
];

const IDP_REQUIREMENTS = {
  google_workspace: { types: ["google"], label: "Google Workspace / Google" },
  github_goldshore_deploy: { types: ["github"], label: "GitHub GoldShore Deploy" },
  github: { types: ["github"], label: "GitHub" },
  email_otp: { types: ["onetimepin"], label: "Email OTP" },
};

function parseArgs(argv) {
  const args = {
    accountId: "",
    desiredState: DEFAULT_DESIRED_STATE,
    runtimeFile: DEFAULT_RUNTIME_FILE,
    outDir: "reports",
    smoke: true,
    timeoutMs: 8000,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [flag, inlineValue] = arg.split("=", 2);
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${flag}`);
      return argv[index];
    };

    switch (flag) {
      case "--account-id":
        args.accountId = readValue();
        break;
      case "--desired-state":
        args.desiredState = readValue();
        break;
      case "--runtime-file":
        args.runtimeFile = readValue();
        break;
      case "--out-dir":
        args.outDir = readValue();
        break;
      case "--timeout-ms":
        args.timeoutMs = Number(readValue());
        if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
          throw new Error("--timeout-ms must be a positive number");
        }
        break;
      case "--skip-smoke":
        args.smoke = false;
        break;
      case "--json":
        args.json = true;
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return args;
}

function printUsage() {
  console.log(`Audit Cloudflare Zero Trust Access applications and host behavior.

Usage:
  node scripts/audit-cloudflare-access-policies.mjs
  node scripts/audit-cloudflare-access-policies.mjs --json
  node scripts/audit-cloudflare-access-policies.mjs --skip-smoke

The audit reads Cloudflare Access app/policy metadata and writes sanitized
reports under reports/. It never prints or writes API tokens or service-token
secrets.
`);
}

function loadJsonFile(path) {
  const fullPath = resolve(path);
  if (!existsSync(fullPath)) return {};
  const raw = readFileSync(fullPath, "utf8");
  return raw.trim() ? JSON.parse(raw) : {};
}

function loadDesiredState(path) {
  const fullPath = resolve(path);
  const parsed = YAML.parse(readFileSync(fullPath, "utf8"));
  const accessPolicies = parsed?.cloudflare?.access?.policies;
  if (!Array.isArray(accessPolicies)) {
    throw new Error(`No cloudflare.access.policies array found in ${fullPath}`);
  }
  return { desiredState: parsed, desiredStatePath: fullPath };
}

function valueFromSources(name, runtimeSecrets) {
  return process.env[name] || runtimeSecrets[name] || "";
}

function collectTokenCandidates(runtimeSecrets) {
  const byValue = new Map();
  for (const source of ["process", "runtime"]) {
    for (const name of TOKEN_ENV_NAMES) {
      const value = source === "process" ? process.env[name] : runtimeSecrets[name];
      if (!value || typeof value !== "string" || !value.trim()) continue;
      const token = value.trim();
      const candidate = byValue.get(token) || { token, sources: [] };
      candidate.sources.push(`${source}:${name}`);
      byValue.set(token, candidate);
    }
  }
  return Array.from(byValue.values());
}

async function cf(token, method, path) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text.slice(0, 300) };
    }
  }
  if (!response.ok || payload?.success === false) {
    const errors = Array.isArray(payload?.errors)
      ? payload.errors.map((error) => `${error.code ?? "unknown"}:${error.message ?? "Cloudflare API error"}`).join("; ")
      : `HTTP ${response.status}`;
    throw new Error(errors);
  }
  return payload;
}

async function chooseToken(candidates, accountId) {
  const failures = [];
  for (const candidate of candidates) {
    try {
      await cf(candidate.token, "GET", "/user/tokens/verify");
      await cf(candidate.token, "GET", `/accounts/${accountId}/access/apps?per_page=100`);
      return candidate;
    } catch (error) {
      failures.push({
        sources: candidate.sources,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  throw new Error(
    `No usable Cloudflare token could list Access applications. Tried: ${failures
      .map((failure) => `${failure.sources.join(",")} -> ${failure.error}`)
      .join(" | ")}`,
  );
}

async function listAccessApps(token, accountId) {
  const apps = [];
  let page = 1;
  let totalPages = 1;

  do {
    const payload = await cf(token, "GET", `/accounts/${accountId}/access/apps?per_page=100&page=${page}`);
    apps.push(...(payload.result || []));
    totalPages = payload.result_info?.total_pages || 1;
    page += 1;
  } while (page <= totalPages);

  return apps;
}

async function listAccessPolicies(token, accountId, app) {
  try {
    const payload = await cf(token, "GET", `/accounts/${accountId}/access/apps/${app.id}/policies?per_page=100`);
    return payload.result || [];
  } catch {
    return Array.isArray(app.policies) ? app.policies : [];
  }
}

async function listIdentityProviders(token, accountId) {
  const payload = await cf(token, "GET", `/accounts/${accountId}/access/identity_providers?per_page=100`);
  return payload.result || [];
}

function normalizeDesiredPolicies(desiredState) {
  const yamlPolicies = desiredState.cloudflare.access.policies.map((policy) => ({
    ...policy,
    source: "infra/Cloudflare/desired-state.yaml",
    domains: normalizeList(policy.domains || policy.domain),
    paths: normalizeList(policy.paths),
    public_paths: normalizeList(policy.public_paths),
    rules: policy.rules || {},
  }));

  const yamlDomains = new Set(yamlPolicies.flatMap((policy) => policy.domains.map((domain) => hostFromPattern(domain))));
  const documentedOnly = DOC_EXPECTED_APPS.filter((policy) =>
    policy.domains.every((domain) => !yamlDomains.has(hostFromPattern(domain))),
  );

  return [...yamlPolicies, ...documentedOnly];
}

function normalizeList(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

function appDomains(app) {
  const values = new Set();
  for (const value of normalizeList(app.domain)) values.add(value);
  for (const value of normalizeList(app.domains)) values.add(value);
  for (const value of normalizeList(app.self_hosted_domains)) values.add(value);
  for (const destination of app.destinations || []) {
    if (destination?.uri) values.add(destination.uri);
  }
  return Array.from(values).map(String).filter(Boolean);
}

function hostFromPattern(value) {
  const trimmed = String(value || "").trim().toLowerCase();
  if (!trimmed) return "";
  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).hostname.toLowerCase();
  } catch {
    return trimmed.split("/")[0].toLowerCase();
  }
}

function pathFromPattern(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return url.pathname === "/" ? "" : url.pathname;
  } catch {
    const slash = trimmed.indexOf("/");
    return slash === -1 ? "" : trimmed.slice(slash);
  }
}

function wildcardMatches(pattern, host) {
  const normalizedPattern = hostFromPattern(pattern);
  const normalizedHost = hostFromPattern(host);
  if (!normalizedPattern.includes("*")) return false;
  const escaped = normalizedPattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[^.]+");
  return new RegExp(`^${escaped}$`, "i").test(normalizedHost);
}

function isAcceptableAccessType(app, desired) {
  if (desired.domains?.some((domain) => domain.startsWith("mcp."))) {
    return ["mcp", "mcp_portal", "self_hosted"].includes(app.type);
  }
  return app.type === "self_hosted";
}

function decisionOf(policy) {
  return String(policy.decision || policy.action || "").toLowerCase();
}

function selectorEntries(policy, key) {
  return normalizeList(policy[key]).flatMap((entry) => (entry && typeof entry === "object" ? [entry] : []));
}

function selectorHasEmail(selectors, email) {
  return selectors.some((selector) => {
    const value = selector.email?.email || selector.email;
    return typeof value === "string" && value.toLowerCase() === email.toLowerCase();
  });
}

function selectorHasEmailDomain(selectors, domain) {
  return selectors.some((selector) => {
    const value = selector.email_domain?.domain || selector.email_domain;
    return typeof value === "string" && value.toLowerCase() === domain.toLowerCase();
  });
}

function selectorHasEveryone(selectors) {
  return selectors.some((selector) => selector.everyone !== undefined);
}

function selectorHasServiceTokenOrMtls(selectors) {
  return selectors.some(
    (selector) =>
      selector.service_token !== undefined ||
      selector.service_tokens !== undefined ||
      selector.certificate !== undefined ||
      selector.common_name !== undefined ||
      selector.valid_certificate !== undefined,
  );
}

function sanitizeIdentityProviders(idps) {
  return idps.map((idp) => ({
    id: idp.id,
    name: idp.name || "",
    type: idp.type || "",
    scimEnabled: Boolean(idp.scim_enabled),
    configKeys: idp.config
      ? Object.keys(idp.config).filter((key) => !/(secret|client_secret|token|key|certificate)/i.test(key)).sort()
      : [],
  }));
}

function sanitizePolicy(policy) {
  return {
    id: policy.id,
    name: policy.name || "",
    decision: decisionOf(policy),
    precedence: policy.precedence ?? null,
    include: selectorEntries(policy, "include"),
    exclude: selectorEntries(policy, "exclude"),
    require: selectorEntries(policy, "require"),
  };
}

function sanitizeApp(app, policies) {
  return {
    id: app.id,
    name: app.name || "",
    type: app.type || "",
    aud: app.aud || app.aud_tag || "",
    domains: appDomains(app),
    hostPatterns: appDomains(app).map(hostFromPattern).filter(Boolean),
    pathPatterns: appDomains(app).map(pathFromPattern).filter(Boolean),
    allowedIdps: normalizeList(app.allowed_idps),
    policies: policies.map(sanitizePolicy),
  };
}

function evaluateIdentityProviders(desired, apps, idps) {
  const desiredAliases = normalizeList(desired.rules?.allowed_identity_providers);
  const knownById = new Map(idps.map((idp) => [idp.id, idp]));
  const accountTypes = new Set(idps.map((idp) => idp.type).filter(Boolean));
  const allowedIds = new Set(apps.flatMap((app) => app.allowedIdps || []));
  const allowedTypes =
    allowedIds.size > 0
      ? new Set(Array.from(allowedIds).map((id) => knownById.get(id)?.type).filter(Boolean))
      : new Set();

  return desiredAliases.map((alias) => {
    const requirement = IDP_REQUIREMENTS[alias];
    if (!requirement) {
      return { alias, ok: false, warning: true, detail: "Unknown desired IdP alias." };
    }
    const existsInAccount = requirement.types.some((type) => accountTypes.has(type));
    const explicitlyAllowed =
      allowedIds.size === 0 ? false : requirement.types.some((type) => allowedTypes.has(type));
    return {
      alias,
      label: requirement.label,
      existsInAccount,
      explicitlyAllowed,
      ok: existsInAccount && (apps.length === 0 || explicitlyAllowed),
      warning:
        alias === "github_goldshore_deploy" &&
        existsInAccount &&
        !idps.some((idp) => /deploy/i.test(`${idp.name || ""} ${idp.type || ""}`)),
      detail:
        allowedIds.size === 0
          ? "The matching app does not explicitly restrict allowed_idps."
          : explicitlyAllowed
            ? "Present and explicitly allowed."
            : "Present in account but not explicitly allowed on the matching app.",
    };
  });
}

function evaluateDesiredPolicy(desired, apps, idps) {
  const issues = [];
  const warnings = [...normalizeList(desired.notes)];
  const desiredDomains = normalizeList(desired.domains).map(hostFromPattern);
  const exactAppIds = new Set();
  const acceptableAppIds = new Set();
  const domainChecks = desiredDomains.map((domain) => {
    const exact = apps.filter((app) => app.hostPatterns.includes(domain));
    const acceptableExact = exact.filter((app) => isAcceptableAccessType(app, desired));
    const wildcard = apps.filter((app) => app.hostPatterns.some((pattern) => wildcardMatches(pattern, domain)));
    const wrongType = exact.filter((app) => !isAcceptableAccessType(app, desired));

    for (const app of exact) exactAppIds.add(app.id);
    for (const app of acceptableExact) acceptableAppIds.add(app.id);

    if (acceptableExact.length === 0) {
      issues.push(
        exact.length > 0
          ? `${domain} is covered only by wrong Access app type(s): ${wrongType.map((app) => `${app.name || app.id} (${app.type})`).join(", ")}.`
          : `${domain} has no exact acceptable Access application.`,
      );
    }
    if (acceptableExact.length === 0 && wildcard.length > 0) {
      warnings.push(`${domain} is only wildcard-covered by ${wildcard.map((app) => `${app.name} (${app.type})`).join(", ")}; exact app coverage is still required.`);
    }

    return {
      domain,
      ok: acceptableExact.length > 0,
      exactApps: exact.map((app) => app.name || app.id),
      acceptableExactApps: acceptableExact.map((app) => app.name || app.id),
      wildcardApps: wildcard.map((app) => `${app.name || app.id} (${app.type})`),
    };
  });

  const matchingApps = apps.filter((app) => acceptableAppIds.has(app.id));
  const exactApps = apps.filter((app) => exactAppIds.has(app.id));
  const matchingPolicies = matchingApps.flatMap((app) => app.policies.map((policy) => ({ app, policy })));

  const hasMatchingName =
    matchingApps.some((app) => app.name === desired.name) ||
    matchingPolicies.some(({ policy }) => policy.name === desired.name);
  if (!hasMatchingName) {
    warnings.push(`No exact app or policy name matches ${desired.name}.`);
  }

  const desiredIncludes = normalizeList(desired.rules?.include);
  for (const include of desiredIncludes) {
    const allowPolicies = matchingPolicies.filter(({ policy }) => decisionOf(policy) === "allow");
    const allowSelectors = allowPolicies.flatMap(({ policy }) => selectorEntries(policy, "include"));
    if (include.email && !selectorHasEmail(allowSelectors, include.email)) {
      issues.push(`Missing allow include selector for email ${include.email}.`);
    }
    if (include.email_domain && !selectorHasEmailDomain(allowSelectors, include.email_domain)) {
      issues.push(`Missing allow include selector for email domain ${include.email_domain}.`);
    }
  }

  const idpChecks = evaluateIdentityProviders(desired, matchingApps, idps);
  for (const check of idpChecks) {
    if (!check.ok && matchingApps.length > 0) {
      warnings.push(`${check.alias}: ${check.detail}`);
    }
    if (check.warning) {
      warnings.push(`${check.alias}: account has a GitHub IdP, but its name does not identify a deploy-specific IdP.`);
    }
  }

  for (const { app, policy } of matchingPolicies) {
    const include = selectorEntries(policy, "include");
    if (decisionOf(policy) === "allow" && selectorHasEveryone(include)) {
      issues.push(`Policy ${policy.name} on ${app.name} allows everyone.`);
    }
    if (decisionOf(policy) === "non_identity" && selectorHasEveryone(include) && !selectorHasServiceTokenOrMtls(include)) {
      warnings.push(`Service Auth policy ${policy.name} on ${app.name} includes everyone instead of an explicit service token or mTLS selector.`);
    }
  }

  const desiredAudience = desired.audience || "";
  if (desiredAudience) {
    const audienceMatches = matchingApps.some((app) => app.aud === desiredAudience);
    if (!audienceMatches) {
      issues.push(`AUD mismatch or missing for ${desired.name}; expected ${desiredAudience}.`);
    }
  }

  return {
    name: desired.name,
    source: desired.source,
    desiredDomains,
    action: desired.action || "",
    paths: normalizeList(desired.paths),
    publicPaths: normalizeList(desired.public_paths),
    domainChecks,
    matchingApps: matchingApps.map((app) => ({ id: app.id, name: app.name, type: app.type, aud: app.aud })),
    exactApps: exactApps.map((app) => ({ id: app.id, name: app.name, type: app.type, aud: app.aud })),
    idpChecks,
    issues,
    warnings: unique(warnings),
    ok: issues.length === 0,
  };
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildSmokeTargets(desiredPolicies) {
  const targets = [];
  const seen = new Set();
  const add = (target) => {
    const key = `${target.expectAccess}:${target.url}`;
    if (seen.has(key)) return;
    seen.add(key);
    targets.push(target);
  };

  for (const desired of desiredPolicies) {
    const domains = normalizeList(desired.domains).map(hostFromPattern);
    for (const domain of domains) {
      for (const publicPath of normalizeList(desired.public_paths)) {
        add({
          policy: desired.name,
          url: `https://${domain}${publicPath}`,
          expectAccess: false,
          expectation: "public-bypass",
        });
      }

      const protectedPaths = normalizeList(desired.paths);
      if (protectedPaths.length === 0) {
        add({
          policy: desired.name,
          url: `https://${domain}/`,
          expectAccess: true,
          expectation: "access-protected",
        });
      } else {
        for (const path of protectedPaths) {
          const concretePath = path.replace(/\*+$/g, "").replace(/\/+$/g, "") || "/";
          add({
            policy: desired.name,
            url: `https://${domain}${concretePath}`,
            expectAccess: true,
            expectation: "access-protected",
          });
        }
      }
    }
  }

  return targets;
}

async function smokeOne(target, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(target.url, {
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "goldshore-access-policy-audit/1.0" },
    });
    const location = response.headers.get("location") || "";
    const contentType = response.headers.get("content-type") || "";
    const mitigated = response.headers.get("cf-mitigated") || "";
    let body = "";
    if (/text|html|json/i.test(contentType)) {
      body = (await response.text().catch(() => "")).slice(0, 6000);
    }
    const accessWall =
      /cloudflareaccess\.com|\/cdn-cgi\/access/i.test(location) ||
      /Cloudflare Access|cf-access|cloudflareaccess\.com|\/cdn-cgi\/access/i.test(body);
    const cloudflareChallenge =
      /challenge/i.test(mitigated) || /challenges\.cloudflare\.com|Just a moment|cf-chl/i.test(body);
    const publicStatusOk =
      (response.status >= 200 && response.status < 400) ||
      (/\/oauth\//.test(target.url) && [400, 405].includes(response.status)) ||
      (/\/webhook\//.test(target.url) && [400, 404, 405].includes(response.status));
    const pass = target.expectAccess ? accessWall : !accessWall && !cloudflareChallenge && publicStatusOk;

    return {
      ...target,
      ok: pass,
      status: response.status,
      accessWall,
      cloudflareChallenge,
      location: location ? scrubUrl(location) : "",
      note: pass
        ? ""
        : target.expectAccess
          ? cloudflareChallenge
            ? "Cloudflare challenge was detected before the expected Access flow."
            : "Expected Cloudflare Access redirect/wall but did not detect one."
          : accessWall
            ? "Expected public/bypassed endpoint, but Cloudflare Access was detected."
            : cloudflareChallenge
              ? "Expected public/bypassed endpoint, but Cloudflare challenge was detected."
              : `Unexpected public endpoint status ${response.status}.`,
    };
  } catch (error) {
    return {
      ...target,
      ok: false,
      status: 0,
      accessWall: false,
      cloudflareChallenge: false,
      location: "",
      note: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function scrubUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.search = parsed.search ? "?..." : "";
    return parsed.toString();
  } catch {
    return String(url).slice(0, 200);
  }
}

function markdownReport(report) {
  const lines = [];
  lines.push("# Cloudflare Access Policy Audit");
  lines.push("");
  lines.push("Merge Strategy: Merge Commit");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Account: ${report.accountId}`);
  lines.push(`Desired state: ${report.desiredStatePath}`);
  lines.push(`Auth source names: ${report.authSources.join(", ")}`);
  lines.push("");
  lines.push("No API tokens, OAuth client secrets, or Access service-token secrets are included.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Overall: ${report.ok ? "PASS" : "FAIL"}`);
  lines.push(`- Live Access apps: ${report.summary.liveApps}`);
  lines.push(`- Desired policies checked: ${report.summary.desiredPolicies}`);
  lines.push(`- Policy/domain issues: ${report.summary.policyIssues}`);
  lines.push(`- Warnings: ${report.summary.warnings}`);
  lines.push(`- Smoke tests: ${report.summary.smokePassed}/${report.summary.smokeTotal} passed`);
  lines.push("");
  lines.push("## Desired Policy Results");
  lines.push("");
  lines.push("| Desired policy | Source | Result | Matching exact app(s) | Issues |");
  lines.push("| --- | --- | --- | --- | ---: |");
  for (const result of report.policyResults) {
    lines.push(
      `| \`${result.name}\` | ${result.source} | ${result.ok ? "PASS" : "FAIL"} | ${result.matchingApps
        .map((app) => `${app.name} (${app.type})`)
        .join("<br>") || ""} | ${result.issues.length} |`,
    );
  }
  lines.push("");
  for (const result of report.policyResults) {
    if (result.issues.length === 0 && result.warnings.length === 0) continue;
    lines.push(`### ${result.name}`);
    lines.push("");
    if (result.issues.length > 0) {
      lines.push("Issues:");
      for (const issue of result.issues) lines.push(`- ${issue}`);
      lines.push("");
    }
    if (result.warnings.length > 0) {
      lines.push("Warnings:");
      for (const warning of result.warnings) lines.push(`- ${warning}`);
      lines.push("");
    }
  }
  lines.push("## Identity Providers");
  lines.push("");
  lines.push("| Name | Type | Explicit ID |");
  lines.push("| --- | --- | --- |");
  for (const idp of report.identityProviders) {
    lines.push(`| ${idp.name || "(unnamed)"} | ${idp.type} | \`${idp.id}\` |`);
  }
  lines.push("");
  lines.push("## Host Smoke Tests");
  lines.push("");
  if (report.smokeTests.length === 0) {
    lines.push("Smoke tests were skipped.");
  } else {
    lines.push("| URL | Expectation | Status | Access wall | Challenge | Result | Note |");
    lines.push("| --- | --- | ---: | --- | --- | --- | --- |");
    for (const test of report.smokeTests) {
      lines.push(
        `| ${test.url} | ${test.expectation} | ${test.status} | ${test.accessWall ? "yes" : "no"} | ${test.cloudflareChallenge ? "yes" : "no"} | ${test.ok ? "PASS" : "FAIL"} | ${test.note || ""} |`,
      );
    }
  }
  lines.push("");
  lines.push("## Live Access Apps");
  lines.push("");
  lines.push("| App | Type | Domains | Policy decisions | AUD |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const app of report.liveApps) {
    const decisions = app.policies.map((policy) => `${policy.name}:${policy.decision}`).join("<br>");
    lines.push(
      `| ${app.name || "(unnamed)"} | ${app.type} | ${app.domains.map((domain) => `\`${domain}\``).join("<br>")} | ${decisions} | \`${app.aud || ""}\` |`,
    );
  }
  lines.push("");
  lines.push("## Next Actions");
  lines.push("");
  lines.push("- Fix missing exact Access applications before relying on wildcard app coverage.");
  lines.push("- Keep public health/version/OAuth callback routes on explicit bypass apps or path-specific Access bypass policies.");
  lines.push("- Keep alternative IdPs in app login methods or separate OR policies, not multiple Require selectors.");
  lines.push("- Re-run this audit after Cloudflare changes and attach the sanitized markdown report to the agent handoff.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function summarize(policyResults, smokeTests, liveApps) {
  return {
    liveApps: liveApps.length,
    desiredPolicies: policyResults.length,
    policyIssues: policyResults.reduce((count, result) => count + result.issues.length, 0),
    warnings: policyResults.reduce((count, result) => count + result.warnings.length, 0),
    smokeTotal: smokeTests.length,
    smokePassed: smokeTests.filter((test) => test.ok).length,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runtimeSecrets = loadJsonFile(args.runtimeFile);
  const { desiredState, desiredStatePath } = loadDesiredState(args.desiredState);
  const accountId =
    args.accountId || valueFromSources("CLOUDFLARE_ACCOUNT_ID", runtimeSecrets) || DEFAULT_ACCOUNT_ID;
  const token = await chooseToken(collectTokenCandidates(runtimeSecrets), accountId);
  const desiredPolicies = normalizeDesiredPolicies(desiredState);
  const rawApps = await listAccessApps(token.token, accountId);
  const idps = sanitizeIdentityProviders(await listIdentityProviders(token.token, accountId));

  const liveApps = [];
  for (const rawApp of rawApps) {
    const policies = await listAccessPolicies(token.token, accountId, rawApp);
    liveApps.push(sanitizeApp(rawApp, policies));
  }

  const policyResults = desiredPolicies.map((desired) => evaluateDesiredPolicy(desired, liveApps, idps));
  const smokeTargets = args.smoke ? buildSmokeTargets(desiredPolicies) : [];
  const smokeTests = [];
  for (const target of smokeTargets) {
    smokeTests.push(await smokeOne(target, args.timeoutMs));
  }

  const generatedAt = new Date().toISOString();
  const stamp = generatedAt.slice(0, 10);
  const summary = summarize(policyResults, smokeTests, liveApps);
  const report = {
    ok: policyResults.every((result) => result.ok) && smokeTests.every((test) => test.ok),
    generatedAt,
    accountId,
    desiredStatePath,
    authSources: token.sources,
    summary,
    identityProviders: idps,
    policyResults,
    smokeTests,
    liveApps: liveApps.sort((a, b) => a.name.localeCompare(b.name)),
  };

  mkdirSync(resolve(args.outDir), { recursive: true });
  const jsonPath = resolve(args.outDir, `cloudflare-access-policy-audit-${stamp}.json`);
  const markdownPath = resolve(args.outDir, `cloudflare-access-policy-audit-${stamp}.md`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdownPath, markdownReport(report));

  const output = {
    ok: report.ok,
    jsonPath,
    markdownPath,
    summary,
    authSources: report.authSources,
    note: "No token or secret values were written.",
  };
  console.log(args.json ? JSON.stringify(output, null, 2) : `Wrote ${markdownPath}\nWrote ${jsonPath}`);
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
