import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Hono } from 'hono';
import sites, { cleanManagedPageHtml, normalizeManagedDomain, SITE_PLUGIN_CATALOG } from './sites';
import type { Env, Variables } from '../types';

describe('managed sites safeguards', () => {
  it('normalizes public domains and rejects local or malformed targets', () => {
    assert.equal(normalizeManagedDomain('https://Admin.Goldshore.ai/'), 'admin.goldshore.ai');
    assert.equal(normalizeManagedDomain('localhost'), null);
    assert.equal(normalizeManagedDomain('bad/domain'), null);
  });
  it('ships only an explicit plugin allowlist', () => {
    assert.ok(SITE_PLUGIN_CATALOG.length >= 4);
    assert.equal(new Set(SITE_PLUGIN_CATALOG.map((plugin) => plugin.id)).size, SITE_PLUGIN_CATALOG.length);
    assert.ok(SITE_PLUGIN_CATALOG.every((plugin) => plugin.configKeys.every((key) => !/secret|token/i.test(key) || key === 'token')));
  });
  it('sanitizes executable markup from site pages', () => {
    const clean = cleanManagedPageHtml('<h1 onclick="evil()">Safe</h1><script>alert(1)</script><img src="https://goldshore.ai/a.png" onerror="evil()">');
    assert.match(clean, /<h1>Safe<\/h1>/);
    assert.doesNotMatch(clean, /script|onclick|onerror/);
  });
  it('denies site mutation to a viewer before touching storage', async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', async (c, next) => { c.set('accessClaims', { roles: ['viewer'], email: 'viewer@goldshore.ai' }); await next(); });
    app.route('/sites', sites);
    const response = await app.request('/sites', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }, {} as Env);
    assert.equal(response.status, 403);
  });
});
