import { test } from 'node:test';
import * as assert from 'node:assert/strict';

import { TURNSTILE_SITEVERIFY_URL, verifyTurnstileToken } from '../../src/utils/turnstile.ts';

test('contact Turnstile gate fails closed when secret is missing', async () => {
  const failure = await verifyTurnstileToken(undefined, 'token', '127.0.0.1');

  assert.equal(failure?.status, 503);
  assert.equal(failure?.code, 'turnstile_unconfigured');
});

test('contact Turnstile gate requires a response token', async () => {
  const failure = await verifyTurnstileToken('secret', '', '127.0.0.1');

  assert.equal(failure?.status, 403);
  assert.equal(failure?.code, 'turnstile_required');
});

test('contact Turnstile gate posts canonical siteverify payload', async () => {
  let siteverifyUrl = '';
  let siteverifyBody = '';

  const fetcher = (async (url: URL | RequestInfo, init?: RequestInit) => {
    siteverifyUrl = String(url);
    siteverifyBody = String(init?.body);
    return Response.json({ success: true, hostname: 'goldshore.ai', action: 'turnstile-spin-v2' });
  }) as typeof fetch;

  const failure = await verifyTurnstileToken(
    'secret-value',
    'response-token',
    '203.0.113.10',
    fetcher,
  );

  assert.equal(failure, null);
  assert.equal(siteverifyUrl, TURNSTILE_SITEVERIFY_URL);
  const params = new URLSearchParams(siteverifyBody);
  assert.equal(params.get('secret'), 'secret-value');
  assert.equal(params.get('response'), 'response-token');
  assert.equal(params.get('remoteip'), '203.0.113.10');
});

test('contact Turnstile gate rejects failed siteverify results', async () => {
  const fetcher = (async () =>
    Response.json({ success: false, 'error-codes': ['invalid-input-response'] })) as typeof fetch;

  const failure = await verifyTurnstileToken(
    'secret-value',
    'bad-token',
    '203.0.113.10',
    fetcher,
  );

  assert.equal(failure?.status, 403);
  assert.equal(failure?.code, 'turnstile_failed');
  assert.deepEqual(failure?.details?.errors, ['invalid-input-response']);
});
