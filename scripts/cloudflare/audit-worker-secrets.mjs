#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const environment = process.argv[process.argv.indexOf('--environment') + 1];
if (!['preview', 'prod'].includes(environment)) {
  console.error('Usage: audit-worker-secrets.mjs --environment <preview|prod>');
  process.exit(2);
}

const contract = JSON.parse(await readFile('apps/gs-api/secret-contract.json', 'utf8'));
const declared = contract.secrets.filter((secret) => secret.environment.includes(environment));
const requiredFields = ['name', 'consumer', 'environment', 'owner', 'rotationIntervalDays', 'failureBehavior', 'required'];
for (const secret of contract.secrets) {
  const absent = requiredFields.filter((field) => secret[field] === undefined);
  if (absent.length) throw new Error(`Secret contract entry is missing ${absent.join(', ')}`);
  if ('value' in secret) throw new Error(`Secret contract must not contain values (${secret.name})`);
}
if (new Set(declared.map((secret) => secret.name)).size !== declared.length) {
  throw new Error(`Secret contract contains duplicate names for ${environment}`);
}
const workerSecrets = declared.filter((secret) => (secret.storage ?? 'worker') === 'worker');
const secretsStoreSecrets = declared.filter((secret) => secret.storage === 'secrets_store');
for (const secret of secretsStoreSecrets) {
  if (!secret.storeId) throw new Error(`Secrets Store entry is missing storeId (${secret.name})`);
}

const result = spawnSync('pnpm', ['--filter', '@goldshore/gs-api', 'exec', 'wrangler', 'secret', 'list', '--env', environment, '--format', 'json'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});
if (result.status !== 0) process.exit(result.status ?? 1);

const remote = JSON.parse(result.stdout).map((entry) => entry.name).sort();
const expected = workerSecrets.map((entry) => entry.name).sort();
const required = workerSecrets.filter((entry) => entry.required).map((entry) => entry.name);
const missing = expected.filter((name) => !remote.includes(name));
const missingRequired = required.filter((name) => !remote.includes(name));
const unexpected = remote.filter((name) => !expected.includes(name));

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
if (secretsStoreSecrets.length && (!accountId || !apiToken)) {
  throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required to audit Secrets Store bindings');
}
const stores = new Map();
for (const secret of secretsStoreSecrets) {
  if (stores.has(secret.storeId)) continue;
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/secrets_store/stores/${secret.storeId}/secrets`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(`Unable to list Secrets Store ${secret.storeId}`);
  stores.set(secret.storeId, payload.result);
}
const missingStore = secretsStoreSecrets.filter((secret) => !stores.get(secret.storeId).some((remoteSecret) => remoteSecret.name === secret.name));
const missingStoreScope = secretsStoreSecrets.filter((secret) => {
  const remoteSecret = stores.get(secret.storeId).find((entry) => entry.name === secret.name);
  return remoteSecret && !remoteSecret.scopes.includes('workers');
});
const missingRequiredStore = missingStore.filter((entry) => entry.required);

await import('node:fs/promises').then(({ appendFile }) => appendFile(
  process.env.GITHUB_STEP_SUMMARY || '/dev/null',
  `## gs-api ${environment} secret-name audit\n\n- Present: ${remote.length}\n- Missing: ${missing.join(', ') || 'none'}\n- Missing required: ${missingRequired.join(', ') || 'none'}\n- Unexpected: ${unexpected.join(', ') || 'none'}\n`,
));
console.log(JSON.stringify({ environment, workerSecrets: { presentNames: remote, missingNames: missing, missingRequiredNames: missingRequired, unexpectedNames: unexpected }, secretsStore: { expectedNames: secretsStoreSecrets.map((entry) => entry.name), missingNames: missingStore.map((entry) => entry.name), missingWorkersScopeNames: missingStoreScope.map((entry) => entry.name) } }, null, 2));
if (missing.length) console.error(`::warning::Missing optional or required Worker secret names: ${missing.join(', ')}`);
if (unexpected.length) console.error(`::warning::Unexpected Worker secret names: ${unexpected.join(', ')}`);
if (missingRequired.length) {
  console.error(`::error::Missing required Worker secret names: ${missingRequired.join(', ')}`);
  process.exit(1);
}
if (missingRequiredStore.length || missingStoreScope.length) {
  console.error(`::error::Missing or unusable required Secrets Store bindings: ${[...missingRequiredStore, ...missingStoreScope].map((entry) => entry.name).join(', ')}`);
  process.exit(1);
}
