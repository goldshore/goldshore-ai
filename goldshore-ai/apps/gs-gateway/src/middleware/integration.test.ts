import { test, describe, mock } from 'node:test';
import assert from 'node:assert';
import { integrationControls } from './integration';
import { type Env } from '../types';

describe('Integration Middleware', () => {
  const createMockContext = (
    path: string,
    method: string,
    headers: Record<string, string> = {},
    env: Partial<Env> = {}
  ) => {
    return {
      req: {
        path,
        method,
        header: (name: string) => headers[name] || undefined,
        raw: {
          headers: new Headers(headers),
        },
      },
      env: {
        GATEWAY_KV: {
          put: mock.fn(async () => {}),
        },
        ...env,
      },
      json: mock.fn((data: any, status: number) => ({ data, status })),
    } as any;
  };

  test('should skip non-integration requests', async () => {
    const c = createMockContext('/other', 'GET');
    const next = mock.fn(async () => {});

    await integrationControls(c, next);

    assert.strictEqual(next.mock.callCount(), 1);
    assert.strictEqual(c.json.mock.callCount(), 0);
  });

  test('should skip OPTIONS requests', async () => {
    const c = createMockContext('/integrations/test', 'OPTIONS');
    const next = mock.fn(async () => {});

    await integrationControls(c, next);

    assert.strictEqual(next.mock.callCount(), 1);
    assert.strictEqual(c.json.mock.callCount(), 0);
  });

  test('should return 400 for invalid data classification', async () => {
    const c = createMockContext('/integrations/test', 'POST', {
      'X-Data-Classification': 'invalid',
    });
    const next = mock.fn(async () => {});

    await integrationControls(c, next);

    assert.strictEqual(next.mock.callCount(), 0);
    assert.strictEqual(c.json.mock.callCount(), 1);
    assert.strictEqual(c.json.mock.calls[0].arguments[1], 400);
    assert.match(c.json.mock.calls[0].arguments[0].error, /Invalid data classification/);
  });

  test('should return 400 for invalid secrets access policy', async () => {
    const c = createMockContext('/integrations/test', 'POST', {
      'X-Data-Classification': 'public',
      'X-Secrets-Access-Policy': 'invalid',
    });
    const next = mock.fn(async () => {});

    await integrationControls(c, next);

    assert.strictEqual(next.mock.callCount(), 0);
    assert.strictEqual(c.json.mock.callCount(), 1);
    assert.strictEqual(c.json.mock.calls[0].arguments[1], 400);
    assert.match(c.json.mock.calls[0].arguments[0].error, /Invalid secrets access policy/);
  });

  test('should return 400 for missing audit trace id', async () => {
    const c = createMockContext('/integrations/test', 'POST', {
      'X-Data-Classification': 'public',
      'X-Secrets-Access-Policy': 'read-only',
    });
    const next = mock.fn(async () => {});

    await integrationControls(c, next);

    assert.strictEqual(next.mock.callCount(), 0);
    assert.strictEqual(c.json.mock.callCount(), 1);
    assert.strictEqual(c.json.mock.calls[0].arguments[1], 400);
    assert.match(c.json.mock.calls[0].arguments[0].error, /Missing audit trace id/);
  });

  test('should log audit entry and proceed for valid request', async () => {
    const c = createMockContext('/integrations/test', 'POST', {
      'X-Data-Classification': 'public',
      'X-Secrets-Access-Policy': 'read-only',
      'X-Audit-Trace-Id': 'trace-123',
    });
    const next = mock.fn(async () => {});

    await integrationControls(c, next);

    assert.strictEqual(next.mock.callCount(), 1);
    assert.strictEqual(c.env.GATEWAY_KV.put.mock.callCount(), 1);
    const [key, value] = c.env.GATEWAY_KV.put.mock.calls[0].arguments;
    assert.strictEqual(key, 'audit:trace-123');
    const parsedValue = JSON.parse(value);
    assert.strictEqual(parsedValue.traceId, 'trace-123');
    assert.strictEqual(parsedValue.classification, 'public');
    assert.strictEqual(parsedValue.secretsPolicy, 'read-only');
  });

  test('should warn if GATEWAY_KV is missing', async () => {
    const c = createMockContext(
      '/integrations/test',
      'POST',
      {
        'X-Data-Classification': 'public',
        'X-Secrets-Access-Policy': 'read-only',
        'X-Audit-Trace-Id': 'trace-123',
      },
      { GATEWAY_KV: undefined }
    );
    const next = mock.fn(async () => {});
    const consoleWarn = mock.method(console, 'warn', () => {});

    await integrationControls(c, next);

    assert.strictEqual(next.mock.callCount(), 1);
    assert.strictEqual(consoleWarn.mock.callCount(), 1);
    assert.match(consoleWarn.mock.calls[0].arguments[0], /GATEWAY_KV is not configured/);

    consoleWarn.mock.restore();
  });
});
