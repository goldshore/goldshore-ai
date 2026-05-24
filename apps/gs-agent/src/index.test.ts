import { test } from 'node:test';
import assert from 'node:assert';
import worker from './index.ts';

test('keeps the status and health endpoints public', async () => {
  const rootResponse = await worker.fetch(new Request('https://agent.goldshore.ai/'), {
    ENV: 'production',
    AGENT_KV: { get: async () => null }
  } as any);

  assert.strictEqual(rootResponse.status, 200);

  const healthResponse = await worker.fetch(new Request('https://agent.goldshore.ai/health'), {
    ENV: 'production',
    AGENT_KV: { get: async () => null }
  } as any);

  assert.strictEqual(healthResponse.status, 200);
});

test('protects templates from anonymous access', async () => {
  const response = await worker.fetch(new Request('https://agent.goldshore.ai/templates'), {
    ENV: 'development',
    AGENT_KV: { get: async () => JSON.stringify({ secret: 'value' }) }
  } as any);

  assert.strictEqual(response.status, 401);
});

test('fails closed in production when protected routes are missing an Access audience', async () => {
  const response = await worker.fetch(new Request('https://agent.goldshore.ai/templates'), {
    ENV: 'production',
    AGENT_KV: { get: async () => null }
  } as any);

  assert.strictEqual(response.status, 500);
});
