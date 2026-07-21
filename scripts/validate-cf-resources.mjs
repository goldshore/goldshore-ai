import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const rawToken = process.env.CLOUDFLARE_BUILD_API_TOKEN ?? '';
const token = (rawToken.match(/(?:authorization\s*:\s*)?bearer\s+([^\s"',;}]+)/i)?.[1] ?? rawToken)
  .replace(/[\r\n]/g, '').trim();

if (!accountId || !token) {
  console.warn('::warning::Cloudflare credentials are unavailable; skipping live resource validation.');
  process.exit(0);
}

const API = 'https://api.cloudflare.com/client/v4';
const colors = { green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m' };
const external = new Set([
  'kv:0b56873b6d7b451f9279481920a15447',
  'r2:risk-radar-raw',
  'd1:b0bf3b0e-a7d0-49ae-ac82-4f19450b2ce2',
]);

const request = async (endpoint) => {
  const response = await fetch(`${API}${endpoint}`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    throw new Error(`${endpoint} failed (${response.status}): ${JSON.stringify(body.errors ?? body)}`);
  }
  return body.result ?? [];
};

const listAll = async (endpoint, limit) => {
  const separator = endpoint.includes('?') ? '&' : '?';
  const first = await request(`${endpoint}${separator}page=1&per_page=${limit}`);
  // These account inventories are comfortably below the requested limits; APIs
  // that do not expose pagination still accept or ignore these query parameters.
  return Array.isArray(first) ? first : (first.buckets ?? first.apps ?? []);
};

const appDirs = await readdir('apps', { withFileTypes: true });
const references = [];
const warnings = [];

for (const entry of appDirs.filter((item) => item.isDirectory())) {
  const file = path.join('apps', entry.name, 'wrangler.toml');
  let text;
  try { text = await readFile(file, 'utf8'); } catch { continue; }

  const addMatches = (type, pattern) => {
    for (const match of text.matchAll(pattern)) references.push({ type, value: match[1], file });
  };
  addMatches('kv', /^id\s*=\s*"([0-9a-f]{32})"/gmi);
  addMatches('d1', /^database_id\s*=\s*"([0-9a-f-]{36})"/gmi);
  addMatches('r2', /^bucket_name\s*=\s*"([^"]+)"/gmi);
  addMatches('queue', /^queue\s*=\s*"([^"]+)"/gmi);
  addMatches('aud', /^CLOUDFLARE_ACCESS_AUDIENCE\s*=\s*"([^"]+)"/gmi);
  const topName = text.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
  if (topName) references.push({ type: 'worker', value: topName, file });

  if (entry.name === 'gs-api' && /^\[env\.production\]/m.test(text)) {
    const productionBlock = text.split(/^\[env\.production\]/m)[1]?.split(/^\[env\./m)[0] ?? '';
    if (/^routes?\s*=/m.test(productionBlock) && !/(kv_namespaces|d1_databases|r2_buckets|queues)/.test(productionBlock)) {
      warnings.push('gs-api env.production defines routes but no KV/D1/R2/Queue bindings; it is likely a ghost environment.');
    }
  }
  if (entry.name === 'gs-trading' && /\[\[env\.preview\.d1_databases\]\][\s\S]*?database_id\s*=\s*"00000000-0000-0000-0000-000000000000"/.test(text)) {
    warnings.push('gs-trading preview contains a duplicate placeholder PAPER_DB D1 entry.');
  }
}

const inventories = await Promise.all([
  listAll(`/accounts/${accountId}/storage/kv/namespaces`, 100),
  listAll(`/accounts/${accountId}/d1/database`, 100),
  listAll(`/accounts/${accountId}/r2/buckets`, 1000),
  listAll(`/accounts/${accountId}/queues`, 100),
  request(`/accounts/${accountId}/workers/scripts`),
  listAll(`/accounts/${accountId}/access/apps`, 100),
]);

const existing = {
  kv: new Set(inventories[0].map((item) => item.id)),
  d1: new Set(inventories[1].map((item) => item.uuid ?? item.id)),
  r2: new Set(inventories[2].map((item) => item.name)),
  queue: new Set(inventories[3].map((item) => item.queue_name ?? item.name)),
  worker: new Set(inventories[4].map((item) => item.id ?? item.name)),
  aud: new Set(inventories[5].map((item) => item.aud)),
};

const grouped = new Map();
for (const ref of references) {
  const key = `${ref.type}:${ref.value}`;
  const current = grouped.get(key) ?? { ...ref, files: [] };
  if (!current.files.includes(ref.file)) current.files.push(ref.file);
  grouped.set(key, current);
}
const unique = [...grouped.values()];
const rows = unique.map((ref) => {
  const key = `${ref.type}:${ref.value}`;
  const placeholder = ref.type === 'd1' && ref.value === '00000000-0000-0000-0000-000000000000';
  return { ...ref, external: external.has(key), found: placeholder || existing[ref.type].has(ref.value), placeholder };
});

console.log(`${colors.cyan}Cloudflare resource validation${colors.reset}`);
console.table(rows.map((row) => ({
  type: row.type.toUpperCase(),
  resource: row.value,
  status: row.placeholder
    ? `${colors.yellow}WARNING${colors.reset}`
    : row.found ? `${colors.green}OK${colors.reset}` : `${colors.red}MISSING${colors.reset}`,
  source: row.files.join(', '),
  note: row.external
    ? 'external: risk-radar'
    : row.placeholder ? 'duplicate placeholder' : row.files.length > 1 ? `shared by ${row.files.length} configs` : '',
})));

for (const warning of warnings) console.warn(`::warning::${warning}`);
for (const row of rows.filter((item) => !item.found)) {
  console.error(`::error file=${row.file}::Missing Cloudflare ${row.type.toUpperCase()} resource: ${row.value}`);
}

const missing = rows.filter((row) => !row.found);
if (missing.length) {
  console.error(`${colors.red}${missing.length} referenced Cloudflare resource(s) are missing.${colors.reset}`);
  process.exit(1);
}
console.log(`${colors.green}All ${rows.length} referenced Cloudflare resources exist.${colors.reset}`);
#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID || '';
const TOKEN = process.env.CLOUDFLARE_BUILD_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '';
const ROOT = process.cwd();
const APPS_DIR = path.join(ROOT, 'apps');

const RED = '\u001b[31m';
const GREEN = '\u001b[32m';
const YELLOW = '\u001b[33m';
const CYAN = '\u001b[36m';
const BOLD = '\u001b[1m';
const RESET = '\u001b[0m';

if (!ACCOUNT_ID) {
  console.log(`${YELLOW}::warning::CLOUDFLARE_ACCOUNT_ID is missing; skipping Cloudflare resource validation.${RESET}`);
  process.exit(0);
}
if (!TOKEN) {
  console.log(`${YELLOW}::warning::CLOUDFLARE_BUILD_API_TOKEN is missing; skipping Cloudflare resource validation.${RESET}`);
  process.exit(0);
}

const appTomls = [];
for await (const entry of await readdir(APPS_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const tomlPath = path.join(APPS_DIR, entry.name, 'wrangler.toml');
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

  return { filePath, workerName, kvIds, d1Ids, bucketNames, queueNames, accessAuds, envProductionWarning };
}

async function cfGet(pathname) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/${pathname}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Cloudflare API request failed for ${pathname}: HTTP ${res.status} ${body}`);
  }
  const json = JSON.parse(body);
  if (!json.success) {
    throw new Error(`Cloudflare API returned failure for ${pathname}: ${body}`);
  }
  return json.result ?? [];
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
const knownExternalR2 = new Set(['risk-radar-raw']);
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
    rows.push({ type: 'KV', file, item: id, status: ok ? 'ok' : 'missing', detail: shared ? 'shared' : external ? 'external' : '' });
    if (!ok) failed = true;
  }

  for (const id of new Set(parsed.d1Ids)) {
    const external = knownExternalD1.has(id);
    const ok = existsIn(d1Databases, 'uuid', id) || existsIn(d1Databases, 'id', id);
    rows.push({ type: 'D1', file, item: id, status: ok ? 'ok' : 'missing', detail: external ? 'external' : '' });
    if (!ok) failed = true;
  }

  for (const name of new Set(parsed.bucketNames)) {
    const external = knownExternalR2.has(name);
    const ok = existsIn(r2Buckets, 'name', name);
    rows.push({ type: 'R2', file, item: name, status: ok ? 'ok' : 'missing', detail: external ? 'external' : '' });
    if (!ok) failed = true;
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

  const topWorker = parsed.workerName;
  const okWorker = existsWorker(topWorker);
  rows.push({ type: 'Worker', file, item: topWorker, status: okWorker ? 'ok' : 'missing', detail: '' });
  if (!okWorker) failed = true;
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
