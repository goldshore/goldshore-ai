import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relativePath: string) =>
  readFile(new URL(`../../src/${relativePath}`, import.meta.url), 'utf8');

test('admin dashboard renders API readiness from the canonical proxy', async () => {
  const source = await readSource('pages/app/dashboard.astro');

  assert.match(source, /fetchAdminJson<HealthResponse>\(Astro\.request, '\/ready'\)/);
  assert.match(source, /API connectivity/);
  assert.match(source, /API service binding/);
  assert.doesNotMatch(source, /X-Worker-Secret/);
});

test('API status uses the internal service-binding helper for every request', async () => {
  const source = await readSource('pages/admin/api-status.astro');

  assert.match(source, /fetchAdminJson<InboxStatusResponse>/);
  assert.match(source, /fetchAdminJson<DnsSyncStatusResponse>/);
  assert.match(source, /fetchAdminJson<HealthResponse>/);
  assert.doesNotMatch(source, /fetch\(`\$\{apiBase\}/);
  assert.match(source, /Secret values:[\s\S]*Not exposed to the browser/);
});
