#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const API = "https://api.cloudflare.com/client/v4";
const DEFAULT_ACCOUNT_ID = "f77de112d2019e5456a3198a8bb50bd2";
const DEFAULT_RUNTIME_FILE = "env.secrets.runtime.json";

const TOKEN_ENV_NAMES = [
  "CLOUDFLARE_GOLDCLAW_AGENT_ADMIN_TOKEN",
  "CLOUDFLARE_AGENT_ADMIN_TOKEN",
  "CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN",
  "CLOUDFLARE_SYNC_AUTH_TOKEN",
  "CLOUDFLARE_API_TOKEN",
];

const ZONES = [
  {
    name: "goldshore.ai",
    idEnv: "CLOUDFLARE_GOLDSHORE_AI_ZONE_ID",
    aliases: ["CLOUDFLARE_ZONE_ID", "CF_ZONE_ID"],
    defaultId: "80e5c7c62d36a73f7a0e31bb3cd9223a",
  },
  {
    name: "goldshore.org",
    idEnv: "CLOUDFLARE_GOLDSHORE_ORG_ZONE_ID",
    aliases: [],
    defaultId: "5a9fdec7da4d4e4c53e44bf50a8aeb27",
  },
  {
    name: "rmarston.com",
    idEnv: "CLOUDFLARE_RMARSTON_COM_ZONE_ID",
    aliases: [],
    defaultId: "13bd16969996573b7796efe18ba9620c",
  },
  {
    name: "banproof.me",
    idEnv: "CLOUDFLARE_BANPROOF_ME_ZONE_ID",
    aliases: [],
    defaultId: "b896df036fb26d299094e2fbf2946735",
  },
];

const PERMISSION_CONTRACT = [
  ["API token introspection", [/^API Tokens (Read|Write|Edit)$/]],
  ["user details read", [/^User Details Read$/]],
  ["memberships read", [/^Memberships Read$/]],
  ["account settings read", [/^Account Settings (Read|Write|Edit)$/]],
  ["workers scripts write", [/^Workers Scripts (Write|Edit)$/]],
  ["workers KV write", [/^Workers KV Storage (Write|Edit)$/]],
  ["Cloudflare OAuth clients write", [/^OAuth Clients (Write|Edit)$/]],
  [
    "Zero Trust / Access apps write",
    [/^Zero Trust (Write|Edit)$/, /^Access: Apps and Policies (Write|Edit)$/, /^Access: Apps (Write|Edit)$/],
  ],
  [
    "Access IdPs/groups/org write",
    [
      /^Zero Trust (Write|Edit)$/,
      /^Access: Organizations, Identity Providers, and Groups (Write|Edit)$/,
      /^Access: Identity Providers (Write|Edit)$/,
    ],
  ],
  ["Access service tokens write", [/^Zero Trust (Write|Edit)$/, /^Access: Service Tokens (Write|Edit)$/]],
  ["zone read", [/^Zone (Read|Write|Edit)$/]],
  ["DNS write", [/^DNS (Write|Edit)$/]],
  ["Workers routes write", [/^Workers Routes (Write|Edit)$/]],
];

