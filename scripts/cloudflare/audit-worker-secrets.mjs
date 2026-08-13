#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const environment = process.argv[process.argv.indexOf('--environment') + 1];
if (!['preview', 'prod'].includes(environment)) {
  console.error('Usage: audit-worker-secrets.mjs --environment <preview|prod>');
  process.exit(2);
}

const contract = JSON.parse(await readFile('apps/gs-api/secret-contract.json', 'utf8'));
const declared = contract.secrets;
const requiredFields = ['name', 'owner', 'purpose', 'failureBehavior'];
for (const secret of contract.secrets) {
  const absent = requiredFields.filter((field) => secret[field] === undefined);
  if (absent.length) throw new Error(`Secret contract entry is missing ${absent.join(', ')}`);
  if ('value' in secret) throw new Error(`Secret contract must not contain values (${secret.name})`);
}
if (new Set(declared.map((secret) => secret.name)).size !== declared.length) {
  throw new Error(`Secret contract contains duplicate names for ${environment}`);
}
const result = spawnSync('pnpm', ['--filter', '@goldshore/gs-api', 'exec', 'wrangler', 'secret', 'list', '--env', environment, '--format', 'json'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});
if (result.status !== 0) process.exit(result.status ?? 1);

const remote = JSON.parse(result.stdout).map((entry) => entry.name).sort();
const expected = declared.map((entry) => entry.name).sort();
const missing = expected.filter((name) => !remote.includes(name));
const unexpected = remote.filter((name) => !expected.includes(name));

await import('node:fs/promises').then(({ appendFile }) => appendFile(
  process.env.GITHUB_STEP_SUMMARY || '/dev/null',
  `## gs-api ${environment} secret-name audit\n\n- Present: ${remote.length}\n- Missing: ${missing.join(', ') || 'none'}\n- Unexpected: ${unexpected.join(', ') || 'none'}\n`,
));
console.log(JSON.stringify({ environment, presentNames: remote, missingNames: missing, unexpectedNames: unexpected }, null, 2));
if (missing.length) console.error(`::warning::Missing optional or required Worker secret names: ${missing.join(', ')}`);
if (unexpected.length) console.error(`::warning::Unexpected Worker secret names: ${unexpected.join(', ')}`);
