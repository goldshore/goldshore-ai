import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('merge cockpit is an authenticated gs-web admin page with four-way review', async () => {
  const source = await read('../../src/pages/admin/merge-cockpit.astro');
  assert.match(source, /<AdminLayout[^>]+requiredPermission="github:read"/);
  assert.match(source, />Base <small>common ancestor/);
  assert.match(source, />Current <small>main now/);
  assert.match(source, />Incoming <small>PR head/);
  assert.match(source, />Proposed <small>your decision/);
  assert.match(source, /expectedBaseSha/);
  assert.match(source, /expectedHeadSha/);
  assert.match(source, /SQUASH #/);
});

test('admin navigation exposes the merge cockpit without a separate app', async () => {
  const sidebar = await read('../../src/components/Sidebar.astro');
  assert.match(sidebar, /href: '\/admin\/merge-cockpit'/);
  assert.match(sidebar, /label: 'PR Merge Cockpit'/);
  assert.doesNotMatch(sidebar, /gs-admin\/merge-cockpit/);
});
