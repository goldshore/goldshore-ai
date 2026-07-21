import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readdir } from 'node:fs/promises';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = (process.env.CLOUDFLARE_BUILD_API_TOKEN || '').trim();
const apiBase = 'https://api.cloudflare.com/client/v4';

const warnAndExit = (message) => {
  console.warn(`::warning::${message}`);
  process.exit(0);
};

if (!accountId || !token) {
  warnAndExit('Skipping Cloudflare resource validation because CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_BUILD_API_TOKEN is missing.');
}

const headers = { Authorization: `Bearer ${token}` };
const fetchJson = async (url) => {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Request failed ${res.status} for ${url}`);
  }
  return res.json();
};

const readWranglerFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await readWranglerFiles(full));
    } else if (entry.isFile() && entry.name === 'wrangler.toml' && full.includes(`${path.sep}apps${path.sep}`)) {
      files.push(full);
    }
  }
  return files;
};

const parse = async (file) => {
  const text = await readFile(file, 'utf8');
  const worker = text.match(/^name\s*=\s*"([^"]+)"/m)?.[1] ?? path.basename(path.dirname(file));
  const kvIds = [...text.matchAll(/binding\s*=\s*"[^"]+"[\s\S]*?id\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
  const d1Ids = [...text.matchAll(/database_id\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
  const r2Buckets = [...text.matchAll(/bucket_name\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
  const queues = [...text.matchAll(/queue\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
  const auds = [...text.matchAll(/CLOUDFLARE_ACCESS_AUDIENCE\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
  return { file, worker, kvIds, d1Ids, r2Buckets, queues, auds, hasProd: /\[env\.prod\]/.test(text) || /\[env\.production\]/.test(text) };
};

const [kv, d1, r2, queues, apps, workers] = await Promise.all([
  fetchJson(`${apiBase}/accounts/${accountId}/storage/kv/namespaces?per_page=100`),
  fetchJson(`${apiBase}/accounts/${accountId}/d1/database?per_page=100`),
  fetchJson(`${apiBase}/accounts/${accountId}/r2/buckets?per_page=1000`),
  fetchJson(`${apiBase}/accounts/${accountId}/queues?per_page=100`),
  fetchJson(`${apiBase}/accounts/${accountId}/access/apps`),
  fetchJson(`${apiBase}/accounts/${accountId}/workers/scripts`),
]);

const kvSet = new Set((kv.result || []).map((item) => item.id));
const d1Set = new Set((d1.result || []).map((item) => item.uuid || item.database_id || item.id));
const r2Set = new Set((r2.result || []).map((item) => item.name));
const queueSet = new Set((queues.result || []).map((item) => item.queue_id || item.name));
const appSet = new Set((apps.result || []).flatMap((app) => [app.aud, app.domain, app.name].filter(Boolean)));
const workerSet = new Set((workers.result || []).map((item) => item.id || item.name || item.script_name).filter(Boolean));

const parsed = await Promise.all((await readWranglerFiles(process.cwd())).map(parse));
const rows = [];
const failures = [];

for (const item of parsed) {
  const misses = [];
  for (const id of item.kvIds) if (!kvSet.has(id)) misses.push(`KV ${id}`);
  for (const id of item.d1Ids) if (!d1Set.has(id)) misses.push(`D1 ${id}`);
  for (const name of item.r2Buckets) if (!r2Set.has(name)) misses.push(`R2 ${name}`);
  for (const name of item.queues) if (!queueSet.has(name)) misses.push(`Queue ${name}`);
  for (const aud of item.auds) if (!appSet.has(aud)) misses.push(`AUD ${aud}`);
  if (!workerSet.has(item.worker)) misses.push(`Worker ${item.worker}`);
  rows.push({ file: path.relative(process.cwd(), item.file), worker: item.worker, missing: misses });
  if (misses.length) failures.push(`${item.file}: ${misses.join(', ')}`);
  if (item.hasProd && !item.kvIds.length && !item.d1Ids.length && !item.r2Buckets.length && !item.queues.length) {
    console.warn(`::warning::${path.relative(process.cwd(), item.file)} has prod env but no storage/queue bindings.`);
  }
}

console.log('CF resource validation summary:');
for (const row of rows) {
  console.log(`${row.missing.length ? '✗' : '✓'} ${row.file} (${row.worker})${row.missing.length ? ` - missing: ${row.missing.join('; ')}` : ''}`);
}

if (failures.length) {
  console.error(`Missing Cloudflare resources:\n${failures.map((f) => `- ${f}`).join('\n')}`);
  process.exit(1);
}
