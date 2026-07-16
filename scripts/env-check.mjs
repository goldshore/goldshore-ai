#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";

const DEFAULT_MANIFEST = "infra/secrets/secret-sync.manifest.yaml";

const REQUIRED_ROTATION_KEYS = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN",
  "CONTROL_SYNC_TOKEN",
  "JWT_SECRET",
  "ACCESS_CLIENT_ID",
  "ACCESS_CLIENT_SECRET",
  "GITHUB_APP_ID",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_APP_INSTALLATION_ID",
  "GITHUB_WEBHOOK_SECRET",
];

const OPTIONAL_ROTATION_KEYS = [
  "GITHUB_OAUTH_CLIENT_ID",
  "GITHUB_OAUTH_CLIENT_SECRET",
  "GITHUB_STATUS_TOKEN",
  "GITHUB_WEBHOOK_POST_DEPLOY_URLS",
  "GITHUB_WEBHOOK_POST_DEPLOY_TOKEN",
  "TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET",
  "STRIPE_API_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
];

function parseArgs(argv) {
  const args = {
    manifest: DEFAULT_MANIFEST,
    valuesFiles: [],
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
      case "--manifest":
        args.manifest = readValue();
        break;
      case "--values":
        args.valuesFiles.push(readValue());
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
  console.log(`Validate the local GoldShore rotation environment bundle.

Usage:
  node scripts/env-check.mjs
  node scripts/env-check.mjs --json
  node scripts/env-check.mjs --values env.secrets.runtime.json

Only key names and presence are reported. Secret values are never printed.
`);
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

function loadManifest(path) {
  const manifestPath = resolve(path);
  const manifest = YAML.parse(readFileSync(manifestPath, "utf8"));
  if (!manifest || !Array.isArray(manifest.secrets)) {
    throw new Error(`Invalid secret manifest: ${manifestPath}`);
  }
  return { manifest, manifestPath };
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

function manifestNames(manifest) {
  return new Set(
    manifest.secrets.flatMap((secret) => [
      secret.canonicalName,
      secret.sourceEnv,
      ...(secret.sourceAliases ?? []),
      ...(secret.targets?.githubActions ?? []).map((target) => target.name),
      ...(secret.targets?.githubAgents ?? []).map((target) => target.name),
      ...(secret.targets?.cloudflareWorkers ?? []).map((target) => target.name),
    ]).filter(Boolean),
  );
}

function acceptedNamesFor(manifest, requestedName) {
  const matching = manifest.secrets.find((secret) => {
    const names = [
      secret.canonicalName,
      secret.sourceEnv,
      ...(secret.sourceAliases ?? []),
      ...(secret.targets?.githubActions ?? []).map((target) => target.name),
      ...(secret.targets?.githubAgents ?? []).map((target) => target.name),
      ...(secret.targets?.cloudflareWorkers ?? []).map((target) => target.name),
    ].filter(Boolean);
    return names.includes(requestedName);
  });

  if (!matching) return [requestedName];

  return [
    matching.canonicalName,
    matching.sourceEnv,
    ...(matching.sourceAliases ?? []),
    ...(matching.targets?.githubActions ?? []).map((target) => target.name),
    ...(matching.targets?.githubAgents ?? []).map((target) => target.name),
    ...(matching.targets?.cloudflareWorkers ?? []).map((target) => target.name),
  ].filter(Boolean);
}

function hasAnyValue(values, names) {
  return names.some((name) => Boolean(values.get(name)));
}

function present(manifest, values, names) {
  return names.filter((name) => hasAnyValue(values, acceptedNamesFor(manifest, name)));
}

function missing(manifest, values, names) {
  return names.filter((name) => !hasAnyValue(values, acceptedNamesFor(manifest, name)));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { manifest, manifestPath } = loadManifest(args.manifest);
  const values = loadValues(manifest, args.valuesFiles);
  const knownNames = manifestNames(manifest);
  const requiredMissing = missing(manifest, values, REQUIRED_ROTATION_KEYS);
  const optionalMissing = missing(manifest, values, OPTIONAL_ROTATION_KEYS);
  const notInManifest = [...REQUIRED_ROTATION_KEYS, ...OPTIONAL_ROTATION_KEYS].filter(
    (name) => !knownNames.has(name),
  );

  const report = {
    ok: requiredMissing.length === 0 && notInManifest.length === 0,
    manifestPath,
    required: {
      present: present(manifest, values, REQUIRED_ROTATION_KEYS),
      missing: requiredMissing,
    },
    optional: {
      present: present(manifest, values, OPTIONAL_ROTATION_KEYS),
      missing: optionalMissing,
    },
    notInManifest,
    note: "Secret values are intentionally not reported.",
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Secret manifest: ${manifestPath}`);
    console.log(`Required present: ${report.required.present.length}/${REQUIRED_ROTATION_KEYS.length}`);
    if (requiredMissing.length > 0) {
      console.log(`Required missing: ${requiredMissing.join(", ")}`);
    }
    if (optionalMissing.length > 0) {
      console.log(`Optional missing: ${optionalMissing.join(", ")}`);
    }
    if (notInManifest.length > 0) {
      console.log(`Names missing from manifest: ${notInManifest.join(", ")}`);
    }
    console.log(report.note);
  }

  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
