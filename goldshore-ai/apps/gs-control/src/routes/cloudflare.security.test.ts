import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { Hono } from 'hono';
import { cloudflareRoutes } from './cloudflare.ts';

describe('Cloudflare Routes Security', () => {
  let mockEnv: any;
  let auditLogs: any[] = [];
  let fetchMock: any;
  const originalFetch = global.fetch;

  beforeEach(() => {
    auditLogs = [];
    mockEnv = {
      CONTROL_LOGS: {
        put: async (key: string, value: string) => {
          auditLogs.push(JSON.parse(value));
        }
      },
      CONTROL_ADMIN_ROLES: "admin",
      CLOUDFLARE_API_TOKEN: "mock-token",
      CLOUDFLARE_ACCOUNT_ID: "mock-account",
      CLOUDFLARE_ZONE_ID: "mock-zone"
    };

    fetchMock = mock.fn(async () => {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });
    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const createRequest = async (claims: any, path: string, method: string, body?: any) => {
    const app = new Hono<{ Variables: { accessClaims: any } }>();
    app.use('*', async (c, next) => {
      c.set('accessClaims', claims);
      await next();
    });
    app.route('/', cloudflareRoutes as any);

    return app.request(`http://localhost${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    }, mockEnv);
  };

  it('VULNERABILITY FIX: should reject path traversal in recordId with 400', async () => {
    const payload = {
      type: 'A',
      name: 'example.com',
      content: '1.2.3.4',
      ttl: 3600
    };

    // Malicious recordId trying to traverse up
    const maliciousRecordId = '../malicious';

    const response = await createRequest({
      email: 'admin@example.com',
      roles: ['admin'],
    }, `/dns/records/${encodeURIComponent(maliciousRecordId)}`, 'PUT', payload);

    assert.strictEqual(response.status, 400);
    const body = await response.json() as any;
    assert.deepStrictEqual(body, { error: "Invalid DNS record id." });

    // Check that fetch was NOT called
    assert.strictEqual(fetchMock.mock.calls.length, 0);

    // Verify audit log
    const log = auditLogs.find(l => l.action === 'cloudflare:dns:update');
    assert.ok(log);
    assert.strictEqual(log.status, 'error');
    assert.strictEqual(log.metadata.reason, 'invalid-record-id');
  });

  it('should accept valid alphanumeric recordId', async () => {
    const payload = {
      type: 'A',
      name: 'example.com',
      content: '1.2.3.4',
      ttl: 3600
    };

    const validRecordId = 'abc1234567890def';

    const response = await createRequest({
      email: 'admin@example.com',
      roles: ['admin'],
    }, `/dns/records/${validRecordId}`, 'PUT', payload);

    assert.strictEqual(response.status, 200);

    // Check that fetch WAS called correctly
    assert.strictEqual(fetchMock.mock.calls.length, 1);
    const url = fetchMock.mock.calls[0].arguments[0];
    assert.match(url.toString(), new RegExp(`/zones/mock-zone/dns_records/${validRecordId}$`));
  });
});
