import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRelative = (relativePath: string) =>
  fileURLToPath(new URL(relativePath, import.meta.url));

<<<<<<< ours
const webWrangler = readFileSync(
  repoRelative('../../../../infra/Cloudflare/gs-web.wrangler.toml'),
  'utf8',
);
const deployedWebWrangler = readFileSync(repoRelative('../../wrangler.toml'), 'utf8');
=======
const webWrangler = readFileSync(repoRelative('../../wrangler.toml'), 'utf8');
const webReadme = readFileSync(repoRelative('../../README.md'), 'utf8');
const astroConfig = readFileSync(repoRelative('../../astro.config.mjs'), 'utf8');
const workerEntrypoint = readFileSync(repoRelative('../../src/worker.ts'), 'utf8');
const deployWorkflow = readFileSync(
  repoRelative('../../../../.github/workflows/deploy-gs-web.yml'),
  'utf8',
);

test('gs-web retains its Astro SSR Worker-with-Assets deployment contract', () => {
  assert.match(webWrangler, /^main = "\.\/src\/worker\.ts"$/m);
  assert.match(
    webWrangler,
    /^\[assets\]\r?\ndirectory = "\.\/dist"\r?\nbinding = "ASSETS"$/m,
  );

  // The checked-in entrypoint delegates requests to Astro's SSR handler. A
  // static-assets-only deployment would make non-prerendered auth routes 404.
  assert.match(workerEntrypoint, /from '@astrojs\/cloudflare\/handler'/);
  assert.match(workerEntrypoint, /async fetch\(request: Request, env: unknown, ctx: unknown\)/);
  assert.match(workerEntrypoint, /return handle\(request, env as any, ctx as any\)/);

  // CI must build the same SSR release rather than publishing dist as a Pages
  // site or bypassing the manifest through a different Wrangler entrypoint.
  assert.match(deployWorkflow, /CLOUDFLARE_ENV: prod/);
  assert.match(deployWorkflow, /run: pnpm build:pages/);
  assert.doesNotMatch(deployWorkflow, /^\s*run:.*wrangler pages deploy/m);
});

test('gs-web has no direct operational bindings beyond its session store', () => {
  assert.match(webWrangler, /\[assets\][\s\S]*?binding = "ASSETS"/);
>>>>>>> theirs

const webReadme = readFileSync(repoRelative('../../README.md'), 'utf8');

test('gs-web Cloudflare config documents GS_CONFIG as an unbound proposed-only runtime store', () => {
  assert.doesNotMatch(webWrangler, /binding\s*=\s*"GS_CONFIG"/);
  assert.ok(webWrangler.includes('`GS_CONFIG` is intentionally *not* bound to gs-web today.'));
});

test('gs-web README documents indirect runtime configuration until a concrete consumer exists', () => {
  assert.ok(webReadme.includes('`gs-web` does not currently read `GS_CONFIG` directly.'));
  assert.ok(
    webReadme.includes(
      'Do not add a `GS_CONFIG` binding to the web Pages project unless a concrete `apps/gs-web` runtime consumer needs live request-time reads.',
    ),
  );
});

test('gs-web deploy environments reuse the provisioned session namespace', () => {
  const sessionNamespaceId = '09ae2ffbffe24e628c9538c8129dfe33';

  for (const envName of ['prod', 'preview']) {
    assert.match(
      deployedWebWrangler,
      new RegExp(
        `\\[\\[env\\.${envName}\\.kv_namespaces\\]\\][\\s\\S]*?binding = "SESSION"[\\s\\S]*?id = "${sessionNamespaceId}"`,
      ),
    );
  }
});
