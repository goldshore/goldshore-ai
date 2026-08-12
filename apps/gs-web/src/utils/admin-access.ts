import {
  buildAdminSession,
  hasAdminPermission,
  ROLE_PERMISSIONS,
  verifyAccessWithClaims,
  verifyJWTCookie,
  type AccessTokenPayload,
  type AdminPermission,
  type AdminSession,
  type Env as AccessEnv,
} from '@goldshore/auth';

export const CANONICAL_ADMIN_ORIGIN = 'https://admin.goldshore.ai';
export const ALTERNATE_ADMIN_ORIGIN = 'https://admin.goldshore.org';
export const ADMIN_DASHBOARD_PATH = '/app/dashboard';
export const CANONICAL_ADMIN_DASHBOARD_URL =
  `${CANONICAL_ADMIN_ORIGIN}${ADMIN_DASHBOARD_PATH}`;
export const ALTERNATE_ADMIN_DASHBOARD_URL =
  `${ALTERNATE_ADMIN_ORIGIN}${ADMIN_DASHBOARD_PATH}`;
export const CLOUDFLARE_ACCESS_LOGOUT_PATH = '/cdn-cgi/access/logout';

const ADMIN_HOSTS = new Set([
  'admin.goldshore.ai',
  'admin.goldshore.org',
  'admin-preview.goldshore.ai',
  'admin-preview.goldshore.org',
  'dashboard.goldshore.ai',
  'dashboard.goldshore.org',
  'dashboard-preview.goldshore.ai',
  'dashboard-preview.goldshore.org',
]);

const STATIC_PATH_PREFIXES = [
  '/_astro/',
  '/assets/',
  '/cdn-cgi/',
  '/favicon',
  '/logo',
  '/robots.txt',
  '/sitemap',
];

/**
 * Paths that stay reachable on the admin hostname without an admin session.
 *
 * The admin host folds every unrecognized path back to the dashboard, and the
 * dashboard requires a session. Without this exemption the sign-in and
 * sign-out routes would themselves be rewritten to the dashboard, so an
 * unauthenticated operator would bounce between /login and /app/dashboard
 * with no way to authenticate.
 */
const ADMIN_HOST_PUBLIC_PATHS = ['/login', '/logout'];

