import { test } from 'node:test';
import * as assert from 'node:assert/strict';

import { __testing } from '../../src/pages/api/admin/lead-submissions.ts';

test('accepts same-origin POSTs via Origin header', () => {
  const request = new Request('https://admin.goldshore.ai/api/admin/lead-submissions', {
    method: 'POST',
    headers: {
      origin: 'https://admin.goldshore.ai',
    },
  });

  assert.equal(__testing.isSameOriginRequest(request), true);
});

test('rejects cross-site POSTs via Origin header', () => {
  const request = new Request('https://admin.goldshore.ai/api/admin/lead-submissions', {
    method: 'POST',
    headers: {
      origin: 'https://evil.example.com',
    },
  });

  assert.equal(__testing.isSameOriginRequest(request), false);
});

test('falls back to Referer when Origin is absent', () => {
  const request = new Request('https://admin.goldshore.ai/api/admin/lead-submissions', {
    method: 'POST',
    headers: {
      referer: 'https://admin.goldshore.ai/admin/forms',
    },
  });

  assert.equal(__testing.isSameOriginRequest(request), true);
});

test('rejects requests without browser same-origin context', () => {
  const request = new Request('https://admin.goldshore.ai/api/admin/lead-submissions', {
    method: 'POST',
  });

  assert.equal(__testing.isSameOriginRequest(request), false);
});
