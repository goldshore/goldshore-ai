import { test } from 'node:test';
import * as assert from 'node:assert/strict';

import { isSameOriginRequest } from '../../src/utils/security.ts';

test('isSameOriginRequest: accepts same-origin POSTs via Origin header', () => {
  const request = new Request('https://goldshore.ai/api/contact', {
    method: 'POST',
    headers: {
      origin: 'https://goldshore.ai',
    },
  });

  assert.equal(isSameOriginRequest(request), true);
});

test('isSameOriginRequest: rejects cross-site POSTs via Origin header', () => {
  const request = new Request('https://goldshore.ai/api/contact', {
    method: 'POST',
    headers: {
      origin: 'https://evil.example.com',
    },
  });

  assert.equal(isSameOriginRequest(request), false);
});

test('isSameOriginRequest: falls back to Referer when Origin is absent', () => {
  const request = new Request('https://goldshore.ai/api/contact', {
    method: 'POST',
    headers: {
      referer: 'https://goldshore.ai/contact',
    },
  });

  assert.equal(isSameOriginRequest(request), true);
});

test('isSameOriginRequest: rejects requests without browser same-origin context', () => {
  const request = new Request('https://goldshore.ai/api/contact', {
    method: 'POST',
  });

  assert.equal(isSameOriginRequest(request), false);
});

test('isSameOriginRequest: accepts same-origin via Sec-Fetch-Site', () => {
  const request = new Request('https://goldshore.ai/api/contact', {
    method: 'POST',
    headers: {
      'sec-fetch-site': 'same-origin',
    },
  });

  assert.equal(isSameOriginRequest(request), true);
});
