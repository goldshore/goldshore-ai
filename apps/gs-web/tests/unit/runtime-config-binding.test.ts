import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRelative = (relativePath: string) =>
  fileURLToPath(new URL(relativePath, import.meta.url));

const webWrangler = readFileSync(repoRelative('../../wrangler.toml'), 'utf8');
const webReadme = readFileSync(repoRelative('../../README.md'), 'utf8');
const astroConfig = readFileSync(repoRelative('../../astro.config.mjs'), 'utf8');

test('gs-web has no direct operational or session bindings', () => {
  assert.match(webWrangler, /\[assets\][\s\S]*?binding = "ASSETS"/);
  assert.doesNotMatch(webWrangler, /^binding = "(?:KV|SESSION|PLATFORM_DB|GS_ASSETS|EMAIL)"$/m);
  assert.doesNotMatch(webWrangler, /\[\[env\.prod\.(?:kv_namespaces|d1_databases|r2_buckets|queues)/);
  assert.match(astroConfig, /session:\s*false/);
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