function parseArgs(argv) {
  const args = {
    accountId: "",
    runtimeFile: DEFAULT_RUNTIME_FILE,
    tokenEnv: "",
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
      case "--runtime-file":
        args.runtimeFile = readValue();
        break;
      case "--token-env":
        args.tokenEnv = readValue();
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
  console.log(`Check GoldClaw Cloudflare agent API access without printing token values.

Usage:
  node scripts/check-cloudflare-agent-access.mjs
  node scripts/check-cloudflare-agent-access.mjs --json
  node scripts/check-cloudflare-agent-access.mjs --token-env CLOUDFLARE_GOLDCLAW_AGENT_ADMIN_TOKEN

The checker reads process environment variables and ${DEFAULT_RUNTIME_FILE}.
It verifies the token, inspects token policy when API Tokens Read is present,
and runs read-only probes for Workers, KV, OAuth clients, Zero Trust Access,
DNS records, and Worker routes.
`);
}

function loadRuntimeSecrets(runtimeFile) {
  const path = resolve(runtimeFile);
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === "object" ? parsed : {};
}

function getValue(name, runtimeSecrets) {
  return process.env[name] || runtimeSecrets[name] || "";
}

function resolveZoneIds(runtimeSecrets) {
  return ZONES.map((zone) => {
    const names = [zone.idEnv, ...zone.aliases];
    const id = names.map((name) => getValue(name, runtimeSecrets)).find(Boolean) || zone.defaultId;
    return { ...zone, id };
  });
}

function collectTokenCandidates(args, runtimeSecrets) {
  const names = args.tokenEnv ? [args.tokenEnv] : TOKEN_ENV_NAMES;
  const byValue = new Map();

  for (const source of ["process", "runtime"]) {
    for (const name of names) {
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

async function cfRequest(token, method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text.slice(0, 200) };
    }
  }

  const ok = response.ok && payload?.success !== false;
  return { ok, status: response.status, payload };
}

function summarizeErrors(result) {
  const errors = result?.payload?.errors;
  if (!Array.isArray(errors) || errors.length === 0) {
    return `HTTP ${result.status}`;
  }
  return errors
    .map((error) => `${error.code ?? "unknown"}: ${error.message ?? "Cloudflare API error"}`)
    .join("; ")
    .slice(0, 300);
}

async function probeOne(token, label, paths) {
  const attempts = [];
  for (const path of paths) {
    const result = await cfRequest(token, "GET", path);
    attempts.push({
      path,
      ok: result.ok,
      status: result.status,
      error: result.ok ? "" : summarizeErrors(result),
    });
    if (result.ok) return { label, ok: true, status: result.status, path };
  }

  const last = attempts[attempts.length - 1];
  return {
    label,
    ok: false,
    status: last?.status ?? 0,
    path: last?.path ?? paths[0],
    error: attempts.map((attempt) => `${attempt.path} -> ${attempt.error}`).join(" | "),
  };
}

async function runReadProbes(token, accountId, zones) {
  const probes = [
    probeOne(token, "account details", [`/accounts/${accountId}`]),
    probeOne(token, "workers scripts", [
      `/accounts/${accountId}/workers/scripts?per_page=1`,
      `/accounts/${accountId}/workers/services?per_page=1`,
    ]),
    probeOne(token, "workers KV namespaces", [`/accounts/${accountId}/storage/kv/namespaces?per_page=1`]),
    probeOne(token, "Cloudflare OAuth clients", [`/accounts/${accountId}/oauth_clients?per_page=1`]),
    probeOne(token, "Zero Trust Access applications", [
      `/accounts/${accountId}/access/apps?per_page=1`,
      `/accounts/${accountId}/zero_trust/access/applications?per_page=1`,
    ]),
    probeOne(token, "Zero Trust identity providers", [`/accounts/${accountId}/access/identity_providers?per_page=1`]),
  ];

  for (const zone of zones) {
    probes.push(probeOne(token, `${zone.name} zone`, [`/zones/${zone.id}`]));
    probes.push(probeOne(token, `${zone.name} DNS records`, [`/zones/${zone.id}/dns_records?per_page=1`]));
    probes.push(probeOne(token, `${zone.name} Workers routes`, [`/zones/${zone.id}/workers/routes?per_page=1`]));
  }

  return Promise.all(probes);
}

function collectPermissionNames(tokenDetails) {
  const names = new Set();
  const policies = tokenDetails?.result?.policies;
  if (!Array.isArray(policies)) return names;

  for (const policy of policies) {
    for (const group of policy.permission_groups ?? []) {
      if (group?.name) names.add(group.name);
    }
  }

  return names;
}

function evaluatePermissionContract(permissionNames) {
  if (permissionNames.size === 0) {
    return {
      ok: false,
      checked: false,
      missing: PERMISSION_CONTRACT.map(([label]) => label),
    };
  }

  const missing = [];
  for (const [label, patterns] of PERMISSION_CONTRACT) {
    const matched = Array.from(permissionNames).some((name) => patterns.some((pattern) => pattern.test(name)));
    if (!matched) missing.push(label);
  }

  return { ok: missing.length === 0, checked: true, missing };
}

async function inspectCandidate(candidate, accountId, zones) {
  const verify = await cfRequest(candidate.token, "GET", "/user/tokens/verify");
  if (!verify.ok || verify.payload?.result?.status !== "active") {
    return {
      sources: candidate.sources,
      ok: false,
      verified: false,
      tokenStatus: verify.payload?.result?.status ?? "unknown",
      verifyStatus: verify.status,
      verifyError: summarizeErrors(verify),
      policy: { ok: false, checked: false, missing: PERMISSION_CONTRACT.map(([label]) => label) },
      probes: [],
    };
  }

  const tokenId = verify.payload?.result?.id;
  let tokenDetails = null;
  let policyError = "";
  if (tokenId) {
    const details = await cfRequest(candidate.token, "GET", `/user/tokens/${tokenId}`);
    if (details.ok) {
      tokenDetails = details.payload;
    } else {
      policyError = summarizeErrors(details);
    }
  }

  const permissionNames = collectPermissionNames(tokenDetails);
  const policy = evaluatePermissionContract(permissionNames);
  const probes = await runReadProbes(candidate.token, accountId, zones);
  const readOk = probes.every((probe) => probe.ok);

  return {
    sources: candidate.sources,
    ok: policy.ok && readOk,
    verified: true,
    tokenStatus: verify.payload?.result?.status ?? "active",
    verifyStatus: verify.status,
    policy: {
      ...policy,
      error: policyError,
      permissions: Array.from(permissionNames).sort(),
    },
    probes,
  };
}

function redactResult(result) {
  return {
    ...result,
    sources: result.sources,
    policy: {
      ok: result.policy.ok,
      checked: result.policy.checked,
      error: result.policy.error || "",
      missing: result.policy.missing,
      permissions: result.policy.permissions ?? [],
    },
  };
}

function printHuman(report) {
  console.log(`Cloudflare account: ${report.accountId}`);
  console.log(`Runtime file:       ${report.runtimeFilePresent ? report.runtimeFile : "not found"}`);
  console.log(`Candidates checked: ${report.results.length}`);
  console.log("");

  if (report.results.length === 0) {
    console.log("No Cloudflare API token candidates found.");
    console.log(`Set CLOUDFLARE_GOLDCLAW_AGENT_ADMIN_TOKEN or save it in ${DEFAULT_RUNTIME_FILE}.`);
    return;
  }

  for (const [index, result] of report.results.entries()) {
    const marker = result.ok ? "OK" : result.verified ? "INCOMPLETE" : "FAILED";
    console.log(`[${marker}] candidate ${index + 1}: ${result.sources.join(", ")}`);
    if (!result.verified) {
      console.log(`  verify: ${result.verifyError}`);
      continue;
    }
    if (!result.policy.checked) {
      console.log("  policy: could not inspect token policy; add API Tokens Read to prove write scopes.");
      if (result.policy.error) console.log(`  policy error: ${result.policy.error}`);
    } else if (result.policy.ok) {
      console.log("  policy: required write/read permission groups present.");
    } else {
      console.log(`  policy missing: ${result.policy.missing.join(", ")}`);
    }

    const failedProbes = result.probes.filter((probe) => !probe.ok);
    if (failedProbes.length === 0) {
      console.log("  probes: read access passed for Workers, KV, OAuth clients, Zero Trust, DNS, and routes.");
    } else {
      for (const probe of failedProbes) {
        console.log(`  probe failed: ${probe.label} (${probe.status}) ${probe.error}`);
      }
    }
  }

  console.log("");
  if (report.ok) {
    console.log("Cloudflare agent access contract is satisfied.");
  } else {
    console.log("Cloudflare agent access contract is not satisfied yet.");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runtimeSecrets = loadRuntimeSecrets(args.runtimeFile);
  const accountId =
    args.accountId || getValue("CLOUDFLARE_ACCOUNT_ID", runtimeSecrets) || DEFAULT_ACCOUNT_ID;
  const zones = resolveZoneIds(runtimeSecrets);
  const candidates = collectTokenCandidates(args, runtimeSecrets);

  const results = [];
  for (const candidate of candidates) {
    results.push(await inspectCandidate(candidate, accountId, zones));
  }

  const report = {
    ok: results.some((result) => result.ok),
    accountId,
    zones: zones.map(({ name, id }) => ({ name, id })),
    runtimeFile: resolve(args.runtimeFile),
    runtimeFilePresent: existsSync(resolve(args.runtimeFile)),
    results: results.map(redactResult),
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }

  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
