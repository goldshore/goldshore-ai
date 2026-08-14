import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Hono } from 'hono';
import ads from './admin/ad-integrations';
import type { Env, Variables } from '../types';

const appFor = (role: 'viewer' | 'owner') => {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();
  app.use('*', async (c, next) => { c.set('accessClaims', { roles: [role], email: `${role}@goldshore.ai` }); await next(); });
  app.route('/admin/ads', ads);
  return app;
};

describe('ad integration safeguards', () => {
  it('reports readiness without exposing configured values', async () => {
    const response = await appFor('viewer').request('/admin/ads/readiness', {}, { GOOGLE_ADS_DEVELOPER_TOKEN: 'sensitive-token' } as Env);
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.match(body, /developerTokenConfigured/);
    assert.doesNotMatch(body, /sensitive-token/);
    assert.match(body, /read_only/);
  });

  it('denies account creation to viewers before storage access', async () => {
    const response = await appFor('viewer').request('/admin/ads/accounts', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'google_ads', externalAccountId: '1234567890', displayName: 'GoldShore' }),
    }, {} as Env);
    assert.equal(response.status, 403);
  });

  it('keeps Meta sync setup-only without touching storage after lookup', async () => {
    const db = { prepare: () => ({ bind: () => ({ first: async () => ({ id: 'a1', provider: 'meta_ads' }) }) }) };
    const response = await appFor('owner').request('/admin/ads/accounts/a1/sync', { method: 'POST' }, { PLATFORM_DB: db } as unknown as Env);
    assert.equal(response.status, 501);
    assert.match(await response.text(), /setup-only/);
  });
});
