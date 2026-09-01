#!/usr/bin/env node
/**
 * Read-only operator preflight. This intentionally has no create/update/delete
 * commands and must be run only after the token owner restores authentication.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = resolve(root, 'apps/gs-api');
const commands = [
  ['whoami'],
  ['email', 'sending', 'list'],
  ['versions', 'list'],
  ['queues', 'list'],
  ['workflows', 'list'],
];

const run = (args) => new Promise((resolveRun) => {
  const child = spawn('pnpm', ['exec', 'wrangler', ...args], {
    cwd: apiDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  child.on('error', () => resolveRun(false));
  child.on('exit', (code) => resolveRun(code === 0));
});

let passed = true;
for (const args of commands) {
  console.log(`\n[preflight] read-only: wrangler ${args.join(' ')}`);
  passed = (await run(args)) && passed;
}

console.log('\n[preflight] Manual Access-gated checks still required:');
console.log('  1. POST MCP initialize, then tools/list, with an approved Access session.');
console.log('  2. Run one read-only AI Search query and confirm non-empty cited retrieval.');
console.log('  3. Compare deployed gs-api version and bindings with apps/gs-api/wrangler.toml.');
console.log('[preflight] This script never deploys, provisions, changes bindings, or reads secret values.');
process.exitCode = passed ? 0 : 1;
