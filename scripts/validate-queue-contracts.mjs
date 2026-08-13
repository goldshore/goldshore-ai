#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const manifests = [
  { worker: 'gs-api', path: 'apps/gs-api/wrangler.toml' },
];

const environments = ['prod'];

function parseEnvQueues(content, env, kind) {
  const re = new RegExp(`\\[\\[env\\.${env}\\.queues\\.${kind}\\]\\][\\s\\S]*?queue\\s*=\\s*"([^"]+)"`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(content)) !== null) out.push(m[1]);
  return out;
}

const producers = new Map(); // key env::queue -> workers[]
const consumers = new Map();

for (const { worker, path } of manifests) {
  const content = readFileSync(path, 'utf8');
  for (const env of environments) {
    for (const q of parseEnvQueues(content, env, 'producers')) {
      const key = `${env}::${q}`;
      producers.set(key, [...(producers.get(key) ?? []), worker]);
    }
    for (const q of parseEnvQueues(content, env, 'consumers')) {
      const key = `${env}::${q}`;
      consumers.set(key, [...(consumers.get(key) ?? []), worker]);
    }
  }
}

const errors = [];
for (const [key, producerWorkers] of producers.entries()) {
  if (!consumers.has(key)) {
    const [env, queue] = key.split('::');
    errors.push(`Missing consumer for queue "${queue}" in env "${env}" (producers: ${producerWorkers.join(', ')})`);
  }
}

for (const [key, consumerWorkers] of consumers.entries()) {
  if (!producers.has(key)) {
    const [env, queue] = key.split('::');
    errors.push(`Missing producer for queue "${queue}" in env "${env}" (consumers: ${consumerWorkers.join(', ')})`);
  }
}

if (errors.length > 0) {
  console.error('Queue contract validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Queue contract validation passed.');
