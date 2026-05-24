import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { Hono } from 'hono';
import { cloudflareRoutes } from './cloudflare.ts';

// Mock types
type MockKVNamespace = {
  put: (key: string, value: string | ReadableStream | ArrayBuffer, options?: any) => Promise<void>;
};

describe('Cloudflare Routes Middleware', () => {
  let mockEnv: any;
  let auditLogs: any[] = [];
  const originalFetch = global.fetch;

  beforeEach(() => {
    auditLogs = [];
    mockEnv = {
      CONTROL_LOGS: {
        put: async (key: string, value: string) => {
          auditLogs.push(JSON.parse(value));
        }
      },
      CONTROL_ADMIN_ROLES: "admin,ops",
      CLOUDFLARE_API_TOKEN: "mock-token",
      CLOUDFLARE_ACCOUNT_ID: "mock-account",
      CLOUDFLARE_ZONE_ID: "mock-zone"
    };

    // Reset fetch mock to a default failure state to prevent accidental real requests
    global.fetch = mock.fn(async () => {
      return new Response(JSON.stringify({ error: "Fetch not mocked" }), { status: 500 });
    });
  });

  // Helper to create a request with specific claims
  const createRequest = async (claims: any, path: string = '/dns/records', method: string = 'GET', body?: any) => {
    const app = new Hono<{ Variables: { accessClaims: any } }>();

    // Middleware to inject claims
    app.use('*', async (c, next) => {
      c.set('accessClaims', claims);
      await next();
    });

    // Mount the routes under test
    app.route('/', cloudflareRoutes as any);

    return app.request(`http://localhost${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    }, mockEnv);
  };

  it('should deny access if user has no roles', async () => {
    const response = await createRequest({
      email: 'user@example.com',
      roles: [],
    });

    assert.strictEqual(response.status, 403);
    const body = await response.json() as any;
    assert.deepStrictEqual(body, { error: "Forbidden" });

    // Check audit log
    assert.strictEqual(auditLogs.length, 1);
    assert.strictEqual(auditLogs[0].action, "cloudflare:access-denied");
    assert.strictEqual(auditLogs[0].actor, "user@example.com");
    assert.strictEqual(auditLogs[0].status, "denied");
  });

  it('should deny access if user has insufficient roles', async () => {
    const response = await createRequest({
      email: 'user@example.com',
      roles: ['viewer'],
    });

    assert.strictEqual(response.status, 403);

    // Check audit log
    assert.strictEqual(auditLogs.length, 1);
    assert.strictEqual(auditLogs[0].action, "cloudflare:access-denied");
    assert.deepStrictEqual(auditLogs[0].metadata.requiredRoles, ["admin", "ops"]);
  });

  it('should allow access if user has required role "admin"', async () => {
    // Mock successful Cloudflare API response
    global.fetch = mock.fn(async () => {
      return new Response(JSON.stringify({ result: [] }), { status: 200 });
    });

    const response = await createRequest({
      email: 'admin@example.com',
      roles: ['admin'],
    });

    assert.strictEqual(response.status, 200);
    const body = await response.json() as any;
    assert.deepStrictEqual(body, { result: [] });

    // Check that audit log was created for success (implied by route logic)
    // The route /dns/records logs success
    assert.strictEqual(auditLogs.length, 1);
    assert.strictEqual(auditLogs[0].action, "cloudflare:dns:list");
    assert.strictEqual(auditLogs[0].status, "success");
  });

  it('should allow access if user has required role "ops"', async () => {
    global.fetch = mock.fn(async () => {
      return new Response(JSON.stringify({ result: [] }), { status: 200 });
    });

    const response = await createRequest({
      email: 'ops@example.com',
      roles: ['ops'],
    });

    assert.strictEqual(response.status, 200);
  });

  it('should handle roles in "role" claim (string)', async () => {
    global.fetch = mock.fn(async () => {
      return new Response(JSON.stringify({ result: [] }), { status: 200 });
    });

    const response = await createRequest({
      email: 'admin@example.com',
      role: 'admin', // Single string role
    });

    assert.strictEqual(response.status, 200);
  });

  it('should handle roles in "groups" claim (array)', async () => {
    global.fetch = mock.fn(async () => {
      return new Response(JSON.stringify({ result: [] }), { status: 200 });
    });

    const response = await createRequest({
      email: 'admin@example.com',
      groups: ['admin'],
    });

    assert.strictEqual(response.status, 200);
  });

  it('should deny access if user is missing claims entirely (handled gracefully)', async () => {
    // Although our harness injects claims, if we inject empty object or missing critical fields
    const response = await createRequest({});

    assert.strictEqual(response.status, 403);
  });

  it('should log error if cloudflare API fails', async () => {
     global.fetch = mock.fn(async () => {
      return new Response(JSON.stringify({ errors: [] }), { status: 500 });
    });

    const response = await createRequest({
      email: 'admin@example.com',
      roles: ['admin'],
    });

    // The route catches error and returns 502 or returns the status from CF?
    // In cloudflare.ts:
    // const data = await response.json();
    // return { ok: response.ok, status: response.status, data };
    // ...
    // return c.json(result.data, result.status);

    assert.strictEqual(response.status, 500);

    // Check audit log
    assert.strictEqual(auditLogs.length, 1);
    assert.strictEqual(auditLogs[0].status, "error");
  });

  it('should return 502 if fetch throws network error', async () => {
    global.fetch = mock.fn(async () => {
      throw new Error("Network error");
    });

    const response = await createRequest({
      email: 'admin@example.com',
      roles: ['admin'],
    });

    assert.strictEqual(response.status, 502);
    const body = await response.json() as any;
    assert.deepStrictEqual(body, { error: "Cloudflare API request failed." });

    // Check audit log
    assert.strictEqual(auditLogs.length, 1);
    assert.strictEqual(auditLogs[0].status, "error");
    assert.strictEqual(auditLogs[0].metadata.message, "Network error");
  });

  it('should fail DNS update with invalid payload', async () => {
    const response = await createRequest({
      email: 'admin@example.com',
      roles: ['admin'],
    }, '/dns/records/123', 'PUT', { foo: 'bar' });

    assert.strictEqual(response.status, 400);
    const body = await response.json() as any;
    // Hono Zod Validator usually returns details in the body
    assert.strictEqual(body.success, false);
  });

  it('should succeed DNS update with valid payload', async () => {
    global.fetch = mock.fn(async () => {
      return new Response(JSON.stringify({ success: true, result: {} }), { status: 200 });
    });

    const payload = {
      type: 'A',
      name: 'example.com',
      content: '1.2.3.4',
      ttl: 3600
    };

    const response = await createRequest({
      email: 'admin@example.com',
      roles: ['admin'],
    }, '/dns/records/123', 'PUT', payload);

    assert.strictEqual(response.status, 200);

    // Verify audit log
    const log = auditLogs.find(l => l.action === 'cloudflare:dns:update');
    assert.ok(log);
    assert.strictEqual(log.status, 'success');
  });
});
