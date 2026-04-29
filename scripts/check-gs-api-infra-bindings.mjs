import { readFile } from 'node:fs/promises';

const FILE = 'infra/Cloudflare/gs-api.wrangler.toml';
const raw = await readFile(FILE, 'utf8');

const requiredChecks = [
  { label: 'env.preview route', pattern: /\[env\.preview\][\s\S]*?routes\s*=\s*\[/ },
  { label: 'env.prod route', pattern: /\[env\.prod\][\s\S]*?routes\s*=\s*\[/ },
  { label: 'env.preview KV', pattern: /\[\[env\.preview\.kv_namespaces\]\][\s\S]*?binding\s*=\s*"KV"/ },
  { label: 'env.prod KV', pattern: /\[\[env\.prod\.kv_namespaces\]\][\s\S]*?binding\s*=\s*"KV"/ },
  { label: 'env.preview CONTROL_LOGS', pattern: /\[\[env\.preview\.kv_namespaces\]\][\s\S]*?binding\s*=\s*"CONTROL_LOGS"/ },
  { label: 'env.prod CONTROL_LOGS', pattern: /\[\[env\.prod\.kv_namespaces\]\][\s\S]*?binding\s*=\s*"CONTROL_LOGS"/ },
  { label: 'env.preview DB', pattern: /\[\[env\.preview\.d1_databases\]\][\s\S]*?binding\s*=\s*"DB"/ },
  { label: 'env.prod DB', pattern: /\[\[env\.prod\.d1_databases\]\][\s\S]*?binding\s*=\s*"DB"/ },
  { label: 'env.preview ASSETS', pattern: /\[\[env\.preview\.r2_buckets\]\][\s\S]*?binding\s*=\s*"ASSETS"/ },
  { label: 'env.prod ASSETS', pattern: /\[\[env\.prod\.r2_buckets\]\][\s\S]*?binding\s*=\s*"ASSETS"/ },
  { label: 'env.preview AI', pattern: /\[env\.preview\.ai\][\s\S]*?binding\s*=\s*"AI"/ },
  { label: 'env.prod AI', pattern: /\[env\.prod\.ai\][\s\S]*?binding\s*=\s*"AI"/ },
  { label: 'env.preview AGENT service binding', pattern: /\[\[env\.preview\.services\]\][\s\S]*?binding\s*=\s*"AGENT"/ },
  { label: 'env.prod AGENT service binding', pattern: /\[\[env\.prod\.services\]\][\s\S]*?binding\s*=\s*"AGENT"/ },
  { label: 'env.preview jobs queue producer', pattern: /\[\[env\.preview\.queues\.producers\]\][\s\S]*?binding\s*=\s*"JOBS_QUEUE"/ },
  { label: 'env.prod jobs queue producer', pattern: /\[\[env\.prod\.queues\.producers\]\][\s\S]*?binding\s*=\s*"JOBS_QUEUE"/ },
];

const missing = requiredChecks.filter(({ pattern }) => !pattern.test(raw));
if (missing.length) {
  console.error(`Missing required gs-api infra bindings/routes in ${FILE}:`);
  for (const item of missing) console.error(`- ${item.label}`);
  process.exit(1);
}

console.log(`All required gs-api infra bindings/routes are present in ${FILE}.`);
