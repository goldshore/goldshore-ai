#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import YAML from "yaml";

const API = "https://api.cloudflare.com/client/v4";
const DEFAULT_ACCOUNT_ID = "f77de112d2019e5456a3198a8bb50bd2";
const DEFAULT_MANIFEST = "infra/secrets/secret-sync.manifest.yaml";
const DEFAULT_RUNTIME_FILE = "env.secrets.runtime.json";

const TOKEN_ENV_NAMES = [
  "CLOUDFLARE_GOLDCLAW_AGENT_ADMIN_TOKEN",
  "CLOUDFLARE_AGENT_ADMIN_TOKEN",
  "CLOUDFLARE_SYNC_AUTH_TOKEN",
  "CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN",
  "CLOUDFLARE_API_TOKEN",
];

const SECRETISH_RE =
  /(api[-_]?key|token|secret|password|passwd|pwd|credential|oauth|client[-_]?secret|jwt|private[-_]?key|bearer|auth)/i;

function parseArgs(argv) {
  const args = {
    accountId: "",
    manifest: DEFAULT_MANIFEST,
    runtimeFile: DEFAULT_RUNTIME_FILE,
    outDir: "reports",
    fingerprints: false,
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
      case "--manifest":
        args.manifest = readValue();
        break;
      case "--runtime-file":
        args.runtimeFile = readValue();
        break;
      case "--out-dir":
        args.outDir = readValue();
        break;
      case "--fingerprints":
        args.fingerprints = true;
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
  console.log(`Audit Cloudflare KV namespaces and secret-like key names without printing values.

Usage:
  node scripts/audit-cloudflare-kv-secrets.mjs
  node scripts/audit-cloudflare-kv-secrets.mjs --fingerprints

The default report lists namespace IDs/titles and KV key names only. With
--fingerprints, the script fetches values only for keys that match canonical
manifest names or secret-like patterns and writes length plus a short SHA-256
fingerprint, never plaintext.
`);
}

function loadJsonFile(path) {
  const fullPath = resolve(path);
  if (!existsSync(fullPath)) return {};
  const raw = readFileSync(fullPath, "utf8");
  return raw.trim() ? JSON.parse(raw) : {};
}

function loadManifest(path) {
  const fullPath = resolve(path);
  const manifest = YAML.parse(readFileSync(fullPath, "utf8"));
  if (!manifest || !Array.isArray(manifest.secrets)) {
    throw new Error(`Invalid secret manifest: ${fullPath}`);
  }
  return { manifest, manifestPath: fullPath };
}

function valueFromSources(name, runtimeSecrets) {
  return process.env[name] || runtimeSecrets[name] || "";
}

function collectTokenCandidates(manifest, runtimeSecrets) {
  const fallbackName = manifest.cloudflareKvFallback?.tokenEnv;
  const names = Array.from(new Set([...TOKEN_ENV_NAMES, fallbackName].filter(Boolean)));
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

async function cf(token, method, path) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  const contentType = response.headers.get("content-type") || "";
  const body =
    contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.arrayBuffer();
  if (!response.ok || body?.success === false) {
    const errors = Array.isArray(body?.errors)
      ? body.errors.map((error) => `${error.code ?? "unknown"}:${error.message ?? "Cloudflare API error"}`).join("; ")
      : `HTTP ${response.status}`;
    throw new Error(errors);
  }
  return body;
}

async function chooseToken(candidates, accountId) {
  const failures = [];
  for (const candidate of candidates) {
    try {
      await cf(candidate.token, "GET", "/user/tokens/verify");
      await cf(candidate.token, "GET", `/accounts/${accountId}/storage/kv/namespaces?per_page=1`);
      return candidate;
    } catch (error) {
      failures.push({
        sources: candidate.sources,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  throw new Error(
    `No usable Cloudflare token could list KV namespaces. Tried: ${failures
      .map((failure) => `${failure.sources.join(",")} -> ${failure.error}`)
      .join(" | ")}`,
  );
}

async function listNamespaces(token, accountId) {
  const payload = await cf(token, "GET", `/accounts/${accountId}/storage/kv/namespaces?per_page=100`);
  return (payload.result || []).map((namespace) => ({
    id: namespace.id,
    title: namespace.title,
    supportsUrlEncoding: Boolean(namespace.supports_url_encoding),
  }));
}

async function listKeys(token, accountId, namespaceId) {
  const keys = [];
  let cursor = "";
  do {
    const params = new URLSearchParams({ limit: "1000" });
    if (cursor) params.set("cursor", cursor);
    const payload = await cf(
      token,
      "GET",
      `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys?${params}`,
    );
    for (const key of payload.result || []) {
      keys.push({
        name: key.name,
        expiration: key.expiration ?? null,
        metadataPresent: key.metadata !== undefined && key.metadata !== null,
      });
    }
    cursor = payload.result_info?.cursor || "";
  } while (cursor);
  return keys;
}

async function fingerprintKey(token, accountId, namespaceId, keyName) {
  const encoded = encodeURIComponent(keyName);
  const response = await fetch(
    `${API}/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encoded}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    byteLength: buffer.length,
    sha256_12: createHash("sha256").update(buffer).digest("hex").slice(0, 12),
  };
}

function canonicalKeyIndex(manifest) {
  const entries = [];
  for (const secret of manifest.secrets) {
    const names = new Set(
      [secret.canonicalName, secret.sourceEnv, ...(secret.sourceAliases || [])].filter(Boolean),
    );
    for (const name of names) {
      entries.push({
        secretId: secret.id,
        canonicalName: secret.canonicalName || secret.sourceEnv,
        name,
        normalized: normalizeKeyName(name),
        required: secret.required !== false,
        kvFallback: Boolean(secret.kvFallback),
      });
    }
  }
  return entries;
}

function normalizeKeyName(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function classifyKey(keyName, canonicalEntries) {
  const exact = canonicalEntries.filter((entry) => entry.name === keyName);
  if (exact.length > 0) {
    return {
      status: "canonical-exact",
      manifestMatches: uniqueMatches(exact),
      secretLike: true,
    };
  }

  const normalized = normalizeKeyName(keyName);
  const normalizedMatches = canonicalEntries.filter((entry) => entry.normalized === normalized);
  if (normalizedMatches.length > 0) {
    return {
      status: "canonical-normalized-alias",
      manifestMatches: uniqueMatches(normalizedMatches),
      secretLike: true,
    };
  }

  const secretLike = SECRETISH_RE.test(keyName);
  return {
    status: secretLike ? "secret-like-unmapped" : "unmapped",
    manifestMatches: [],
    secretLike,
  };
}

function uniqueMatches(entries) {
  const seen = new Set();
  const matches = [];
  for (const entry of entries) {
    const key = `${entry.secretId}:${entry.canonicalName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({
      secretId: entry.secretId,
      canonicalName: entry.canonicalName,
      required: entry.required,
      kvFallback: entry.kvFallback,
    });
  }
  return matches;
}

function namespaceRole(namespace, manifest) {
  const fallback = manifest.cloudflareKvFallback?.namespaces || [];
  const match = fallback.find((item) => item.id === namespace.id);
  if (match) return `manifest-kv-fallback:${match.name}`;
  if (/preview|staging|prv/i.test(namespace.title)) return "preview-or-staging";
  if (/prod|production/i.test(namespace.title)) return "production";
  if (/cache|session|logs/i.test(namespace.title)) return "runtime-noncanonical";
  return "unclassified";
}

function markdownReport(report) {
  const lines = [];
  lines.push("# Cloudflare KV Secret Inventory");
  lines.push("");
  lines.push("Merge Strategy: Merge Commit");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Account: ${report.accountId}`);
  lines.push(`Auth source names: ${report.authSources.join(", ")}`);
  lines.push("");
  lines.push("No KV plaintext values are included in this report.");
  if (report.fingerprintsEnabled) {
    lines.push("Fingerprints are short SHA-256 prefixes plus byte lengths for reuse comparison only.");
  } else {
    lines.push("Fingerprints were not collected; rerun with `--fingerprints` if value identity checks are needed.");
  }
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Namespaces: ${report.summary.namespaces}`);
  lines.push(`- Total keys: ${report.summary.totalKeys}`);
  lines.push(`- Canonical exact keys: ${report.summary.canonicalExact}`);
  lines.push(`- Canonical normalized aliases: ${report.summary.canonicalNormalizedAlias}`);
  lines.push(`- Secret-like unmapped keys: ${report.summary.secretLikeUnmapped}`);
  lines.push(`- Manifest KV fallback namespaces present: ${report.summary.manifestFallbackNamespacesPresent}`);
  lines.push("");
  lines.push("## Jules Review Ping");
  lines.push("");
  lines.push("@Jules-Bot [review-request]");
  lines.push("");
  lines.push(
    "Please review this sanitized Cloudflare KV namespace/key inventory against `infra/secrets/secret-sync.manifest.yaml`. Focus on which KV keys should be reused as canonical source values, renamed into canonical names, migrated out of KV into Worker/GitHub secrets, or left as runtime cache/session data.",
  );
  lines.push("");
  lines.push("## Namespace Inventory");
  lines.push("");
  lines.push("| Namespace | ID | Role | Keys | Canonical | Alias | Secret-like unmapped |");
  lines.push("| --- | --- | --- | ---: | ---: | ---: | ---: |");
  for (const namespace of report.namespaces) {
    lines.push(
      `| \`${namespace.title}\` | \`${namespace.id}\` | ${namespace.role} | ${namespace.keyCount} | ${namespace.counts.canonicalExact} | ${namespace.counts.canonicalNormalizedAlias} | ${namespace.counts.secretLikeUnmapped} |`,
    );
  }
  lines.push("");
  lines.push("## Secret-Like And Canonical Keys");
  lines.push("");
  for (const namespace of report.namespaces) {
    const interesting = namespace.keys.filter((key) => key.secretLike || key.manifestMatches.length > 0);
    if (interesting.length === 0) continue;
    lines.push(`### ${namespace.title}`);
    lines.push("");
    lines.push("| Key | Status | Manifest match | Expiration | Fingerprint |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const key of interesting) {
      const matches =
        key.manifestMatches.length > 0
          ? key.manifestMatches.map((match) => `${match.secretId}/${match.canonicalName}`).join("<br>")
          : "";
      const fingerprint = key.fingerprint
        ? `len=${key.fingerprint.byteLength}, sha256_12=${key.fingerprint.sha256_12}`
        : "";
      lines.push(
        `| \`${key.name}\` | ${key.status} | ${matches} | ${key.expiration ?? ""} | ${fingerprint} |`,
      );
    }
    lines.push("");
  }
  lines.push("## All Non-Empty Namespaces");
  lines.push("");
  for (const namespace of report.namespaces.filter((item) => item.keyCount > 0)) {
    lines.push(`### ${namespace.title}`);
    lines.push("");
    lines.push("| Key | Status | Expiration | Metadata |");
    lines.push("| --- | --- | --- | --- |");
    for (const key of namespace.keys) {
      lines.push(
        `| \`${key.name}\` | ${key.status} | ${key.expiration ?? ""} | ${key.metadataPresent ? "yes" : "no"} |`,
      );
    }
    lines.push("");
  }
  lines.push("## Next Decisions");
  lines.push("");
  lines.push("- Prefer canonical names already present in `infra/secrets/secret-sync.manifest.yaml`.");
  lines.push("- Treat normalized aliases as rename candidates, not new source-of-truth names.");
  lines.push("- Do not migrate cache/session/log namespaces into the secret sync manifest.");
  lines.push("- Use fingerprints only to prove two non-plaintext values are identical before reuse.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function summarize(namespaces) {
  const summary = {
    namespaces: namespaces.length,
    totalKeys: 0,
    canonicalExact: 0,
    canonicalNormalizedAlias: 0,
    secretLikeUnmapped: 0,
    manifestFallbackNamespacesPresent: namespaces.filter((namespace) =>
      namespace.role.startsWith("manifest-kv-fallback:"),
    ).length,
  };
  for (const namespace of namespaces) {
    summary.totalKeys += namespace.keyCount;
    summary.canonicalExact += namespace.counts.canonicalExact;
    summary.canonicalNormalizedAlias += namespace.counts.canonicalNormalizedAlias;
    summary.secretLikeUnmapped += namespace.counts.secretLikeUnmapped;
  }
  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runtimeSecrets = loadJsonFile(args.runtimeFile);
  const { manifest, manifestPath } = loadManifest(args.manifest);
  const accountId =
    args.accountId ||
    valueFromSources(manifest.cloudflareKvFallback?.accountEnv || "CLOUDFLARE_ACCOUNT_ID", runtimeSecrets) ||
    DEFAULT_ACCOUNT_ID;
  const tokenCandidates = collectTokenCandidates(manifest, runtimeSecrets);
  const token = await chooseToken(tokenCandidates, accountId);
  const canonicalEntries = canonicalKeyIndex(manifest);
  const rawNamespaces = await listNamespaces(token.token, accountId);

  const namespaces = [];
  for (const rawNamespace of rawNamespaces.sort((a, b) => a.title.localeCompare(b.title))) {
    const rawKeys = await listKeys(token.token, accountId, rawNamespace.id);
    const keys = [];
    for (const rawKey of rawKeys.sort((a, b) => a.name.localeCompare(b.name))) {
      const classification = classifyKey(rawKey.name, canonicalEntries);
      let fingerprint = null;
      if (args.fingerprints && classification.secretLike) {
        try {
          fingerprint = await fingerprintKey(token.token, accountId, rawNamespace.id, rawKey.name);
        } catch (error) {
          fingerprint = {
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
      keys.push({ ...rawKey, ...classification, fingerprint });
    }
    const counts = {
      canonicalExact: keys.filter((key) => key.status === "canonical-exact").length,
      canonicalNormalizedAlias: keys.filter((key) => key.status === "canonical-normalized-alias").length,
      secretLikeUnmapped: keys.filter((key) => key.status === "secret-like-unmapped").length,
      unmapped: keys.filter((key) => key.status === "unmapped").length,
    };
    namespaces.push({
      ...rawNamespace,
      role: namespaceRole(rawNamespace, manifest),
      keyCount: keys.length,
      counts,
      keys,
    });
  }

  const generatedAt = new Date().toISOString();
  const stamp = generatedAt.slice(0, 10);
  const report = {
    generatedAt,
    accountId,
    manifestPath,
    fingerprintsEnabled: args.fingerprints,
    authSources: token.sources,
    summary: summarize(namespaces),
    namespaces,
  };

  mkdirSync(resolve(args.outDir), { recursive: true });
  const jsonPath = resolve(args.outDir, `cloudflare-kv-secret-inventory-${stamp}.json`);
  const markdownPath = resolve(args.outDir, `cloudflare-kv-secret-inventory-${stamp}.md`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdownPath, markdownReport(report));

  const output = {
    ok: true,
    jsonPath,
    markdownPath,
    summary: report.summary,
    authSources: report.authSources,
    note: "No KV plaintext values were written.",
  };
  console.log(args.json ? JSON.stringify(output, null, 2) : `Wrote ${markdownPath}\nWrote ${jsonPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
