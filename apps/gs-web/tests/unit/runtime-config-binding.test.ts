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
