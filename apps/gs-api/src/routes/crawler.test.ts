import assert from 'node:assert/strict';
import test from 'node:test';
import crawler from './crawler';

const createMockKv = () => {
  const store = new Map<string, string>();
  return {
    list: async ({ prefix }: { prefix: string }) => ({
      keys: [...store.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name })),
    }),
    get: async (key: string, type?: string) => {
      const value = store.get(key) ?? null;
      return type === 'json' && value ? JSON.parse(value) : value;
    },
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
  };
};

test('crawler jobs can be created and listed from the unified API route', async () => {
  const kv = createMockKv();

  const createResponse = await crawler.request('/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain: 'example.com' }),
  }, { KV: kv } as any);

  assert.equal(createResponse.status, 201);
  const created = await createResponse.json() as { success: boolean; job: { domain: string } };
  assert.equal(created.success, true);
  assert.equal(created.job.domain, 'example.com');

  const listResponse = await crawler.request('/jobs', {}, { KV: kv } as any);
  assert.equal(listResponse.status, 200);
  const listed = await listResponse.json() as { success: boolean; total: number; jobs: Array<{ domain: string }> };
  assert.equal(listed.success, true);
  assert.equal(listed.total, 1);
  assert.equal(listed.jobs[0]?.domain, 'example.com');
});

test('crawler jobs reject invalid domains', async () => {
  const response = await crawler.request('/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain: 'not a domain' }),
  }, { KV: createMockKv() } as any);

  assert.equal(response.status, 400);
  const body = await response.json() as { error: string };
  assert.equal(body.error, 'Invalid domain format');
});
