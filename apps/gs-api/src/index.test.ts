import { test } from 'node:test';
import * as assert from 'node:assert/strict';

import worker, { app, isAllowedOrigin, isPreviewOrigin, isPublicPath } from './index';

const requiredRuntimeEnv = {
  KV: { get: async () => null } as any,
  PLATFORM_DB: { prepare: () => ({ first: async () => ({ ok: 1 }) }) } as any,
  GS_ASSETS: {} as any,
  MAIL_ARCHIVE: {} as any,
  MAIL_JOBS_QUEUE: {} as any,
  EMAIL: {} as any,
  AI: {} as any,
  JWT_SECRET: 'test-jwt-secret',
  ACCESS_CLIENT_SECRET: 'test-access-client-secret',
};

test('keeps shallow production health independent of optional provider secrets', async () => {
  const response = await app.request(
    '/health',
    {},
    {
      ...requiredRuntimeEnv,
      ENV: 'production',
      CLOUDFLARE_ACCESS_AUDIENCE: 'test-audience',
      CONTROL_SYNC_TOKEN: 'test-control-token',
    } as any,
  );

  assert.equal(response.status, 200);
});

test('exposes the dependency readiness summary without Cloudflare Access', async () => {
  const response = await app.request('/ready', {}, requiredRuntimeEnv as any);

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    status: string;
    dependencySummary: { ready: number; total: number };
  };
  assert.equal(payload.status, 'ready');
  assert.equal(payload.dependencySummary.ready, payload.dependencySummary.total);
});

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

test('allows only public form submission writes through API authentication', () => {
  assert.equal(isPublicPath('/v1/forms/contact/submissions', 'POST'), true);
  assert.equal(isPublicPath('/v1/forms/newsletter/submissions', 'POST'), true);
  assert.equal(isPublicPath('/v1/forms/newsletter/confirm', 'GET'), true);
  assert.equal(isPublicPath('/v1/forms/newsletter/unsubscribe', 'GET'), true);
  assert.equal(isPublicPath('/v1/forms/contact/submissions', 'GET'), false);
  assert.equal(isPublicPath('/v1/forms/subscribers', 'GET'), false);
  assert.equal(isPublicPath('/v1/forms/configs', 'GET'), false);
  assert.equal(isPublicPath('/v1/forms/leads', 'GET'), false);
  assert.equal(isPublicPath('/pages/public', 'GET'), true);
  assert.equal(isPublicPath('/pages/public/slug/example-post', 'GET'), true);
  assert.equal(isPublicPath('/pages/public', 'POST'), false);
  assert.equal(isPublicPath('/pages/private-draft', 'GET'), false);
});

test('exposes /version without Cloudflare Access', async () => {
  const response = await app.request(
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

for (const [hostname, service] of [
  ['api.goldshore.ai', 'gs-api'],
  ['api.goldshore.org', 'gs-api'],
  ['agent.goldshore.ai', 'gs-api-agent'],
  ['mail.goldshore.ai', 'gs-api-mail'],
  ['ops.goldshore.ai', 'gs-api-control'],
  ['trading.goldshore.ai', 'gs-api-trading'],
  ['dashboard.goldshore.ai', 'gs-api-trading'],
  ['dash.goldshore.ai', 'gs-api-trading'],
  ['gw.goldshore.ai', 'gs-api-core'],
] as const) {
  test(`routes ${hostname} health requests to ${service}`, async () => {
    const response = await worker.fetch(
      new Request(`https://${hostname}/health`),
      requiredRuntimeEnv as any,
      {
        waitUntil() {},
        passThroughOnException() {},
        props: {},
      } as ExecutionContext,
    );

    assert.equal(response.status, 200);
    assert.equal(((await response.json()) as { service: string }).service, service);
  });
}

test('emits the same release headers through both production API aliases', async () => {
  const env = { ...requiredRuntimeEnv, GIT_SHA: 'release-sha' } as any;
  for (const hostname of ['api.goldshore.ai', 'api.goldshore.org']) {
    const response = await worker.fetch(
      new Request(`https://${hostname}/health`),
      env,
      {} as ExecutionContext,
    );
    assert.equal(response.headers.get('x-gs-api-version'), 'release-sha');
    assert.equal(response.headers.get('x-gs-deploy-sha'), 'release-sha');
  }
});

test('fails closed when protected routes are missing the Access audience', async () => {
  const response = await app.request('/system/status', {}, { ...requiredRuntimeEnv } as any);

  assert.equal(response.status, 503);
});

test('requires Cloudflare Access on protected routes', async () => {
  const response = await app.request(
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
