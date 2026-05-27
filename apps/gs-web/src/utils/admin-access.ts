import {
  buildAdminSession,
  hasAdminPermission,
  verifyAccessWithClaims,
  type AccessTokenPayload,
  type AdminPermission,
  type AdminSession,
  type Env as AccessEnv,
} from '@goldshore/auth';

export const CANONICAL_ADMIN_ORIGIN = 'https://admin.goldshore.ai';

const ADMIN_HOSTS = new Set(['admin.goldshore.ai', 'admin-preview.goldshore.ai']);

const STATIC_PATH_PREFIXES = [
  '/_astro/',
  '/assets/',
  '/cdn-cgi/',
  '/favicon',
  '/logo',
  '/robots.txt',
  '/sitemap',
];

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

const normalizePathname = (pathname: string) => {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
};

export const isAdminHost = (hostname: string) => ADMIN_HOSTS.has(hostname.toLowerCase());

export const isStaticAssetPath = (pathname: string) => {
  const normalizedPath = normalizePathname(pathname);
  return STATIC_PATH_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix));
};

const permissionForMethod = (
  method: string,
  readPermission: AdminPermission,
  writePermission: AdminPermission,
) => {
  const normalizedMethod = method.toUpperCase();
  return normalizedMethod === 'GET' || normalizedMethod === 'HEAD' ? readPermission : writePermission;
};

export const getAdminRouteRule = (
  pathname: string,
  method = 'GET',
  hostname?: string,
): AdminRouteRule | null => {
  const normalizedPath = normalizePathname(pathname);

  if (normalizedPath === '/app' || normalizedPath === '/app/dashboard') {
    return {
      canonicalPath: '/app/dashboard',
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

  if (normalizedPath === '/admin' || normalizedPath.startsWith('/admin/')) {
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
    !isStaticAssetPath(normalizedPath)
  ) {
    return {
      canonicalPath: '/app/dashboard',
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

export const authorizeAdminRequest = async (
  request: Request,
  env: AccessEnv | undefined,
  rule: AdminRouteRule,
): Promise<AdminAuthorizationResult> => {
  if (!env?.CLOUDFLARE_ACCESS_AUDIENCE) {
    return {
      ok: false,
      status: 503,
      error: 'Admin access is misconfigured: CLOUDFLARE_ACCESS_AUDIENCE is missing.',
    };
  }

  const claims = await verifyAccessWithClaims(request, env);
  if (!claims) {
    return {
      ok: false,
      status: 401,
      error: 'Cloudflare Access authentication is required.',
    };
  }

  const session = buildAdminSession(claims);
  if (rule.requiresAdminRole && session.roles.length === 0) {
    return {
      ok: false,
      status: 403,
      error: 'Cloudflare Access authenticated, but no admin role was granted.',
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
    claims,
    session,
  };
};