const isAdminHostPublicPath = (pathname: string) =>
  ADMIN_HOST_PUBLIC_PATHS.some(
    (candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`),
  );

const CLEAN_ADMIN_PAGE_PREFIXES = [
  '/api-status',
  '/crawler',
  '/domains',
  '/goldclaw',
  '/integrations',
  '/leads',
  '/lead-submissions',
  '/monetization',
  '/products',
  '/search-console',
  '/services',
  '/workers',
];

const MIGRATED_ADMIN_PAGE_RULES: Array<{
  prefix: string;
  permission: AdminPermission;
}> = [
  { prefix: '/content', permission: 'content:read' },
  { prefix: '/infrastructure', permission: 'cloudflare_inventory:read' },
  { prefix: '/monetization', permission: 'system:read' },
  { prefix: '/sites', permission: 'cloudflare_inventory:read' },
  { prefix: '/trading', permission: 'api_configuration:read' },
];

const getMigratedAdminPageRule = (pathname: string) =>
  MIGRATED_ADMIN_PAGE_RULES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

export type AdminRouteRule = {
  canonicalPath: string;
  kind: 'page' | 'api';
  permission?: AdminPermission;
  requiresAdminRole: boolean;
};

export type AdminAuthorizationResult =
  | {
      ok: true;
      claims: AccessTokenPayload;
      session: AdminSession;
    }
  | {
      ok: false;
      status: 401 | 403 | 503;
      error: string;
    };

export type AdminAuthError = {
  status: 401 | 403 | 503 | 404;
  message: string;
};

const normalizePathname = (pathname: string) => {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
};

export const isAdminHost = (hostname: string) => ADMIN_HOSTS.has(hostname.toLowerCase());

export const isStaticAssetPath = (pathname: string) => {
  const normalizedPath = normalizePathname(pathname);
  return STATIC_PATH_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix));
};

export const getAdminHostRewritePath = (pathname: string) => {
  const normalizedPath = normalizePathname(pathname);

  if (isStaticAssetPath(normalizedPath)) return null;
  if (isAdminHostPublicPath(normalizedPath)) return null;
  if (normalizedPath === '/') return ADMIN_DASHBOARD_PATH;

  // These pages were moved byte-for-byte from the retired gs-admin app and
  // intentionally retain their established paths. Let Astro serve them from
  // gs-web instead of folding them back to the dashboard.
  if (getMigratedAdminPageRule(normalizedPath)) return null;

  if (
    normalizedPath === '/app' ||
    normalizedPath.startsWith('/app/') ||
    normalizedPath === '/admin' ||
    normalizedPath.startsWith('/admin/') ||
    normalizedPath === '/api/admin' ||
    normalizedPath.startsWith('/api/admin/') ||
    normalizedPath === '/api/forms' ||
    normalizedPath.startsWith('/api/forms/')
  ) {
    return null;
  }

  if (
    CLEAN_ADMIN_PAGE_PREFIXES.some(
      (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
    )
  ) {
    return `/admin${normalizedPath}`;
  }

  return ADMIN_DASHBOARD_PATH;
};

const permissionForMethod = (
  method: string,
  readPermission: AdminPermission,
  writePermission: AdminPermission,
) => {
  const normalizedMethod = method.toUpperCase();
  return normalizedMethod === 'GET' || normalizedMethod === 'HEAD' || normalizedMethod === 'OPTIONS'
    ? readPermission
    : writePermission;
};

export const getAdminRouteRule = (
  pathname: string,
  method = 'GET',
  hostname?: string,
): AdminRouteRule | null => {
  const normalizedPath = normalizePathname(pathname);

  if (normalizedPath === '/app' || normalizedPath === ADMIN_DASHBOARD_PATH) {
    return {
      canonicalPath: ADMIN_DASHBOARD_PATH,
      kind: 'page',
      permission: 'system:read',
      requiresAdminRole: true,
    };
  }

  if (normalizedPath === '/app/logs') {
    return {
      canonicalPath: normalizedPath,
      kind: 'page',
      permission: 'audit:read',
      requiresAdminRole: true,
    };
  }

  if (normalizedPath === '/app/settings') {
    return {
      canonicalPath: normalizedPath,
      kind: 'page',
      permission: 'system:write',
      requiresAdminRole: true,
    };
  }

  if (normalizedPath === '/app/profile') {
    return {
      canonicalPath: normalizedPath,
      kind: 'page',
      requiresAdminRole: true,
    };
  }

  if (normalizedPath.startsWith('/app/')) {
    return {
      canonicalPath: normalizedPath,
      kind: 'page',
      permission: 'system:read',
      requiresAdminRole: true,
    };
  }

  const migratedPage = getMigratedAdminPageRule(normalizedPath);
  if (migratedPage) {
    return {
      canonicalPath: normalizedPath,
      kind: 'page',
      permission: migratedPage.permission,
      requiresAdminRole: true,
    };
  }

  if (
    normalizedPath === '/admin/integrations' ||
    normalizedPath.startsWith('/admin/integrations/')
  ) {
    return {
      canonicalPath: normalizedPath,
      kind: 'page',
      permission: 'integrations:read',
      requiresAdminRole: true,
    };
  }

  if (normalizedPath === '/admin/domains' || normalizedPath.startsWith('/admin/domains/')) {
    return {
      canonicalPath: normalizedPath,
      kind: 'page',
      permission: 'cloudflare_inventory:read',
      requiresAdminRole: true,
    };
  }

  if (
    normalizedPath === '/admin/deploy' ||
    normalizedPath.startsWith('/admin/deploy/') ||
    normalizedPath === '/admin/api-status' ||
    normalizedPath === '/admin/workers/status' ||
    normalizedPath === '/admin/workers/routes' ||
    normalizedPath === '/admin/workers/bindings' ||
    normalizedPath === '/api/admin/cf/workers' ||
    normalizedPath === '/api/admin/cf/worker-detail' ||
    normalizedPath === '/admin/monetization' ||
    normalizedPath === '/api/admin/monetization/adsense' ||
    normalizedPath === '/admin/search-console' ||
    normalizedPath === '/api/admin/search-console' ||
    normalizedPath === '/admin/products' ||
    normalizedPath.startsWith('/admin/products/')
  ) {
    return {
      canonicalPath: normalizedPath,
      kind: normalizedPath.startsWith('/api/') ? 'api' : 'page',
      permission: normalizedPath.startsWith('/admin/deploy') ? 'system:write' : 'system:read',
      requiresAdminRole: true,
    };
  }

  if (
    normalizedPath === '/api/admin/products' ||
    normalizedPath === '/api/admin/settings'
  ) {
    return {
      canonicalPath: normalizedPath,
      kind: 'api',
      permission: permissionForMethod(method, 'system:read', 'system:write'),
      requiresAdminRole: true,
    };
  }

  if (
    normalizedPath === '/admin' || normalizedPath.startsWith('/admin/')
  ) {
    return {
      canonicalPath: normalizedPath,
      kind: 'page',
      permission: 'forms:read',
      requiresAdminRole: true,
    };
  }

  if (normalizedPath.startsWith('/api/admin/')) {
    return {
      canonicalPath: normalizedPath,
      kind: 'api',
      permission: permissionForMethod(method, 'forms:read', 'forms:write'),
      requiresAdminRole: true,
    };
  }

  if (normalizedPath === '/api/forms' || normalizedPath.startsWith('/api/forms/')) {
    return {
      canonicalPath: normalizedPath,
      kind: 'api',
      permission: permissionForMethod(method, 'forms:read', 'forms:write'),
      requiresAdminRole: true,
    };
  }

  if (
    hostname &&
    isAdminHost(hostname) &&
    !isStaticAssetPath(normalizedPath) &&
    !isAdminHostPublicPath(normalizedPath)
  ) {
    return {
      canonicalPath: ADMIN_DASHBOARD_PATH,
      kind: 'page',
      permission: 'system:read',
      requiresAdminRole: true,
    };
  }

  return null;
};

export const getCanonicalAdminUrl = (pathname: string) => {
  const normalizedPath = normalizePathname(pathname);
  return new URL(normalizedPath, CANONICAL_ADMIN_ORIGIN).toString();
};

const getAdminOrigin = (requested?: string) =>
  requested === 'org' ? ALTERNATE_ADMIN_ORIGIN : CANONICAL_ADMIN_ORIGIN;

const getSafeAdminNextPath = (requestedPath?: string | null) => {
  if (!requestedPath || !requestedPath.startsWith('/') || requestedPath.startsWith('//')) {
    return ADMIN_DASHBOARD_PATH;
  }

  const parsed = new URL(requestedPath, CANONICAL_ADMIN_ORIGIN);
  if (parsed.origin !== CANONICAL_ADMIN_ORIGIN) return ADMIN_DASHBOARD_PATH;
  if (
    parsed.pathname === '/login' ||
    parsed.pathname === '/logout' ||
    parsed.pathname.startsWith('/cdn-cgi/')
  ) {
    return ADMIN_DASHBOARD_PATH;
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
};

export const getAdminLoginDestination = (requested?: string, nextPath?: string | null) => {
  const origin = getAdminOrigin(requested);
  return new URL(getSafeAdminNextPath(nextPath), origin).toString();
};

export const getAdminLogoutUrl = (requestUrl: string | URL) => {
  const url = new URL(requestUrl);
  const origin = isAdminHost(url.hostname) ? url.origin : CANONICAL_ADMIN_ORIGIN;
  return new URL(CLOUDFLARE_ACCESS_LOGOUT_PATH, origin).toString();
};

export const getAdminOwnerEmails = (configuredEmails?: string) => {
  if (!configuredEmails) return new Set<string>();
  return new Set(
    configuredEmails
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
};

/**
 * Cloudflare Access authenticates the identity, while this application-level
 * allowlist supplies defense in depth if the dashboard policy drifts. Only the
 * two configured bootstrap owners receive a privileged dashboard session.
 */
export const buildCloudflareAccessAdminSession = (
  claims: AccessTokenPayload,
  configuredOwnerEmails: string | undefined,
): AdminSession => {
  const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
  const ownerEmails = getAdminOwnerEmails(configuredOwnerEmails);
  if (!email || claims.email_verified === false || !ownerEmails.has(email)) {
    return { roles: [], permissions: [] };
  }

  return {
    roles: ['owner'],
    permissions: [...ROLE_PERMISSIONS.owner],
  };
};

export const authorizeAdminRequest = async (
  request: Request,
  env: AccessEnv | undefined,
  rule: AdminRouteRule,
): Promise<AdminAuthorizationResult> => {
  if (!env?.JWT_SECRET && !env?.CLOUDFLARE_TEAM_DOMAIN) {
    return {
      ok: false,
      status: 503,
      error: 'Admin access is misconfigured: no JWT verifier is configured.',
    };
  }

  // Prefer an application cookie JWT; fall back to a Cloudflare Access
  // assertion at the edge. Each verifier runs at most once per request.
  const cookieClaims = await verifyJWTCookie(request, env);
  const accessClaims = cookieClaims ? null : await verifyAccessWithClaims(request, env);
  const verifiedClaims = cookieClaims ?? accessClaims;

  // gs-web intentionally owns no D1 binding. A Cloudflare Access assertion is
  // authorized by the dedicated, explicit-email Admin Access policy after its
  // signature and audience are verified here. D1-backed authorization remains
  // a gs-api responsibility for protected backend operations.
  if (!verifiedClaims) {
    return {
      ok: false,
      status: 401,
      error: 'JWT authentication is required.',
    };
  }

  if (accessClaims && !env?.ADMIN_OWNER_EMAILS) {
    return {
      ok: false,
      status: 503,
      error: 'Admin access is misconfigured: no owner allowlist is configured.',
    };
  }

  const session = accessClaims
    ? buildCloudflareAccessAdminSession(accessClaims, env?.ADMIN_OWNER_EMAILS)
    : buildAdminSession(verifiedClaims);
  if (rule.requiresAdminRole && session.roles.length === 0) {
    return {
      ok: false,
      status: 403,
      error: 'JWT authenticated, but no admin role was granted.',
    };
  }

  if (rule.permission && !hasAdminPermission(session.permissions, rule.permission)) {
    return {
      ok: false,
      status: 403,
      error: `Missing required permission: ${rule.permission}.`,
    };
  }

  return {
    ok: true,
    claims: verifiedClaims,
    session,
  };
};

export const getAdminAuthError = (
  result: AdminAuthorizationResult | null | undefined,
): AdminAuthError | null => {
  if (!result || result.ok) return null;
  const failure = result as Extract<AdminAuthorizationResult, { ok: false }>;
  return {
    status: failure.status,
    message: failure.error,
  };
};
