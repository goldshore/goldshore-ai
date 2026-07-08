import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import goldclaw from './goldclaw';
import { type Env, type Variables } from '../types';

const createKv = () => ({
  put: mock.fn(async () => {}),
  get: mock.fn(async () => null),
  delete: mock.fn(async () => {}),
  list: mock.fn(async () => ({ keys: [] })),
});

const createTestApp = () => {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();

  app.use('*', async (c, next) => {
    c.set('accessClaims', { email: 'admin@goldshore.org', roles: ['admin'] } as any);
    await next();
  });

  app.route('/goldclaw', goldclaw);
  return app;
};

describe('GoldClaw API', () => {
  it('returns provider readiness without exposing secret values', async () => {
    const kv = createKv();
    const app = createTestApp();

    const response = await app.request(
      '/goldclaw',
      {},
      {
        KV: kv,
        GOOGLE_OAUTH_CLIENT_ID: 'public-client-id.apps.googleusercontent.com',
      } as any,
    );

    assert.equal(response.status, 200);
    const payload = (await response.json()) as any;
    assert.equal(payload.success, true);
    assert.equal(payload.data.name, 'GoldClaw');
    assert.equal(payload.data.safetyModel.readOnlyDefault, true);
    assert.ok(payload.data.providers.some((provider: any) => provider.id === 'google_ads'));
    assert.ok(
      payload.data.providers
        .find((provider: any) => provider.id === 'google_ads')
        .missingSecrets.includes('GOOGLE_ADS_DEVELOPER_TOKEN'),
    );
    assert.equal(JSON.stringify(payload).includes('secret-value'), false);
  });

  it('creates a Google OAuth URL and stores state', async () => {
    const kv = createKv();
    const app = createTestApp();

    const response = await app.request(
      '/goldclaw/oauth/google/start?format=json',
      {},
      {
        KV: kv,
        GOOGLE_OAUTH_CLIENT_ID: 'public-client-id.apps.googleusercontent.com',
        GOOGLE_OAUTH_REDIRECT_URI: 'https://api.goldshore.ai/goldclaw/oauth/google/callback',
      } as any,
    );

    assert.equal(response.status, 200);
    const payload = (await response.json()) as any;
    assert.equal(payload.success, true);
    assert.match(payload.data.authUrl, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/);
    assert.equal(payload.data.redirectUri, 'https://api.goldshore.ai/goldclaw/oauth/google/callback');
    assert.equal(kv.put.mock.calls.length, 1);
    assert.match(kv.put.mock.calls[0].arguments[0], /^goldclaw:oauth:state:/);
  });

  it('generates a strategy brief with approval gates', async () => {
    const kv = createKv();
    const app = createTestApp();

    const response = await app.request(
      '/goldclaw/brief',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ objective: 'grow useful monetized demand' }),
      },
      { KV: kv } as any,
    );

    assert.equal(response.status, 200);
    const payload = (await response.json()) as any;
    assert.equal(payload.success, true);
    assert.equal(payload.data.objective, 'grow useful monetized demand');
    assert.ok(payload.data.approvalGates.some((gate: string) => gate.includes('campaign budget')));
  });
});
