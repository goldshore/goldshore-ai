import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ssrfProtectionMiddleware } from './ssrf-protection';

describe('SSRF Protection Middleware', () => {
  it('allows normal /v1/ paths', async () => {
    const mockContext = {
      req: {
        path: '/v1/users/profile',
      },
    } as any;

    let nextCalled = false;
    const mockNext = async () => {
      nextCalled = true;
    };

    await ssrfProtectionMiddleware(mockContext, mockNext);
    assert.strictEqual(nextCalled, true, 'next should be called for valid paths');
  });

  it('rejects paths with .. traversal', async () => {
    const mockContext = {
      req: {
        path: '/v1/test/../../../etc/passwd',
      },
      text: (msg: string, status: number) => new Response(msg, { status }),
    } as any;

    let nextCalled = false;
    const mockNext = async () => {
      nextCalled = true;
    };

    const result = await ssrfProtectionMiddleware(mockContext, mockNext);
    assert.strictEqual(nextCalled, false, 'next should not be called for invalid paths');
    assert.ok(result instanceof Response);
  });

  it('rejects paths with %2e%2e encoding', async () => {
    const mockContext = {
      req: {
        path: '/v1/test/%2e%2e/%2e%2e/admin',
      },
      text: (msg: string, status: number) => new Response(msg, { status }),
    } as any;

    let nextCalled = false;
    const mockNext = async () => {
      nextCalled = true;
    };

    const result = await ssrfProtectionMiddleware(mockContext, mockNext);
    assert.strictEqual(nextCalled, false, 'next should not be called for percent-encoded traversal');
    assert.ok(result instanceof Response);
  });

  it('rejects double-encoded traversal sequences', async () => {
    const mockContext = {
      req: {
        path: '/v1/%252e%252e/%252e%252e/admin',
      },
      text: (msg: string, status: number) => new Response(msg, { status }),
    } as any;

    let nextCalled = false;
    const mockNext = async () => {
      nextCalled = true;
    };

    const result = await ssrfProtectionMiddleware(mockContext, mockNext);
    assert.strictEqual(nextCalled, false, 'next should not be called for double-encoded traversal');
    assert.ok(result instanceof Response);
  });

  it('rejects malformed percent-encoding', async () => {
    const mockContext = {
      req: {
        path: '/v1/%',
      },
      text: (msg: string, status: number) => new Response(msg, { status }),
    } as any;

    let nextCalled = false;
    const mockNext = async () => {
      nextCalled = true;
    };

    const result = await ssrfProtectionMiddleware(mockContext, mockNext);
    assert.strictEqual(nextCalled, false, 'next should not be called for malformed encoding');
    assert.ok(result instanceof Response);
  });

  it('allows paths outside /v1/ prefix to skip validation', async () => {
    const mockContext = {
      req: {
        path: '/health',
      },
    } as any;

    let nextCalled = false;
    const mockNext = async () => {
      nextCalled = true;
    };

    await ssrfProtectionMiddleware(mockContext, mockNext);
    assert.strictEqual(nextCalled, true, 'next should be called for non-/v1/ paths');
  });
});
