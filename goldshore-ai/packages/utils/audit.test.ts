import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { logAuditEvent, type KVNamespaceLike } from './audit';

describe('Audit Logger', () => {
  it('should log audit event to KV with generated timestamp and UUID', async () => {
    const mockPut = mock.fn(async () => {});
    const mockKV: KVNamespaceLike = { put: mockPut };

    const details = {
      action: 'test:action',
      status: 'success' as const,
      actor: 'test-actor'
    };

    await logAuditEvent(mockKV, details);

    assert.strictEqual(mockPut.mock.calls.length, 1);
    const [key, value] = mockPut.mock.calls[0].arguments;

    // Check key format: audit:TIMESTAMP:UUID
    assert.match(key as string, /^audit:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z:[0-9a-f-]+$/);

    // Check payload
    const payload = JSON.parse(value as string);
    assert.strictEqual(payload.action, 'test:action');
    assert.strictEqual(payload.status, 'success');
    assert.strictEqual(payload.actor, 'test-actor');
    assert.ok(payload.timestamp);
  });

  it('should use provided timestamp if available', async () => {
    const mockPut = mock.fn(async () => {});
    const mockKV: KVNamespaceLike = { put: mockPut };
    const timestamp = '2023-01-01T00:00:00.000Z';

    await logAuditEvent(mockKV, {
      action: 'test:action',
      status: 'success',
      timestamp
    });

    const [key, value] = mockPut.mock.calls[0].arguments;
    assert.match(key as string, /^audit:2023-01-01T00:00:00\.000Z:[0-9a-f-]+$/);

    const payload = JSON.parse(value as string);
    assert.strictEqual(payload.timestamp, timestamp);
  });
});
