import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { Hono } from "hono";
import integrations from "./integrations";
import { Env, Variables } from "../types";

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
  });

  it('rejects integration mutations without integration management permission', async () => {
    const app = createTestApp({ roles: ['viewer'], email: 'viewer@example.com' });

    const res = await app.request('/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', config: { name: 'facebook' } }),
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
