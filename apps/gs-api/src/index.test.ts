import { test } from 'node:test';
import * as assert from 'node:assert/strict';

import worker, { isAllowedOrigin, isPreviewOrigin } from './index';

const requiredRuntimeEnv = {
  PLATFORM_DB: {} as any,
  GS_ASSETS: {} as any,
  AI: {} as any,
  JWT_SECRET: 'test-jwt-secret',
  STRIPE_API_KEY: 'test-stripe-key',
  SENDGRID_API_KEY: 'test-sendgrid-key',
  ACCESS_CLIENT_SECRET: 'test-access-client-secret',
};

function request(path: string, init: RequestInit = {}, env: Record<string, unknown> = requiredRuntimeEnv) {
  const url = path.startsWith('http') ? path : `https://api.goldshore.ai${path}`;
  return worker.fetch(new Request(url, init), env as any, {
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
  } as any);
}

async function githubSignature(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return `sha256=${[...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

test('allows documented preview goldshore.ai origins', () => {
  assert.equal(isPreviewOrigin('https://feature-123-preview.goldshore.ai'), true);
  assert.equal(isAllowedOrigin('https://feature-123-preview.goldshore.ai'), true);
});

test('allows documented goldshore-pages.dev preview origins', () => {
  assert.equal(isPreviewOrigin('https://branch-name.goldshore-pages.dev'), true);
  assert.equal(isAllowedOrigin('https://branch-name.goldshore-pages.dev'), true);
});

test('rejects unrelated origins', () => {
  assert.equal(isAllowedOrigin('https://evil.example.com'), false);
});

test('exposes /version without Cloudflare Access', async () => {
  const response = await request(
    '/version',
    {},
    {
      ...requiredRuntimeEnv,
      API_VERSION: '2026.05.25',
      GIT_SHA: 'abc1234',
      DEPLOY_SHA: 'abc1234',
    } as any,
  );

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    service: string;
    version: string;
    deploySha: string | null;
  };
  assert.equal(payload.service, 'gs-api');
  assert.equal(payload.version, '2026.05.25');
  assert.equal(payload.deploySha, 'abc1234');
});

test('accepts signed GitHub webhook without Cloudflare Access', async () => {
  const body = JSON.stringify({
    zen: 'Keep it logically consistent.',
    hook_id: 123,
    repository: { full_name: 'marzton/goldshore-ai', default_branch: 'main' },
    sender: { login: 'marzton' },
  });
  const secret = 'test-github-webhook-secret';
  const response = await request(
    '/webhook/github',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Delivery': 'delivery-1',
        'X-GitHub-Event': 'ping',
        'X-Hub-Signature-256': await githubSignature(secret, body),
      },
      body,
    },
    {
      ...requiredRuntimeEnv,
      GITHUB_WEBHOOK_SECRET: secret,
      GITHUB_STATUS_REPORTING_DISABLED: '1',
    } as any,
  );

  assert.equal(response.status, 200);
  const payload = (await response.json()) as { ok: boolean; message: string };
  assert.equal(payload.ok, true);
  assert.equal(payload.message, 'pong');
});

test('rejects unsigned GitHub webhook without invoking Access', async () => {
  const response = await request(
    '/webhook/github',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Delivery': 'delivery-2',
        'X-GitHub-Event': 'ping',
      },
      body: JSON.stringify({}),
    },
    {
      ...requiredRuntimeEnv,
      GITHUB_WEBHOOK_SECRET: 'test-github-webhook-secret',
    } as any,
  );

  assert.equal(response.status, 400);
});

test('rejects malformed signed GitHub webhook JSON before recording delivery', async () => {
  const body = '{';
  const secret = 'test-github-webhook-secret';
  let deliveryRecorded = false;

  const response = await request(
    '/webhook/github',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Delivery': 'delivery-bad-json',
        'X-GitHub-Event': 'ping',
        'X-Hub-Signature-256': await githubSignature(secret, body),
      },
      body,
    },
    {
      ...requiredRuntimeEnv,
      GITHUB_WEBHOOK_SECRET: secret,
      KV: {
        get: async () => null,
        put: async () => {
          deliveryRecorded = true;
        },
      },
    } as any,
  );

  assert.equal(response.status, 400);
  assert.equal(deliveryRecorded, false);
});

test('acknowledges signed non-deploy GitHub App events without running hooks', async () => {
  const body = JSON.stringify({
    action: 'published',
    security_advisory: {
      ghsa_id: 'GHSA-test-test-test',
      severity: 'high',
    },
    sender: { login: 'github' },
  });
  const secret = 'test-github-webhook-secret';
  const writes: string[] = [];

  const response = await request(
    '/webhook/github',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Delivery': 'delivery-security-advisory',
        'X-GitHub-Event': 'security_advisory',
        'X-Hub-Signature-256': await githubSignature(secret, body),
      },
      body,
    },
    {
      ...requiredRuntimeEnv,
      GITHUB_WEBHOOK_SECRET: secret,
      GITHUB_WEBHOOK_POST_DEPLOY_URLS: 'https://hooks.example.test/deploy',
      KV: {
        get: async () => null,
        put: async (key: string) => {
          writes.push(key);
        },
      },
    } as any,
  );

  assert.equal(response.status, 202);
  const payload = (await response.json()) as { ok: boolean; ignored: boolean; event: string };
  assert.equal(payload.ok, true);
  assert.equal(payload.ignored, true);
  assert.equal(payload.event, 'security_advisory');
  assert.deepEqual(writes, [
    'github:webhook:delivery:delivery-security-advisory',
    'github:webhook:event:delivery-security-advisory',
  ]);
});

test('allows GitHub OAuth callback to fail on state instead of Access', async () => {
  const response = await request(
    '/oauth/github/callback?code=test-code&state=missing-state',
    {},
    {
      ...requiredRuntimeEnv,
      KV: {
        get: async () => null,
      },
    } as any,
  );

  assert.equal(response.status, 401);
});

test('fails closed when protected routes are missing the Access audience', async () => {
  const response = await request('/system/status', {}, { ...requiredRuntimeEnv } as any);

  assert.equal(response.status, 503);
});

test('requires Cloudflare Access on protected routes', async () => {
  const response = await request(
    '/system/status',
    {},
    {
      ...requiredRuntimeEnv,
      CLOUDFLARE_ACCESS_AUDIENCE: 'test-audience',
      CLOUDFLARE_TEAM_DOMAIN: 'goldshore.cloudflareaccess.com',
    } as any,
  );

  assert.equal(response.status, 401);
});
