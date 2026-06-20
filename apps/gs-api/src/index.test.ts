import { test } from 'node:test';
import * as assert from 'node:assert/strict';

import app, { isAllowedOrigin, isPreviewOrigin } from './index';

const requiredRuntimeEnv = {
  PLATFORM_DB: {} as any,
  GS_ASSETS: {} as any,
  AI: {} as any,
  JWT_SECRET: 'test-jwt-secret',
  STRIPE_API_KEY: 'test-stripe-key',
  SENDGRID_API_KEY: 'test-sendgrid-key',
  ACCESS_CLIENT_SECRET: 'test-access-client-secret',
};

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
