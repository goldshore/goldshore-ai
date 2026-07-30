import { describe, it, mock, beforeEach, afterEach } from 'node:test';
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
  const mockKV = {
    get: mock.fn(async () => null),
    list: mock.fn(async () => ({ keys: [] })),
    put: mock.fn(async () => {}),
    delete: mock.fn(async () => {}),
  };

  app.use("*", async (c, next) => {
    c.set("accessClaims", claims);
    c.env = { KV: mockKV } as any;
    await next();
  });

  app.route("/integrations", integrations);
  return { app, mockKV };
};

describe('Integration management API security', () => {
  it('loads the integration route and registry dependency', () => {
    assert.ok(integrations);
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
  beforeEach(() => {
    mockKV.put.mock.resetCalls();
    mockKV.get.mock.resetCalls();
    mockKV.delete.mock.resetCalls();
    mockKV.list.mock.resetCalls();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('serves integration lists in gs-api without proxying back to admin', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => {
      throw new Error('gs-api integrations route must not proxy to admin');
    });
    const app = createTestApp({ roles: ['admin'], email: 'admin@example.com' });

    const res = await app.request('/integrations?action=list', { method: 'GET' });
    const body = await res.json() as { success: boolean; data: { totalIntegrations: number } };

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.totalIntegrations, 0);
    assert.equal(mockKV.list.mock.callCount(), 1);
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  it('rejects integration mutations without integration management permission', async () => {
    const app = createTestApp({ roles: ['viewer'], email: 'viewer@example.com' });

    const res = await app.request('/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', config: { name: 'facebook' } }),
describe("Integration Management API Security", () => {
  it("POST /integrations requires integration management permission before KV mutation", async () => {
    const { app, mockKV } = createTestApp({ roles: ["viewer"] });
    const res = await app.request("/integrations", {
      method: "POST",
      body: JSON.stringify({
        action: "delete",
        config: { name: "facebook-pixel" },
      }),
      headers: { "Content-Type": "application/json" },
    });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(mockKV.delete.mock.callCount(), 0);
    assert.strictEqual(mockKV.put.mock.callCount(), 1, "only audit denial should be written");
  });

  it("GET /integrations?action=sync requires integration management permission before registry load", async () => {
    const { app, mockKV } = createTestApp({ roles: ["viewer"] });
    const res = await app.request("/integrations?action=sync");

    assert.strictEqual(res.status, 403);
    assert.strictEqual(mockKV.list.mock.callCount(), 0);
    assert.strictEqual(mockKV.put.mock.callCount(), 1, "only audit denial should be written");
  });
});
