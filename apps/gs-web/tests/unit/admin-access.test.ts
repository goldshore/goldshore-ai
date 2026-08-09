import { test } from 'node:test';
import * as assert from 'node:assert/strict';

import { ROLE_PERMISSIONS } from '@goldshore/auth';
import {
  ALTERNATE_ADMIN_DASHBOARD_URL,
  CANONICAL_ADMIN_DASHBOARD_URL,
  buildCloudflareAccessAdminSession,
  getAdminLoginDestination,
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
  assert.equal(CANONICAL_ADMIN_DASHBOARD_URL, 'https://admin.goldshore.ai/app/dashboard');
  assert.equal(ALTERNATE_ADMIN_DASHBOARD_URL, 'https://admin.goldshore.org/app/dashboard');
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

test('sends admin login destinations directly to the dashboard path', () => {
  assert.equal(getAdminLoginDestination('dashboard'), CANONICAL_ADMIN_DASHBOARD_URL);
  assert.equal(getAdminLoginDestination('admin'), CANONICAL_ADMIN_DASHBOARD_URL);
  assert.equal(getAdminLoginDestination('ai'), CANONICAL_ADMIN_DASHBOARD_URL);
  assert.equal(getAdminLoginDestination('org'), ALTERNATE_ADMIN_DASHBOARD_URL);
  assert.equal(getAdminLoginDestination('unknown'), CANONICAL_ADMIN_DASHBOARD_URL);
});

test('grants the admin session to an identity verified by the admin Access application', () => {
  const session = buildCloudflareAccessAdminSession({
    sub: 'access-user',
    email: 'operator@example.com',
  });

  assert.deepEqual(session.roles, ['admin']);
  assert.ok(session.permissions.includes('system:read'));
  assert.ok(session.permissions.includes('system:write'));
});

test('preserves an explicit supported role from Cloudflare Access claims', () => {
  const session = buildCloudflareAccessAdminSession({
    sub: 'access-viewer',
    roles: ['viewer'],
  });

  assert.deepEqual(session.roles, ['viewer']);

  // The point of this case is that an explicit role is preserved rather than
  // escalated to the blanket admin session, so assert against the viewer role
  // definition instead of a hand-copied permission list.
  assert.deepEqual(session.permissions, ROLE_PERMISSIONS.viewer);
  assert.ok(session.permissions.includes('content:read'));
  assert.ok(!session.permissions.includes('content:write'));
  assert.ok(!session.permissions.includes('system:write'));
});

test('login page uses dashboard destinations instead of admin host roots', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) =>
    readFile(new URL('../../src/pages/login.astro', import.meta.url), 'utf8'),
  );

  assert.match(source, /const destination = getAdminLoginDestination\(requested\)/);
  assert.match(source, /href=\{CANONICAL_ADMIN_DASHBOARD_URL\}/);
  assert.match(source, /href=\{ALTERNATE_ADMIN_DASHBOARD_URL\}/);
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

test('keeps the sign-in and sign-out routes reachable on the admin host', () => {
  // These must not fold back to the dashboard: the dashboard requires a
  // session, so rewriting /login would bounce an unauthenticated operator
  // between /login and /app/dashboard forever.
  assert.equal(getAdminHostRewritePath('/login'), null);
  assert.equal(getAdminHostRewritePath('/logout'), null);

  assert.equal(getAdminRouteRule('/login', 'GET', 'admin.goldshore.ai'), null);
  assert.equal(getAdminRouteRule('/logout', 'GET', 'admin.goldshore.ai'), null);
});

test('admin pages use the admin layout rather than the public site chrome', async () => {
  // BaseLayout renders PublicHeader, whose nav links are relative. On the
  // admin hostname they resolve against that host and are then folded back to
  // the dashboard, leaving no route to the public site.
  const { readdir, readFile } = await import('node:fs/promises');
  const roots = ['../../src/pages/admin', '../../src/pages/app'];
  const offenders: string[] = [];

  for (const root of roots) {
    const dir = new URL(`${root}/`, import.meta.url);
    for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.astro')) continue;
      const file = new URL(`${entry.parentPath ?? dir.pathname}/${entry.name}`.replace(/\/+/g, '/'), 'file:');
      const source = await readFile(file, 'utf8');
      if (/BaseLayout/.test(source)) offenders.push(entry.name);
    }
  }

  assert.deepEqual(offenders, []);
});

test('middleware routes the admin hostname through its resolved dashboard path', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) =>
    readFile(new URL('../../src/middleware.ts', import.meta.url), 'utf8'),
  );

  assert.match(source, /const routedPath = adminRewritePath \?\? url\.pathname/);
  assert.match(source, /getAdminRouteRule\(\s*routedPath,\s*context\.request\.method,\s*host/);
  assert.match(source, /Response\.redirect\(new URL\(ADMIN_DASHBOARD_PATH, url\.origin\), 302\)/);
  assert.match(source, /await context\.rewrite\(adminRewritePath\)/);
});
