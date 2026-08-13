import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

import {
  ALTERNATE_ADMIN_DASHBOARD_URL,
  CANONICAL_ADMIN_DASHBOARD_URL,
  CLEAN_ADMIN_PAGE_PREFIXES,
  MIGRATED_ADMIN_PAGE_RULES,
  buildCloudflareAccessAdminSession,
  getAdminLoginDestination,
  getAdminHostRewritePath,
  getAdminLogoutUrl,
  getAdminRouteRule,
  getCanonicalAdminUrl,
} from '../../src/utils/admin-access.ts';

/**
 * Admin links whose target page has not been built yet. Each needs a real page
 * or the link removed; until then this list keeps the count from growing
 * silently. Do not add to it to make a test pass — build the page instead.
 */
const KNOWN_UNBUILT_ADMIN_ROUTES = [
  '/admin/pii-scans',
  '/admin/repo-health/findings',
  '/admin/users/list',
];

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
  assert.equal(
    getAdminLoginDestination('org', '/app/settings?tab=identity'),
    'https://admin.goldshore.org/app/settings?tab=identity',
  );
  assert.equal(
    getAdminLoginDestination('admin', 'https://evil.example/admin'),
    CANONICAL_ADMIN_DASHBOARD_URL,
  );
  assert.equal(
    getAdminLoginDestination('admin', '//evil.example/admin'),
    CANONICAL_ADMIN_DASHBOARD_URL,
  );
});

test('grants owner permissions only to an explicitly configured Access identity', () => {
  const session = buildCloudflareAccessAdminSession({
    sub: 'access-user',
    email: 'admin@goldshore.org',
  }, 'marstonr6@gmail.com,admin@goldshore.org');

  assert.deepEqual(session.roles, ['owner']);
  assert.ok(session.permissions.includes('system:read'));
  assert.ok(session.permissions.includes('system:write'));
  assert.ok(session.permissions.includes('users:delete'));
});

test('rejects Access identities outside the application owner allowlist', () => {
  const session = buildCloudflareAccessAdminSession({
    sub: 'access-user',
    email: 'operator@example.com',
    roles: ['owner'],
  }, 'marstonr6@gmail.com,admin@goldshore.org');

  assert.deepEqual(session, { roles: [], permissions: [] });
});

test('rejects an explicitly unverified owner email', () => {
  const session = buildCloudflareAccessAdminSession({
    sub: 'access-user',
    email: 'admin@goldshore.org',
    email_verified: false,
  }, 'marstonr6@gmail.com,admin@goldshore.org');

  assert.deepEqual(session, { roles: [], permissions: [] });
});

test('routes logout through the application-domain Access endpoint', () => {
  assert.equal(
    getAdminLogoutUrl('https://admin.goldshore.org/logout'),
    'https://admin.goldshore.org/cdn-cgi/access/logout',
  );
  assert.equal(
    getAdminLogoutUrl('https://goldshore.ai/logout'),
    'https://admin.goldshore.ai/cdn-cgi/access/logout',
  );
});

test('login page uses dashboard destinations instead of admin host roots', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) =>
    readFile(new URL('../../src/pages/login.astro', import.meta.url), 'utf8'),
  );

  assert.match(source, /const destination = getAdminLoginDestination\(requested, nextPath\)/);
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
  assert.equal(getAdminHostRewritePath('/domains'), '/admin/domains');
  assert.equal(getAdminHostRewritePath('/leads'), '/admin/leads');
});

