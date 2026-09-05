import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import webhooks from './webhooks';

const workerSource = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');

const payload = JSON.stringify({
  zen: 'Keep it logically awesome.',
  repository: { full_name: 'marzton/goldshore-ai' },
});

const env = {
  GS_GITHUB_WEBHOOK_SECRET: 'test-webhook-secret',
  AUDIT_DB: {
    prepare: () => ({
      bind: () => ({
        run: async () => ({ success: true }),
      }),
    }),
  },
  KV: { put: async () => undefined },
};

test('the Worker mounts signed GitHub webhooks before interactive Access', () => {
  assert.ok(workerSource.includes("app.route('/webhooks', webhooks);"));
  assert.ok(
    workerSource.includes(
      "if (method === 'POST' && /^\\/webhooks\\/github\\/[^/]+\\/?$/i.test(path)) return true;",
    ),
  );
});

test('GitHub webhooks reject unsigned requests before parsing payloads', async () => {
  const response = await webhooks.request('/github/push', {
    method: 'POST',
    body: payload,
  }, env);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Missing webhook signature' });
});

test('GitHub webhook ping validates HMAC and records a durable receipt', async () => {
  const signature = `sha256=${createHmac('sha256', env.GS_GITHUB_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex')}`;

  const response = await webhooks.request('/github/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-GitHub-Event': 'ping',
      'X-Hub-Signature-256': signature,
    },
    body: payload,
  }, env);

  assert.equal(response.status, 200);
  const body = await response.json() as { success: boolean; event: string };
  assert.equal(body.success, true);
  assert.equal(body.event, 'ping');
});
