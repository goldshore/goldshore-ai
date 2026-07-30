import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import integrations from './integrations';
import type { Env, Variables } from '../types';

const mockKV = {
  put: mock.fn(async () => {}),
  get: mock.fn(async () => null),
  delete: mock.fn(async () => {}),
  list: mock.fn(async () => ({ keys: [] })),
};

const createTestApp = (claims: any = null) => {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();

  app.use('*', async (c, next) => {
    c.set('accessClaims', claims);
    c.env = { KV: mockKV } as any;
    await next();
  });

  app.route('/integrations', integrations);
  return app;
};

describe('Integration management API security', () => {
  it('rejects integration mutations without integration management permission', async () => {
    const app = createTestApp({ roles: ['viewer'], email: 'viewer@example.com' });

    const res = await app.request('/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', config: { name: 'facebook' } }),
    });

    assert.equal(res.status, 403);
  });

  it('redacts integration secrets from list and status responses', async () => {
    const secretConfig = {
      name: 'stripe-prod',
      type: 'stripe',
      provider: 'stripe',
      apiKey: 'sk_live_secret',
      apiSecret: 'whsec_secret',
      webhookSecret: 'webhook_secret',
      enabled: true,
      status: 'connected',
      lastSync: '2026-07-11T00:00:00.000Z',
      metadata: { safeMetric: 1 },
    };

    mockKV.list.mock.mockImplementationOnce(async () => ({
      keys: [{ name: 'integration:stripe-prod' }],
    }));
    mockKV.get.mock.mockImplementationOnce(async () => secretConfig);

    const app = createTestApp({
      roles: ['admin'],
      email: 'admin@example.com',
      permissions: ['system:integrations:manage'],
    });

    const res = await app.request('/integrations?action=status');
    assert.equal(res.status, 200);

    const payload = await res.json();
    assert.equal(payload.success, true);
    assert.equal(payload.data['stripe-prod'].provider, 'stripe');
    assert.equal(payload.data['stripe-prod'].status, 'connected');
    assert.equal(payload.data['stripe-prod'].apiKey, undefined);
    assert.equal(payload.data['stripe-prod'].apiSecret, undefined);
    assert.equal(payload.data['stripe-prod'].webhookSecret, undefined);

    const listRes = await app.request('/integrations?action=list');
    assert.equal(listRes.status, 200);
    const listPayload = await listRes.json();
    assert.equal(listPayload.data.integrations['stripe-prod'].provider, 'stripe');
    assert.equal(listPayload.data.integrations['stripe-prod'].apiKey, undefined);
    assert.equal(listPayload.data.integrations['stripe-prod'].apiSecret, undefined);
    assert.equal(listPayload.data.integrations['stripe-prod'].webhookSecret, undefined);
  });

});
