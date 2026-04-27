import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { createAdminService, type AdminServiceConfig } from './admin';
import type { HttpClient } from './http';
import type { AuditLogger } from './audit';

describe('createAdminService', () => {
  let mockHttpClient: HttpClient;
  let mockAuditLogger: AuditLogger;
  let config: AdminServiceConfig;

  beforeEach(() => {
    mockHttpClient = {
      request: mock.fn(),
      get: mock.fn(),
      post: mock.fn(),
      put: mock.fn(),
    } as unknown as HttpClient;

    mockAuditLogger = {
      logAdminAction: mock.fn(),
    } as unknown as AuditLogger;

    config = {
      apiBaseUrl: 'https://api.example.com',
      httpClient: mockHttpClient,
      auditLogger: mockAuditLogger,
      logger: {
        info: mock.fn(),
        warn: mock.fn(),
        error: mock.fn(),
      },
    };
  });

  test('getSystemInfo returns payload on success', async () => {
    const service = createAdminService(config);
    const mockPayload = { version: '1.0.0' };

    // Mock successful response
    const mockResponse = new Response(JSON.stringify(mockPayload), { status: 200 });
    (mockHttpClient.get as any).mock.mockImplementation(async () => mockResponse);

    const result = await service.getSystemInfo();

    assert.deepStrictEqual(result, mockPayload);
    assert.strictEqual((mockHttpClient.get as any).mock.callCount(), 1);
    assert.strictEqual((mockAuditLogger.logAdminAction as any).mock.callCount(), 1);

    const auditCall = (mockAuditLogger.logAdminAction as any).mock.calls[0].arguments[0];
    assert.strictEqual(auditCall.action, 'system.info.read');
    assert.strictEqual(auditCall.status, 'success');
  });

  test('getSystemInfo returns null on failure', async () => {
    const service = createAdminService(config);

    // Mock failure response
    const mockResponse = new Response(JSON.stringify({ error: 'Failed' }), { status: 500 });
    (mockHttpClient.get as any).mock.mockImplementation(async () => mockResponse);

    const result = await service.getSystemInfo();

    assert.strictEqual(result, null);
    assert.strictEqual((mockAuditLogger.logAdminAction as any).mock.callCount(), 1);

    const auditCall = (mockAuditLogger.logAdminAction as any).mock.calls[0].arguments[0];
    assert.strictEqual(auditCall.status, 'failure');
  });

  test('updateDnsRecord sends correct payload', async () => {
    const service = createAdminService(config);
    const recordId = '123';
    const content = '127.0.0.1';

    // Mock successful response
    const mockResponse = new Response(JSON.stringify({ success: true }), { status: 200 });
    (mockHttpClient.put as any).mock.mockImplementation(async () => mockResponse);

    await service.updateDnsRecord(recordId, content);

    const putCall = (mockHttpClient.put as any).mock.calls[0];
    assert.strictEqual(putCall.arguments[0], `/dns/records/${recordId}`);
    assert.deepStrictEqual(putCall.arguments[1], { content });

    const auditCall = (mockAuditLogger.logAdminAction as any).mock.calls[0].arguments[0];
    assert.strictEqual(auditCall.action, 'dns.records.update');
    assert.strictEqual(auditCall.target, `dns:${recordId}`);
    assert.deepStrictEqual(auditCall.metadata, { recordId });
  });

  test('handles network errors gracefully', async () => {
    const service = createAdminService(config);

    (mockHttpClient.get as any).mock.mockImplementation(async () => {
      throw new Error('Network error');
    });

    const result = await service.getSystemInfo();

    assert.strictEqual(result, null);
    assert.strictEqual((config.logger!.error as any).mock.callCount(), 1);

    const auditCall = (mockAuditLogger.logAdminAction as any).mock.calls[0].arguments[0];
    assert.strictEqual(auditCall.status, 'failure');
  });

  test('listAccessPolicies sends correct query params', async () => {
    const service = createAdminService(config);
    const appId = 'app-123';

    const mockResponse = new Response(JSON.stringify([]), { status: 200 });
    (mockHttpClient.get as any).mock.mockImplementation(async () => mockResponse);

    await service.listAccessPolicies(appId);

    const getCall = (mockHttpClient.get as any).mock.calls[0];
    // Check if the URL contains the query param
    assert.ok(getCall.arguments[0].includes(`appId=${appId}`));
  });
});
