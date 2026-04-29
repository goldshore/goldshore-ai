import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert';
import { Hono } from 'hono';
// Import the module under test directly, relying on fetch mocking
// Note: We need to use dynamic import if we want to reset module state, but here we just test the logic.
// But since ai.ts is a module with side effects (creates Hono app), we should probably just import it once.
import ai from './ai.ts';

describe('AI Analysis Endpoint Caching', () => {
  // Save original fetch
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should verify provider calls (via fetch) for identical requests', async () => {
    const app = new Hono();

    // Mock KV environment
    const kvStore = new Map();
    const mockKV = {
      get: mock.fn(async (key: string) => {
        const val = kvStore.get(key);
        return val ? JSON.parse(val) : null;
      }),
      put: mock.fn(async (key: string, value: string) => {
        kvStore.set(key, value);
      }),
    };

    const mockExecutionCtx = {
      waitUntil: mock.fn(async (promise: Promise<any>) => {
        await promise;
      }),
      passThroughOnException: mock.fn(),
    };

    // Mock global fetch to intercept provider calls
    const mockFetch = mock.fn(async (url: string | URL | Request, init?: RequestInit) => {
      // Return a fake OpenAI response
      return new Response(JSON.stringify({
        choices: [
          { message: { content: 'Mocked analysis result' } }
        ]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });
    global.fetch = mockFetch as any;

    app.route('/', ai);

    const requestBody = {
      provider: 'openai',
      input: { prompt: 'Test prompt' },
    };

    // First request
    const res1 = await app.request('/analysis', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    }, {
      KV: mockKV,
      OPENAI_API_KEY: 'test-key',
    }, mockExecutionCtx as any);

    assert.strictEqual(res1.status, 200);
    const data1 = await res1.json() as any;
    // The provider wrapper might transform the response.
    // Assuming openAIProvider returns { provider: 'openai', output: ... }
    // Let's just check that we got a response.
    assert.ok(data1.output);

    // Second request (identical)
    const res2 = await app.request('/analysis', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    }, {
      KV: mockKV,
      OPENAI_API_KEY: 'test-key',
    }, mockExecutionCtx as any);

    assert.strictEqual(res2.status, 200);
    const data2 = await res2.json() as any;
    assert.strictEqual(data2.output, data1.output);

    // After optimization, it should be called once.
    assert.strictEqual(mockFetch.mock.callCount(), 1, 'Expected 1 fetch call with caching');
    assert.strictEqual(res2.headers.get('X-Cache'), 'HIT');
  });
});
