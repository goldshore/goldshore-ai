import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRelative = (relativePath: string) =>
  fileURLToPath(new URL(relativePath, import.meta.url));

const webWrangler = readFileSync(
  repoRelative('../../../../infra/Cloudflare/gs-web.wrangler.toml'),
  'utf8',
);
const deployedWebWrangler = readFileSync(repoRelative('../../wrangler.toml'), 'utf8');

const webReadme = readFileSync(repoRelative('../../README.md'), 'utf8');

test('gs-web Cloudflare config documents GS_CONFIG as an unbound proposed-only runtime store', () => {
  assert.doesNotMatch(webWrangler, /binding\s*=\s*"GS_CONFIG"/);
  assert.ok(webWrangler.includes('`GS_CONFIG` is intentionally *not* bound to gs-web today.'));
});

test('gs-web README documents indirect runtime configuration until a concrete consumer exists', () => {
  assert.match(webReadme, /`gs-web` does not currently read `GS_CONFIG` directly/);
  assert.match(webReadme, /do\s+not add that binding without a concrete request-time consumer/);
});

test('gs-web README documents one Worker release and gates a future Pages migration', () => {
  assert.match(webReadme, /exactly one deployment model: an Astro SSR Cloudflare Worker with\r?\nAssets/);
  assert.match(webReadme, /Every dynamic web endpoint/);
  assert.match(webReadme, /must first move into `apps\/gs-api`/);
});

test('gs-web deploy environments use isolated provisioned session namespaces', () => {
  const namespaces = {
    prod: '09ae2ffbffe24e628c9538c8129dfe33',
    preview: '0c75ae6798a54405a386fd36c27a510d',
  } as const;

  for (const [envName, sessionNamespaceId] of Object.entries(namespaces)) {
    assert.match(
      deployedWebWrangler,
      new RegExp(
        `\\[\\[env\\.${envName}\\.kv_namespaces\\]\\][\\s\\S]*?binding = "SESSION"[\\s\\S]*?id = "${sessionNamespaceId}"`,
      ),
    );
  }

  assert.notEqual(namespaces.prod, namespaces.preview);
});
