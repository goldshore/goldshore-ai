#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const normalizeCloudflareToken = (raw) => {
  let token = (raw || '').replace(/[\r\n]/g, '').trim();
  const bearer = token.match(/(?:authorization\s*:\s*)?bearer\s+([^\s"',;}]+)/i);
  if (bearer) token = bearer[1];
  const cfut = token.match(/cfut_[A-Za-z0-9_-]+/);
  if (cfut) token = cfut[0];
  return token.replace(/^[`'"]+|[`'",;}]+$/g, '').replace(/\s/g, '');
};

const ACCOUNT_ID = (process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID || '').trim();
const TOKEN = normalizeCloudflareToken(
  process.env.CLOUDFLARE_BUILD_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '',
);
const SHOULD_SKIP_AUTH_FAILURE =
  process.env.GITHUB_EVENT_NAME === 'pull_request' || process.env.CI_VALIDATE_CF_ALLOW_AUTH_SKIP === '1';
const ROOT = process.cwd();
const CANONICAL_APP_DIRS = ['gs-web', 'gs-api'];

const RED = '[31m';
const GREEN = '[32m';
const YELLOW = '[33m';
const CYAN = '[36m';
const BOLD = '[1m';
const RESET = '[0m';

if (!ACCOUNT_ID) {
  console.log(`${YELLOW}::warning::CLOUDFLARE_ACCOUNT_ID is missing; skipping Cloudflare resource validation.${RESET}`);
  process.exit(0);
}
if (!TOKEN) {
  console.log(`${YELLOW}::warning::CLOUDFLARE_BUILD_API_TOKEN is missing; skipping Cloudflare resource validation.${RESET}`);
  process.exit(0);
}

const appTomls = [];
for (const appName of CANONICAL_APP_DIRS) {
  const tomlPath = path.join(ROOT, 'apps', appName, 'wrangler.toml');
  try {
    await readFile(tomlPath, 'utf8');
    appTomls.push(tomlPath);
  } catch {
    // ignore
  }
}

const stripQuotes = (value) => value.trim().replace(/^["']|["']$/g, '');

function parseWranglerToml(text, filePath) {
  const workerNameMatch = text.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
  const workerName = workerNameMatch ? workerNameMatch[1] : path.basename(path.dirname(filePath));
  const environments = [...text.matchAll(/^\s*\[env\.([A-Za-z0-9_-]+)\]\s*$/gm)].map((match) => match[1]);
  // Wrangler deploys named environments as `<name>-<environment>`. A manifest
  // with environments is never meant to validate an unsuffixed legacy Worker.
  const workerNames = environments.length > 0 ? environments.map((environment) => `${workerName}-${environment}`) : [workerName];

  const kvIds = [...text.matchAll(/^\s*id\s*=\s*["']([a-f0-9]{32})["']\s*$/gim)].map((m) => m[1]);
  const d1Ids = [...text.matchAll(/^\s*database_id\s*=\s*["']([a-f0-9-]{10,})["']\s*$/gim)].map((m) => m[1]);
  const bucketNames = [...text.matchAll(/^\s*bucket_name\s*=\s*["']([^"']+)["']\s*$/gim)].map((m) => m[1]);
  const queueNames = [...text.matchAll(/^\s*queue\s*=\s*["']([^"']+)["']\s*$/gim)].map((m) => m[1]);
  const accessAuds = [];
  for (const match of text.matchAll(/^\s*(?:CLOUDFLARE_ACCESS_AUDIENCE|CF_ACCESS_AUDIENCE|AUD)\s*=\s*["']([^"']+)["']\s*$/gim)) {
    accessAuds.push(match[1]);
  }

  const envProductionWarning = /(?:^\[env\.production\]|\n\[env\.production\])/.test(text)
    ? /(?:^\[\[env\.production\.(?:d1_databases|kv_namespaces|r2_buckets|queues\.(?:producers|consumers))\]\]|\n\[\[env\.production\.)/m.test(text)
    : false;

  return { filePath, workerNames, kvIds, d1Ids, bucketNames, queueNames, accessAuds, envProductionWarning };
}

async function cfGet(pathname) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/${pathname}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
  });
  const body = await res.text();
  if (!res.ok) {
    if (SHOULD_SKIP_AUTH_FAILURE && [400, 401, 403].includes(res.status)) {
      console.log(
        `${YELLOW}::warning::Skipping Cloudflare resource validation because Cloudflare auth failed for ${pathname}: HTTP ${res.status}${RESET}`,
      );
      process.exit(0);
    }
    throw new Error(`Cloudflare API request failed for ${pathname}: HTTP ${res.status} ${body}`);
  }
  const json = JSON.parse(body);
  if (!json.success) {
    throw new Error(`Cloudflare API returned failure for ${pathname}: ${body}`);
  }
  const result = json.result ?? [];
  if (Array.isArray(result)) return result;

  // Some account APIs (notably R2) wrap collections in an object such as
  // `{ buckets: [...] }` instead of returning the array directly.
  const nestedCollection = Object.values(result).find(Array.isArray);
  return nestedCollection ?? [];
}

const [kvNamespaces, d1Databases, r2Buckets, queues, workers, accessApps] = await Promise.all([
  cfGet('storage/kv/namespaces?per_page=100'),
  cfGet('d1/database?per_page=100'),
  cfGet('r2/buckets?per_page=1000'),
  cfGet('queues?per_page=100'),
  cfGet('workers/scripts'),
  cfGet('access/apps?per_page=100'),
]);

const knownSharedKvIds = new Set([
  '5f13370575784c9dacff522121104cb3',
  'a52e94cb331c4e3db08f2aa507e6df09',
  '09e43cb8bd4749fdaaed0dc9d4ff2284',
]);
const knownExternalKvIds = new Set(['0b56873b6d7b451f9279481920a15447']);
const knownExternalR2 = new Set(['risk-radar-raw', 'gs-risk-radar-raw', 'gs-risk-radar-raw-preview']);
const knownExternalD1 = new Set(['b0bf3b0e-a7d0-49ae-ac82-4f19450b2ce2']);
const knownExternalAudience = new Set();

const existsIn = (collection, key, value) => collection.some((item) => item?.[key] === value);
const existsQueue = (value) => queues.some((q) => q?.queue_name === value || q?.name === value);
const existsWorker = (value) => workers.some((w) => w?.id === value || w?.name === value);
const existsAudience = (value) =>
  accessApps.some((app) => app?.aud === value || app?.domain === value || app?.name === value);

const rows = [];
let failed = false;

for (const file of appTomls) {
  const text = await readFile(file, 'utf8');
  const parsed = parseWranglerToml(text, file);

  if (parsed.envProductionWarning) {
    rows.push({ type: 'warning', file, item: 'env.production', status: 'warning', detail: 'env.production exists without nested resource bindings; likely a ghost env' });
  }

  for (const id of new Set(parsed.kvIds)) {
    const shared = knownSharedKvIds.has(id);
    const external = knownExternalKvIds.has(id);
    const ok = existsIn(kvNamespaces, 'id', id);
    const status = ok ? 'ok' : external ? 'warning' : 'missing';
    rows.push({ type: 'KV', file, item: id, status, detail: shared ? 'shared' : external ? 'external' : '' });
    if (!ok && !external) failed = true;
  }

  for (const id of new Set(parsed.d1Ids)) {
    const external = knownExternalD1.has(id);
    const ok = existsIn(d1Databases, 'uuid', id) || existsIn(d1Databases, 'id', id);
    const status = ok ? 'ok' : external ? 'warning' : 'missing';
    rows.push({ type: 'D1', file, item: id, status, detail: external ? 'external' : '' });
    if (!ok && !external) failed = true;
  }

  for (const name of new Set(parsed.bucketNames)) {
    const external = knownExternalR2.has(name);
    const ok = existsIn(r2Buckets, 'name', name);
    const status = ok ? 'ok' : external ? 'warning' : 'missing';
    rows.push({ type: 'R2', file, item: name, status, detail: external ? 'external' : '' });
    if (!ok && !external) failed = true;
  }

  for (const queue of new Set(parsed.queueNames)) {
    const ok = existsQueue(queue);
    rows.push({ type: 'Queue', file, item: queue, status: ok ? 'ok' : 'missing', detail: '' });
    if (!ok) failed = true;
  }

  for (const aud of new Set(parsed.accessAuds)) {
    const external = knownExternalAudience.has(aud);
    const ok = existsAudience(aud);
    rows.push({ type: 'AUD', file, item: aud, status: ok ? 'ok' : 'missing', detail: external ? 'external' : '' });
    if (!ok) failed = true;
  }

  for (const workerName of parsed.workerNames) {
    const okWorker = existsWorker(workerName);
    rows.push({ type: 'Worker', file, item: workerName, status: okWorker ? 'ok' : 'missing', detail: '' });
    if (!okWorker) failed = true;
  }
}

const order = { ok: 0, warning: 1, missing: 2 };
rows.sort((a, b) => order[a.status] - order[b.status] || a.type.localeCompare(b.type) || a.file.localeCompare(b.file));

const colorFor = (status) => (status === 'ok' ? GREEN : status === 'warning' ? YELLOW : RED);
console.log(`${BOLD}Cloudflare resource validation${RESET}`);
console.log('Account: [configured]');
console.log(`${CYAN}Type    Status   Item / Detail${RESET}`);
for (const row of rows) {
  const detail = row.detail ? ` (${row.detail})` : '';
  console.log(`${row.type.padEnd(7)} ${colorFor(row.status)}${row.status.padEnd(7)}${RESET} ${row.item}${detail} — ${path.relative(ROOT, row.file)}`);
}

if (failed) {
  console.error(`${RED}Cloudflare resource validation failed.${RESET}`);
  process.exit(1);
}

console.log(`${GREEN}Cloudflare resource validation passed.${RESET}`);
