import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceRoot = new URL('../../src/', import.meta.url);

test('canonical gs-web owns the migrated public feature routes', async () => {
  const routes = [
    'pages/blog/index.astro',
    'pages/pricing/index.astro',
    'pages/products/index.astro',
    'pages/sectors/[slug].astro',
    'pages/services/banproof.astro',
    'pages/services/bridgekeeper.astro',
    'pages/dash.ts',
    'pages/health.ts',
  ];

  await Promise.all(routes.map((route) => access(new URL(route, sourceRoot))));
});

test('public metadata derives canonical output from the request host', async () => {
  const [shell, home, robots, sitemap] = await Promise.all([
    readFile(new URL('layouts/GoldShoreShell.astro', sourceRoot), 'utf8'),
    readFile(new URL('pages/index.astro', sourceRoot), 'utf8'),
    readFile(new URL('pages/robots.txt.ts', sourceRoot), 'utf8'),
    readFile(new URL('pages/sitemap.xml.ts', sourceRoot), 'utf8'),
  ]);

  assert.match(shell, /const siteOrigin = Astro\.url\.origin/);
  assert.match(home, /new URL\('\/', Astro\.url\.origin\)/);
  assert.match(robots, /const baseUrl = url\.origin/);
  assert.match(sitemap, /const baseUrl = url\.origin/);
});

test('services cards render the canonical service model fields', async () => {
  const source = await readFile(new URL('pages/services.astro', sourceRoot), 'utf8');

  assert.match(source, /\{service\.overview\}/);
  assert.match(source, /service\.deliverables\.map/);
  assert.doesNotMatch(source, /\{service\.detail\}/);
});
