import { test } from 'node:test';
import * as assert from 'node:assert/strict';

import {
  getAdminHostRewritePath,
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

test('treats admin org aliases as protected admin hosts', () => {
  const rule = getAdminRouteRule('/about', 'GET', 'admin.goldshore.org');

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

test('maps the admin hostname root to the existing dashboard route', () => {
  assert.equal(getAdminHostRewritePath('/'), '/app/dashboard');
});

test('maps clean admin hostname URLs into the Astro admin route tree', () => {
  assert.equal(
    getAdminHostRewritePath('/workers/status'),
    '/admin/workers/status',
  );
  assert.equal(
    getAdminHostRewritePath('/integrations/keys'),
    '/admin/integrations/keys',
  );
});

test('does not rewrite canonical admin, API, or static asset paths', () => {
  assert.equal(getAdminHostRewritePath('/admin/workers/status'), null);
  assert.equal(getAdminHostRewritePath('/api/admin/cf/workers'), null);
  assert.equal(getAdminHostRewritePath('/_astro/admin.js'), null);
});

test('falls unknown admin-host pages back to the dashboard', () => {
  assert.equal(getAdminHostRewritePath('/about'), '/app/dashboard');
});
