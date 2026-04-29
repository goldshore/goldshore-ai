import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { Hono } from 'hono';
import system from './system';

const mockKv = {
  get: mock.fn(async () => null),
  put: mock.fn(async () => undefined),
};

const createTestApp = (claims: unknown) => {
  const app = new Hono<{
    Bindings: { KV: typeof mockKv; API_VERSION?: string; DEPLOY_SHA?: string };
    Variables: { accessClaims: unknown };
  }>();

  app.use('*', async (c, next) => {
    c.env = { KV: mockKv, API_VERSION: 'test-version', DEPLOY_SHA: 'test-sha' } as never;
    c.set('accessClaims', claims);
    await next();
  });

  app.route('/system', system);
  return app;
};

describe('System config authorization', () => {
  it('rejects writes for non-admin callers', async () => {
    mockKv.put.mock.resetCalls();
    const app = createTestApp({ roles: ['viewer'] });
    const response = await app.request('/system/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maintenanceMode: true, maxConcurrency: 20 }),
    });

    assert.strictEqual(response.status, 403);
    assert.strictEqual(mockKv.put.mock.callCount(), 0);
  });

  it('allows writes for admin callers', async () => {
    mockKv.put.mock.resetCalls();
    const app = createTestApp({ roles: ['admin'] });
    const response = await app.request('/system/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maintenanceMode: true, maxConcurrency: 20 }),
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(mockKv.put.mock.callCount(), 1);
  });
});
