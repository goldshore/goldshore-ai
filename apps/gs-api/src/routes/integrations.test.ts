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
  it('serves integration list requests as the terminal implementation without proxying to admin', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => {
      throw new Error('integration route must not proxy list requests');
    });

    try {
      const app = createTestApp({ roles: ['viewer'], email: 'viewer@example.com' });

      const res = await app.request('/integrations?action=list');
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.deepEqual(body.data, {
        totalIntegrations: 0,
        connected: 0,
        disconnected: 0,
        errors: 0,
        integrations: {},
      });
      assert.equal(fetchMock.mock.callCount(), 0);
    } finally {
      fetchMock.mock.restore();
    }
  });

  it('rejects integration mutations without integration management permission', async () => {
    const app = createTestApp({ roles: ['viewer'], email: 'viewer@example.com' });

    const res = await app.request('/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', config: { name: 'facebook' } }),
    });

    assert.equal(res.status, 403);
  });
});
