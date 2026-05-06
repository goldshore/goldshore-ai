import { readFile } from 'node:fs/promises';

const FILE = 'infra/Cloudflare/gs-api.wrangler.toml';
const raw = await readFile(FILE, 'utf8');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getTomlBlocks(source, header) {
  const escapedHeader = escapeRegex(header);
  const blockPattern = new RegExp(
    `^\\s*${escapedHeader}\\s*$[\\s\\S]*?(?=^\\s*\\[[^\\]]|^\\s*\\[\\[[^\\]]|\\s*$)`,
    'gm',
  );

  return Array.from(source.matchAll(blockPattern), (match) => match[0]);
}

function hasRequiredLineInBlock(source, header, linePattern) {
  return getTomlBlocks(source, header).some((block) => linePattern.test(block));
}

const requiredChecks = [
  { label: 'env.preview route', header: '[env.preview]', linePattern: /^\s*routes\s*=\s*\[/m },
  { label: 'env.prod route', header: '[env.prod]', linePattern: /^\s*routes\s*=\s*\[/m },
  { label: 'env.preview KV', header: '[[env.preview.kv_namespaces]]', linePattern: /^\s*binding\s*=\s*"KV"\s*$/m },
  { label: 'env.prod KV', header: '[[env.prod.kv_namespaces]]', linePattern: /^\s*binding\s*=\s*"KV"\s*$/m },
  { label: 'env.preview CONTROL_LOGS', header: '[[env.preview.kv_namespaces]]', linePattern: /^\s*binding\s*=\s*"CONTROL_LOGS"\s*$/m },
  { label: 'env.prod CONTROL_LOGS', header: '[[env.prod.kv_namespaces]]', linePattern: /^\s*binding\s*=\s*"CONTROL_LOGS"\s*$/m },
  { label: 'env.preview DB', header: '[[env.preview.d1_databases]]', linePattern: /^\s*binding\s*=\s*"DB"\s*$/m },
  { label: 'env.prod DB', header: '[[env.prod.d1_databases]]', linePattern: /^\s*binding\s*=\s*"DB"\s*$/m },
  { label: 'env.preview ASSETS', header: '[[env.preview.r2_buckets]]', linePattern: /^\s*binding\s*=\s*"ASSETS"\s*$/m },
  { label: 'env.prod ASSETS', header: '[[env.prod.r2_buckets]]', linePattern: /^\s*binding\s*=\s*"ASSETS"\s*$/m },
  { label: 'env.preview AI', header: '[env.preview.ai]', linePattern: /^\s*binding\s*=\s*"AI"\s*$/m },
  { label: 'env.prod AI', header: '[env.prod.ai]', linePattern: /^\s*binding\s*=\s*"AI"\s*$/m },
  { label: 'env.preview AGENT service binding', header: '[[env.preview.services]]', linePattern: /^\s*binding\s*=\s*"AGENT"\s*$/m },
  { label: 'env.prod AGENT service binding', header: '[[env.prod.services]]', linePattern: /^\s*binding\s*=\s*"AGENT"\s*$/m },
  { label: 'env.preview jobs queue producer', header: '[[env.preview.queues.producers]]', linePattern: /^\s*binding\s*=\s*"JOBS_QUEUE"\s*$/m },
  { label: 'env.prod jobs queue producer', header: '[[env.prod.queues.producers]]', linePattern: /^\s*binding\s*=\s*"JOBS_QUEUE"\s*$/m },
];

const missing = requiredChecks.filter(
  ({ header, linePattern }) => !hasRequiredLineInBlock(raw, header, linePattern),
);
if (missing.length) {
  console.error(`Missing required gs-api infra bindings/routes in ${FILE}:`);
  for (const item of missing) console.error(`- ${item.label}`);
  process.exit(1);
}

console.log(`All required gs-api infra bindings/routes are present in ${FILE}.`);
