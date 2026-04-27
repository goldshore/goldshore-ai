#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const [workerNameArg] = process.argv.slice(2);
if (!workerNameArg) {
  console.error('Usage: node scripts/scaffold-worker.mjs <worker-name>');
  process.exit(1);
}

const normalizedName = workerNameArg
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .replace(/-{2,}/g, '-');

if (!normalizedName) {
  console.error('Worker name cannot be empty after normalization.');
  process.exit(1);
}

const workerDir = resolve('apps', normalizedName);
if (existsSync(workerDir)) {
  console.error(`Directory already exists: ${workerDir}`);
  process.exit(1);
}

mkdirSync(resolve(workerDir, 'src'), { recursive: true });

writeFileSync(
  resolve(workerDir, 'package.json'),
  `${JSON.stringify(
    {
      name: `@goldshore/${normalizedName}`,
      private: true,
      type: 'module',
      scripts: {
        dev: 'wrangler dev',
        deploy: 'wrangler deploy',
      },
      devDependencies: {
        wrangler: '^4.63.0',
      },
    },
    null,
    2,
  )}\n`,
);

writeFileSync(
  resolve(workerDir, 'wrangler.toml'),
  `name = "${normalizedName}"
main = "src/index.ts"
compatibility_date = "2026-01-01"
`,
);

writeFileSync(
  resolve(workerDir, 'src/index.ts'),
  `export default {
  async fetch(): Promise<Response> {
    return new Response('ok');
  },
};
`,
);

console.log(`Scaffolded worker at ${workerDir}`);
