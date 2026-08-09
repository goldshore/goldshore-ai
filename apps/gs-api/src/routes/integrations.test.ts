import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import integrations from './integrations';
import type { Env, Variables } from '../types';

const createTestApp = (claims: any = null) => {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();
  const mockKV = {
    get: mock.fn(async () => null),
    list: mock.fn(async () => ({ keys: [] })),
    put: mock.fn(async () => {}),
    delete: mock.fn(async () => {}),
  };
  const mockAuditRun = mock.fn(async () => ({ success: true }));
  const mockAuditDb = {
    prepare: mock.fn(() => ({
      bind: mock.fn(() => ({ run: mockAuditRun })),
    })),
  };

  app.use('*', async (c, next) => {
    c.set('accessClaims', claims);
    c.env = { KV: mockKV, AUDIT_DB: mockAuditDb } as any;
    await next();
  });

  app.route('/integrations', integrations);
  return { app, mockKV, mockAuditRun };
};

describe('Integration Management API security', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('loads the integration route', () => {
    assert.ok(integrations);
  });

  it('serves integration list requests locally without proxying', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => {
      throw new Error('integration route must not proxy list requests');
    });

    try {
      const { app } = createTestApp({ roles: ['viewer'], email: 'viewer@example.com' });
      const res = await app.request('/integrations?action=list');
      const body = await res.json() as { success: boolean; data?: { totalIntegrations?: number } };

      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(fetchMock.mock.callCount(), 0);
    } finally {
      fetchMock.mock.restore();
    }
  });

  it('rejects integration mutations without integration management permission', async () => {
    const { app, mockKV, mockAuditRun } = createTestApp({ roles: ['viewer'], email: 'viewer@example.com' });

    const res = await app.request('/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete',
        config: { name: 'facebook-pixel' },
      }),
    });

    assert.equal(res.status, 403);
    assert.equal(mockKV.delete.mock.callCount(), 0);
    assert.equal(mockKV.put.mock.callCount(), 0);
    assert.equal(mockAuditRun.mock.callCount(), 1);
  });

  it('rejects sync requests without integration management permission', async () => {
    const { app, mockKV, mockAuditRun } = createTestApp({ roles: ['viewer'], email: 'viewer@example.com' });

    const res = await app.request('/integrations?action=sync');

    assert.equal(res.status, 403);
    assert.equal(mockKV.list.mock.callCount(), 0);
    assert.equal(mockKV.put.mock.callCount(), 0);
    assert.equal(mockAuditRun.mock.callCount(), 1);
  });
});
