import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import app from './index';

function makeFetcher(handler: (req: Request) => Promise<Response> | Response): Fetcher {
  return {
    fetch(req: RequestInfo | URL, init?: RequestInit) {
      const request = req instanceof Request ? req : new Request(req, init);
      return Promise.resolve(handler(request));
    },
  } as Fetcher;
}

describe('gateway security policy', () => {
  const baseEnv = {
    ENV: 'preview',
    ACCESS_CLIENT_SECRET: 'test-secret',
    API_SERVICE: makeFetcher(() => new Response(JSON.stringify({ upstream: 'ok' }), { status: 200 })),
    AI_CACHE: {} as KVNamespace,
  };

  it('fails closed for non-signals routes when SECURITY_CHECK errors', async () => {
    const res = await app.request('https://gw.goldshore.ai/status', {
      headers: { 'CF-Access-Jwt-Assertion': 'test-jwt' },
    }, {
      ...baseEnv,
      SECURITY_CHECK: makeFetcher(() => {
        throw new Error('security service down');
      }),
    });

    assert.equal(res.status, 503);
    const body = await res.json() as { policy?: string };
    assert.equal(body.policy, 'fail-closed');
  });

  it('fails open for signals routes when SECURITY_CHECK errors', async () => {
    const res = await app.request('https://gw.goldshore.ai/signals', {
      method: 'POST',
      headers: { 'CF-Access-Jwt-Assertion': 'test-jwt' },
      body: JSON.stringify({ signal: 'latency_warning' }),
    }, {
      ...baseEnv,
      SECURITY_CHECK: makeFetcher(() => {
        throw new Error('security service down');
      }),
    });

    assert.equal(res.status, 404);
  });

  it('fails closed for non-signals routes when SECURITY_CHECK is missing', async () => {
    const res = await app.request('https://gw.goldshore.ai/status', {}, baseEnv);

    assert.equal(res.status, 503);
    const body = await res.json() as { policy?: string };
    assert.equal(body.policy, 'fail-closed');
  });

  it('fails open for signals routes when SECURITY_CHECK is missing', async () => {
    const res = await app.request('https://gw.goldshore.ai/signals', {}, baseEnv);

    assert.equal(res.status, 404);
  });

  it('enforces fail-closed for non-signals routes when SECURITY_CHECK returns non-ok', async () => {
    const res = await app.request('https://gw.goldshore.ai/status', {
      headers: { 'CF-Access-Jwt-Assertion': 'test-jwt' },
    }, {
      ...baseEnv,
      SECURITY_CHECK: makeFetcher(() => new Response('blocked', { status: 403 })),
    });

    assert.equal(res.status, 403);
    const body = await res.json() as { policy?: string };
    assert.equal(body.policy, 'fail-closed');
  });

  it('fails closed for non-signals routes when SECURITY_CHECK is missing', async () => {
    const res = await app.request('https://gw.goldshore.ai/status', {
      headers: { 'CF-Access-Jwt-Assertion': 'test-jwt' },
    }, baseEnv);

    assert.equal(res.status, 503);
    const body = await res.json() as { policy?: string };
    assert.equal(body.policy, 'fail-closed');
  });

  it('fails open for signals routes when SECURITY_CHECK is missing', async () => {
    const res = await app.request('https://gw.goldshore.ai/signals', {
      method: 'POST',
      headers: { 'CF-Access-Jwt-Assertion': 'test-jwt' },
      body: JSON.stringify({ signal: 'latency_warning' }),
    }, baseEnv);

    assert.notEqual(res.status, 503);
  });

});
