import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import googleBusiness from './google-business';
import type { Env, Variables } from '../types';

const database = () => ({
  prepare: mock.fn(() => ({
    bind: mock.fn(() => ({ run: mock.fn(async () => ({ success: true })), first: mock.fn(async () => null) })),
  })),
});

const app = () => {
  const instance = new Hono<{ Bindings: Env; Variables: Variables }>();
  instance.use('*', async (c, next) => {
    c.set('accessClaims', { email: 'owner@goldshore.ai', roles: ['admin'] } as any);
    await next();
  });
  instance.route('/admin/google', googleBusiness);
  return instance;
};

describe('Google Business Profile admin integration', () => {
  it('uses random state, PKCE S256, a short TTL, and the exact configured redirect', async () => {
    const kv = { put: mock.fn(async () => {}), get: mock.fn(async () => null), delete: mock.fn(async () => {}) };
    const response = await app().request('/admin/google/oauth/start?format=json', {}, {
      KV: kv,
      GOOGLE_OAUTH_CLIENT_ID: 'client.apps.googleusercontent.com',
      GOOGLE_BUSINESS_OAUTH_REDIRECT_URI: 'http://localhost/admin/google/oauth/callback',
    } as any);
    assert.equal(response.status, 200);
    const payload = await response.json() as any;
    const authorizationUrl = new URL(payload.authorizationUrl);
    assert.equal(authorizationUrl.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(authorizationUrl.searchParams.get('code_challenge'));
    assert.ok(authorizationUrl.searchParams.get('state'));
    assert.equal(authorizationUrl.searchParams.get('redirect_uri'), 'http://localhost/admin/google/oauth/callback');
    assert.equal(kv.put.mock.calls[0].arguments[2].expirationTtl, 600);
  });

  it('rejects a redirect URI that does not exactly match the callback environment', async () => {
    const response = await app().request('/admin/google/oauth/start?format=json', {}, {
      KV: { put: mock.fn(async () => {}) },
      GOOGLE_OAUTH_CLIENT_ID: 'client.apps.googleusercontent.com',
      GOOGLE_BUSINESS_OAUTH_REDIRECT_URI: 'https://wrong.example/admin/google/oauth/callback',
    } as any);
    assert.equal(response.status, 503);
  });

  it('keeps writes disabled until ownership and production consent are human-verified', async () => {
    const auditDb = database();
    const response = await app().request('/admin/google/operations/publish', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        method: 'POST', path: 'accounts/123/locations/456/localPosts', body: { summary: 'draft' },
      }),
    }, {
      KV: { put: mock.fn(async () => {}) }, AUDIT_DB: auditDb, PLATFORM_DB: database(),
      GOOGLE_BUSINESS_ACCOUNT_IDS: '123', GOOGLE_BUSINESS_LOCATION_IDS: '456',
      GOOGLE_BUSINESS_OWNERSHIP_VERIFIED: 'false', GOOGLE_OAUTH_PRODUCTION_APPROVED: 'false',
    } as any);
    assert.equal(response.status, 403);
    assert.match(await response.text(), /verified ownership/);
    assert.equal(auditDb.prepare.mock.calls.length, 1);
  });
});
