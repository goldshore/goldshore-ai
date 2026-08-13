import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import mergeCockpit from './admin/merge-cockpit';

const OLD_BASE = '1'.repeat(40);
const CURRENT_BASE = '2'.repeat(40);
const HEAD = '3'.repeat(40);
const MERGE_BASE = '4'.repeat(40);

const createApp = () => {
  const app = new Hono<any>();
  app.use('*', async (c, next) => {
    c.set('accessClaims', { email: 'admin@goldshore.org', roles: ['admin'] });
    await next();
  });
  app.route('/merge-cockpit', mergeCockpit);
  return app;
};

const json = (value: unknown) => new Response(JSON.stringify(value), {
  status: 200,
  headers: { 'content-type': 'application/json' },
});

const installGitHubMock = () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url.endsWith('/pulls/7')) return json({
      number: 7, title: 'Old feature', html_url: 'https://github.com/marzton/goldshore-ai/pull/7',
      draft: false, mergeable: true, mergeable_state: 'clean', merged: false, updated_at: new Date().toISOString(),
      user: { login: 'agent' }, base: { ref: 'main', sha: OLD_BASE },
      head: { ref: 'agent/old-feature', sha: HEAD, repo: { full_name: 'marzton/goldshore-ai' } },
    });
    if (url.includes('/git/ref/heads/main')) return json({ object: { sha: CURRENT_BASE } });
    if (url.includes(`/compare/${CURRENT_BASE}...${HEAD}`)) return json({ merge_base_commit: { sha: MERGE_BASE }, files: [] });
    if (url.includes(`/compare/${MERGE_BASE}...${CURRENT_BASE}`)) return json({ merge_base_commit: { sha: MERGE_BASE }, files: [{ filename: 'apps/gs-web/src/middleware.ts' }] });
    if (url.includes(`/compare/${MERGE_BASE}...${HEAD}`)) return json({ merge_base_commit: { sha: MERGE_BASE }, files: [{ filename: 'apps/gs-web/src/middleware.ts' }] });
    if (url.includes('/check-runs')) return json({ check_runs: [{ name: 'CI', status: 'completed', conclusion: 'success' }] });
    if (url.endsWith(`/commits/${HEAD}/status`)) return json({ statuses: [] });
    throw new Error(`Unexpected GitHub request: ${url}`);
  }) as typeof fetch;
  return () => { globalThis.fetch = originalFetch; };
};

test('uses the live main ref and detects semantic overlap for an old PR', async () => {
  const restore = installGitHubMock();
  try {
    const response = await createApp().request('/merge-cockpit/pulls/7', {}, { GITHUB_API_TOKEN: 'test' });
    assert.equal(response.status, 200);
    const payload = await response.json() as any;
    assert.equal(payload.pull.base.sha, OLD_BASE);
    assert.equal(payload.currentBaseSha, CURRENT_BASE);
    assert.equal(payload.semanticConflicts[0].filename, 'apps/gs-web/src/middleware.ts');
    assert.equal(payload.directMergeEligible, false);
  } finally {
    restore();
  }
});

test('refuses a write when the submitted base SHA is stale', async () => {
  const restore = installGitHubMock();
  try {
    const response = await createApp().request('/merge-cockpit/salvage', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prNumber: 7, expectedBaseSha: OLD_BASE, expectedHeadSha: HEAD, resolutions: {} }),
    }, { GITHUB_API_TOKEN: 'test' });
    assert.equal(response.status, 409);
    assert.match((await response.json() as any).error, /state changed/i);
  } finally {
    restore();
  }
});
