import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRelative = (relativePath: string) =>
  fileURLToPath(new URL(relativePath, import.meta.url));

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

  // Transactional data stays behind gs-api: no app KV, no D1, no R2, no email.
  // SESSION is deliberately excluded from this list — it backs Astro sessions
  // for auth state and is pinned below so deploys cannot provision a new store.
  assert.doesNotMatch(webWrangler, /^binding = "(?:KV|PLATFORM_DB|GS_ASSETS|EMAIL)"$/m);
  assert.doesNotMatch(webWrangler, /\[\[env\.prod\.(?:d1_databases|r2_buckets|queues)/);

  // The session namespace must be pinned in both scopes. Astro builds the
  // deploy manifest before an environment is selected, and environments do not
  // inherit bindings, so dropping either one lets Cloudflare auto-provision a
  // replacement namespace at deploy time.
  const sessionId = '805bff3293c2483facc5225e6ff9af60';
  assert.match(webWrangler, new RegExp(`\\[\\[kv_namespaces\\]\\]\\r?\\nbinding = "SESSION"\\r?\\nid = "${sessionId}"`));
  assert.match(webWrangler, new RegExp(`\\[\\[env\\.prod\\.kv_namespaces\\]\\]\\r?\\nbinding = "SESSION"\\r?\\nid = "${sessionId}"`));

  // No session driver override: the Cloudflare adapter supplies its KV driver
  // when none is set, which is what emits the SESSION binding.
  assert.doesNotMatch(astroConfig, /^\s*session:/m);
});

test('gs-web has no dedicated preview Worker environment', () => {
  assert.doesNotMatch(webWrangler, /\[env\.preview(?:\.|\])/);
  assert.doesNotMatch(webWrangler, /(?:preview|admin-preview)\.goldshore\.ai/);
});

test('gs-web README documents one Worker release and gates a future Pages migration', () => {
  assert.match(webReadme, /exactly one deployment model: an Astro SSR Cloudflare Worker with\r?\nAssets/);
  assert.match(webReadme, /Every dynamic web endpoint/);
  assert.match(webReadme, /must first move into `apps\/gs-api`/);
});
