import { test } from 'node:test';
import * as assert from 'node:assert/strict';

import {
  GOLDSHORE_API_ORIGINS,
  WEB_CONNECT_SRC,
  WEB_CONTENT_SECURITY_POLICY,
  WEB_HEADERS_CSP,
  WEB_META_CSP,
  buildContentSecurityPolicy,
} from '../../src/utils/csp.ts';

test('approved API origins stay limited to the documented production and preview hosts', () => {
  assert.deepEqual(GOLDSHORE_API_ORIGINS, [
    'https://api.goldshore.ai',
    'https://api-preview.goldshore.ai',
  ]);
});

test('connect-src allows same-origin and GoldShore API origins used by browser runtime code', () => {
  assert.deepEqual(WEB_CONNECT_SRC, [
    "'self'",
    'https://api.goldshore.ai',
    'https://api-preview.goldshore.ai',
  ]);
});

test('buildContentSecurityPolicy serializes directives in declaration order', () => {
  assert.equal(
    buildContentSecurityPolicy({
      'default-src': ["'self'"],
      'img-src': ["'self'", 'data:'],
    }),
    "default-src 'self'; img-src 'self' data:",
  );
});

test('meta CSP includes the required browser directives and omits header-only frame protections', () => {
  assert.match(
    WEB_META_CSP,
    /connect-src 'self' https:\/\/api\.goldshore\.ai https:\/\/api-preview\.goldshore\.ai/,
  );
  assert.doesNotMatch(WEB_META_CSP, /frame-ancestors/);
});

test('header CSP preserves frame protections and matches the legacy web CSP export', () => {
  assert.match(
    WEB_HEADERS_CSP,
    /connect-src 'self' https:\/\/api\.goldshore\.ai https:\/\/api-preview\.goldshore\.ai/,
  );
  assert.match(WEB_HEADERS_CSP, /frame-ancestors 'none'/);
});
