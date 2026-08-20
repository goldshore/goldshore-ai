import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getOptimizedCorsHeaders } from './cors-optimized';

describe('CORS Optimization Middleware', () => {
  it('returns CORS headers for allowed origin', () => {
    const env = {
      CORS_ALLOWED: JSON.stringify(['https://goldshore.ai', 'https://example.com']),
    } as any;

    const headers = getOptimizedCorsHeaders('https://goldshore.ai', env);
    assert.strictEqual(headers['Access-Control-Allow-Origin'], 'https://goldshore.ai');
    assert.strictEqual(headers['Access-Control-Allow-Credentials'], 'true');
    assert.ok(headers['Access-Control-Allow-Methods']);
  });

  it('returns empty object for disallowed origin', () => {
    const env = {
      CORS_ALLOWED: JSON.stringify(['https://goldshore.ai']),
    } as any;

    const headers = getOptimizedCorsHeaders('https://other-origin.ai', env);
    assert.deepStrictEqual(headers, {});
  });

  it('handles malformed CORS_ALLOWED gracefully', () => {
    const env = {
      CORS_ALLOWED: 'invalid-json',
    } as any;

    const headers = getOptimizedCorsHeaders('https://goldshore.ai', env);
    assert.deepStrictEqual(headers, {});
  });

  it('memoizes parsed CORS configuration', () => {
    const env = {
      CORS_ALLOWED: JSON.stringify(['https://goldshore.ai']),
    } as any;

    // First call
    const headers1 = getOptimizedCorsHeaders('https://goldshore.ai', env);
    assert.ok(headers1['Access-Control-Allow-Origin']);

    // Second call should use cached value (verify no console errors)
    const headers2 = getOptimizedCorsHeaders('https://goldshore.ai', env);
    assert.deepStrictEqual(headers1, headers2);
  });

  it('detects when CORS_ALLOWED changes and resets cache', () => {
    const env1 = {
      CORS_ALLOWED: JSON.stringify(['https://goldshore.ai']),
    } as any;

    const headers1 = getOptimizedCorsHeaders('https://goldshore.ai', env1);
    assert.ok(headers1['Access-Control-Allow-Origin']);

    // Simulate env var change
    const env2 = {
      CORS_ALLOWED: JSON.stringify(['https://example.com']),
    } as any;

    const headers2 = getOptimizedCorsHeaders('https://goldshore.ai', env2);
    assert.deepStrictEqual(headers2, {}, 'should recache when config changes');

    const headers3 = getOptimizedCorsHeaders('https://example.com', env2);
    assert.ok(headers3['Access-Control-Allow-Origin']);
  });

  it('handles empty CORS_ALLOWED array', () => {
    const env = {
      CORS_ALLOWED: JSON.stringify([]),
    } as any;

    const headers = getOptimizedCorsHeaders('https://any-origin.com', env);
    assert.deepStrictEqual(headers, {});
  });

  it('handles undefined CORS_ALLOWED', () => {
    const env = {} as any;

    const headers = getOptimizedCorsHeaders('https://any-origin.com', env);
    assert.deepStrictEqual(headers, {});
  });
});