test('every path the rewrite can emit resolves to a page that exists', () => {
  // The bare section prefixes were the gap: the suite only exercised child
  // paths like /workers/status and /integrations/keys, so /workers and
  // /integrations rewrote to directories with no index and served a 404.
  const pagesRoot = new URL('../../src/pages', import.meta.url);
  const resolves = (route: string) => {
    const relative = route.replace(/^\//, '');
    return (
      existsSync(new URL(`${pagesRoot.pathname}/${relative}.astro`, import.meta.url)) ||
      existsSync(new URL(`${pagesRoot.pathname}/${relative}/index.astro`, import.meta.url))
    );
  };

  for (const prefix of CLEAN_ADMIN_PAGE_PREFIXES) {
    const rewritten = getAdminHostRewritePath(prefix);
    assert.equal(rewritten, `/admin${prefix}`, `${prefix} should rewrite under /admin`);
    assert.ok(resolves(rewritten), `${rewritten} has no page — ${prefix} would 404`);
  }
});

test('rewrite exemptions only cover pages gs-web actually serves', () => {
  // Listing a prefix in MIGRATED_ADMIN_PAGE_RULES exempts it from the rewrite so
  // Astro serves it as-is. When no such page exists the exemption yields a 404
  // instead of falling through to the dashboard — which is what /infrastructure
  // did before it was removed.
  const pagesRoot = new URL('../../src/pages', import.meta.url).pathname;
  for (const { prefix } of MIGRATED_ADMIN_PAGE_RULES) {
    const relative = prefix.replace(/^\//, '');
    assert.ok(
      existsSync(new URL(`${pagesRoot}/${relative}.astro`, import.meta.url)) ||
        existsSync(new URL(`${pagesRoot}/${relative}/index.astro`, import.meta.url)),
      `${prefix} is exempted from the rewrite but gs-web has no page for it`,
    );
  }
});

test('a prefix is never in both rewrite tables', () => {
  // getAdminHostRewritePath consults MIGRATED_ADMIN_PAGE_RULES first, so any
  // prefix in both lists makes its CLEAN_ADMIN_PAGE_PREFIXES entry unreachable.
  const migrated = new Set(MIGRATED_ADMIN_PAGE_RULES.map(({ prefix }) => prefix));
  const overlap = CLEAN_ADMIN_PAGE_PREFIXES.filter((prefix) => migrated.has(prefix));
  assert.deepEqual(overlap, [], `unreachable clean-prefix entries: ${overlap.join(', ')}`);
});

test('every /admin link in the site resolves to a page', () => {
  const srcRoot = new URL('../../src', import.meta.url).pathname;
  const linked = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(astro|ts)$/.test(entry.name)) {
        for (const [, href] of readFileSync(full, 'utf8').matchAll(/href="(\/admin\/[^"?]*)/g)) {
          linked.add(href.replace(/\/$/, ''));
        }
      }
    }
  };
  walk(srcRoot);

  const pagesRoot = new URL('../../src/pages', import.meta.url).pathname;
  const broken = [...linked].filter((route) => {
    const relative = route.replace(/^\//, '');
    return !(
      existsSync(new URL(`${pagesRoot}/${relative}.astro`, import.meta.url)) ||
      existsSync(new URL(`${pagesRoot}/${relative}/index.astro`, import.meta.url))
    );
  });

  assert.deepEqual(broken.sort(), KNOWN_UNBUILT_ADMIN_ROUTES, 'broken /admin links changed');
});

test('keeps migrated gs-admin pages reachable from the admin hostname', () => {
  const expectedPermissions = new Map([
    ['/content', 'content:read'],
    ['/infrastructure/cloudflare', 'cloudflare_inventory:read'],
    ['/monetization', 'system:read'],
    ['/sites', 'cloudflare_inventory:read'],
    ['/trading/orders', 'api_configuration:read'],
  ] as const);

  for (const [pathname, permission] of expectedPermissions) {
    assert.equal(getAdminHostRewritePath(pathname), null);
    assert.deepEqual(getAdminRouteRule(pathname, 'GET', 'admin.goldshore.ai'), {
      canonicalPath: pathname,
      kind: 'page',
      permission,
      requiresAdminRole: true,
    });
  }
});

test('protects provider compatibility routes with integration access', () => {
  assert.deepEqual(
    getAdminRouteRule('/admin/integrations/meta', 'GET', 'admin.goldshore.ai'),
    {
      canonicalPath: '/admin/integrations/meta',
      kind: 'page',
      permission: 'integrations:read',
      requiresAdminRole: true,
    },
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
  const { join } = await import('node:path');
  const roots = ['../../src/pages/admin', '../../src/pages/app'];
  const offenders: string[] = [];

  for (const root of roots) {
    const dir = new URL(`${root}/`, import.meta.url);
    for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.astro')) continue;
      const file = join(entry.parentPath, entry.name);
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

test('admin sidebar points at reachable gs-web destinations', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) =>
    readFile(new URL('../../src/components/Sidebar.astro', import.meta.url), 'utf8'),
  );

  assert.match(source, /href="\/app\/dashboard"/);
  assert.match(source, /href="\/app\/settings"/);
  assert.match(source, /href="\/trading"/);
  assert.doesNotMatch(source, /href="\/admin\/settings"/);
});
