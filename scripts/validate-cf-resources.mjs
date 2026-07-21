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
