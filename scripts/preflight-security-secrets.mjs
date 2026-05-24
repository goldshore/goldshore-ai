#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const checks = [
  {
    name: 'gs-api',
    packageJsonPath: 'apps/gs-api/package.json',
    wranglerPath: 'apps/gs-api/wrangler.toml',
    requiredSecrets: ['JWT_SECRET', 'ACCESS_CLIENT_SECRET', 'CLOUDFLARE_ACCESS_AUDIENCE', 'CONTROL_SYNC_TOKEN'],
  },
  {
    name: 'gs-gateway',
    packageJsonPath: 'apps/gs-gateway/package.json',
    wranglerPath: 'apps/gs-gateway/wrangler.toml',
    requiredSecrets: ['ACCESS_CLIENT_SECRET', 'CLOUDFLARE_ACCESS_AUDIENCE'],
  },
];

let failures = 0;
for (const check of checks) {
  const pkg = JSON.parse(readFileSync(check.packageJsonPath, 'utf8'));
  const deploy = pkg.scripts?.deploy ?? '';
  const envMatch = deploy.match(/--env\s+(\w+)/);
  const envName = envMatch?.[1] ?? 'default';

  if (envName !== 'prod') {
    console.error(`[${check.name}] expected deploy env --env prod, found: ${deploy || '(missing)'}`);
    failures++;
  }

  const wrangler = readFileSync(check.wranglerPath, 'utf8');
  if (!wrangler.includes('[env.prod]')) {
    console.error(`[${check.name}] missing [env.prod] section in ${check.wranglerPath}`);
    failures++;
  }

  console.log(
    `[${check.name}] deploy env=prod; expected runtime secrets: ${check.requiredSecrets.join(', ')}`,
  );
}

if (failures > 0) {
  process.exit(1);
}

console.log('Security secret preflight passed.');
