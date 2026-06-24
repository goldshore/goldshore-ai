import { test, describe, mock } from 'node:test';
import assert from 'node:assert';
import { createAuditLogger, type AuditLogEntry } from './audit.ts';

describe('createAuditLogger', () => {
  test('logAdminAction logs info and posts to endpoint on success', async () => {
    const mockLogger = {
      info: mock.fn(),
      warn: mock.fn(),
      error: mock.fn(),
    };
    const mockHttpClient = {
      post: mock.fn(async () => ({ ok: true, status: 200 })),
    };
    const config = {
      endpoint: '/audit-log',
      httpClient: mockHttpClient as any,
      logger: mockLogger as any,
    };

    const auditLogger = createAuditLogger(config);
    const entry: AuditLogEntry = {
      action: 'test.action',
      actor: 'user-123',
    };

    await auditLogger.logAdminAction(entry);

    // Verify info logger was called
    assert.strictEqual(mockLogger.info.mock.callCount(), 1);
    const infoCall = mockLogger.info.mock.calls[0];
    assert.strictEqual(infoCall.arguments[0], '[audit] admin action');
    assert.strictEqual(infoCall.arguments[1].action, 'test.action');
    assert.ok(infoCall.arguments[1].timestamp);

    // Verify httpClient.post was called
    assert.strictEqual(mockHttpClient.post.mock.callCount(), 1);
    const postCall = mockHttpClient.post.mock.calls[0];
    assert.strictEqual(postCall.arguments[0], config.endpoint);
    assert.strictEqual(postCall.arguments[1].action, 'test.action');
  });

  test('logAdminAction logs warning when httpClient returns not ok', async () => {
    const mockLogger = {
      info: mock.fn(),
      warn: mock.fn(),
      error: mock.fn(),
    };
    const mockHttpClient = {
      post: mock.fn(async () => ({ ok: false, status: 500 })),
    };
    const config = {
      endpoint: '/audit-log',
      httpClient: mockHttpClient as any,
      logger: mockLogger as any,
    };

    const auditLogger = createAuditLogger(config);
    const entry: AuditLogEntry = {
      action: 'test.action',
    };

    await auditLogger.logAdminAction(entry);

    // Verify warn logger was called
    assert.strictEqual(mockLogger.warn.mock.callCount(), 1);
    const warnCall = mockLogger.warn.mock.calls[0];
    assert.strictEqual(warnCall.arguments[0], '[audit] failed to persist audit log');
    assert.deepStrictEqual(warnCall.arguments[1], { status: 500 });
  });

  test('logAdminAction does not post if endpoint or httpClient is missing', async () => {
    const mockLogger = {
      info: mock.fn(),
      warn: mock.fn(),
      error: mock.fn(),
    };

    // No endpoint
    const config1 = {
      httpClient: { post: mock.fn() } as any,
      logger: mockLogger as any,
    };
    const auditLogger1 = createAuditLogger(config1);
    await auditLogger1.logAdminAction({ action: 'test1' });
    assert.strictEqual(config1.httpClient.post.mock.callCount(), 0);

    // No httpClient
    const config2 = {
      endpoint: '/audit-log',
      logger: mockLogger as any,
    };
    const auditLogger2 = createAuditLogger(config2);
    await auditLogger2.logAdminAction({ action: 'test2' });

    // Total 2 info calls
    assert.strictEqual(mockLogger.info.mock.callCount(), 2);
  });
});
