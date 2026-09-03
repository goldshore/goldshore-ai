import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCorrelationId } from './correlation-id';

describe('correlation-id middleware', () => {
  describe('getCorrelationId', () => {
    it('should return correlation ID from request header if present', () => {
      const headerValue = 'test-correlation-id-12345';
      const headers = new Headers({
        'x-correlation-id': headerValue,
      });
      const request = new Request('http://localhost/test', { headers });

      const correlationId = getCorrelationId(request);
      assert.strictEqual(correlationId, headerValue);
    });

    it('should trim whitespace from correlation ID header', () => {
      const headerValue = '  test-correlation-id  ';
      const headers = new Headers({
        'x-correlation-id': headerValue,
      });
      const request = new Request('http://localhost/test', { headers });

      const correlationId = getCorrelationId(request);
      assert.strictEqual(correlationId, headerValue.trim());
    });

    it('should truncate correlation ID to 128 characters', () => {
      const longId = 'a'.repeat(200);
      const headers = new Headers({
        'x-correlation-id': longId,
      });
      const request = new Request('http://localhost/test', { headers });

      const correlationId = getCorrelationId(request);
      assert.strictEqual(correlationId, 'a'.repeat(128));
    });

    it('should generate UUID when correlation ID header is missing', () => {
      const headers = new Headers();
      const request = new Request('http://localhost/test', { headers });

      const correlationId = getCorrelationId(request);

      assert.ok(correlationId);
      assert.strictEqual(typeof correlationId, 'string');
      assert.match(correlationId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should ignore empty correlation ID header and generate UUID', () => {
      const headers = new Headers({
        'x-correlation-id': '   ',
      });
      const request = new Request('http://localhost/test', { headers });

      const correlationId = getCorrelationId(request);

      assert.ok(correlationId);
      assert.strictEqual(typeof correlationId, 'string');
      assert.match(correlationId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should be case-insensitive for header name', () => {
      const headerValue = 'test-id-123';
      const headers = new Headers({
        'X-Correlation-ID': headerValue,
      });
      const request = new Request('http://localhost/test', { headers });

      const correlationId = getCorrelationId(request);
      assert.strictEqual(correlationId, headerValue);
    });
  });
});
