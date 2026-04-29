import fs from 'node:fs';
import path from 'node:path';

const wranglerPath = path.resolve('apps/banproof-me/wrangler.toml');
const required = {
  d1: { binding: 'PLATFORM_DB', database_name: 'gs_platform_db' },
  kv_namespaces: ['BANPROOF_KV', 'AI_CACHE'],
  queues: ['BANPROOF_JOBS'],
  services: [{ binding: 'GS_API', service: 'gs-api' }],
  secrets: ['OPENAI_API_KEY', 'POA_TOKEN', 'AUDIT_TOKEN'],
};

const errors = [];
if (!fs.existsSync(wranglerPath)) {
  errors.push(`Missing required Wrangler file: ${wranglerPath}`);
} else {
  const wrangler = fs.readFileSync(wranglerPath, 'utf8');

  const mustContain = [
    `binding = "${required.d1.binding}"`,
    `database_name = "${required.d1.database_name}"`,
    ...required.kv_namespaces.map((key) => `binding = "${key}"`),
    ...required.queues.map((key) => `binding = "${key}"`),
    ...required.services.map((svc) => `binding = "${svc.binding}"`),
    ...required.services.map((svc) => `service = "${svc.service}"`),
    ...required.secrets.map((key) => key),
  ];

  for (const token of mustContain) {
    if (!wrangler.includes(token)) {
      errors.push(`Missing or renamed required production binding token: ${token}`);
    }
  }
}

if (errors.length) {
  console.error('banproof-me production binding validation failed:');
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

console.log('banproof-me production binding validation passed.');
