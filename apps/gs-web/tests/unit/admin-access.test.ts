import { test } from 'node:test';
import * as assert from 'node:assert/strict';

import {
  getAdminRouteRule,
  getCanonicalAdminUrl,
} from '../../src/utils/admin-access.ts';

test('routes dashboard traffic to the admin host with system read access', () => {
  const rule = getAdminRouteRule('/app/dashboard', 'GET', 'goldshore.ai');

  assert.deepEqual(rule, {
    canonicalPath: '/app/dashboard',
    kind: 'page',
    permission: 'system:read',
    requiresAdminRole: true,
  });
  assert.equal(getCanonicalAdminUrl('/app/dashboard'), 'https://admin.goldshore.ai/app/dashboard');
});

test('requires forms write access for mutating admin APIs', () => {
  const rule = getAdminRouteRule(
    '/api/admin/lead-submissions',
    'POST',
    'admin.goldshore.ai',
  );

  assert.deepEqual(rule, {
    canonicalPath: '/api/admin/lead-submissions',
    kind: 'api',
    permission: 'forms:write',
    requiresAdminRole: true,
  });
});

test('redirects non-admin routes on the admin host back to the dashboard', () => {
  const rule = getAdminRouteRule('/about', 'GET', 'admin.goldshore.ai');

  assert.deepEqual(rule, {
    canonicalPath: '/app/dashboard',
    kind: 'page',
    permission: 'system:read',
    requiresAdminRole: true,
  });
});

test('leaves public site routes alone on the public host', () => {
  const rule = getAdminRouteRule('/about', 'GET', 'goldshore.ai');

  assert.equal(rule, null);
});
