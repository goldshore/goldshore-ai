import {
  ADMIN_ROLES,
  buildAdminSession,
  getAdminPermissions,
  hasAdminPermission,
  verifyAccessWithClaims,
  type AccessTokenPayload,
  type AdminPermission,
  type AdminRole,
  type AdminSession,
} from '@goldshore/auth';

type AdminEnv = {
  CLOUDFLARE_ACCESS_AUDIENCE?: string;
  CLOUDFLARE_TEAM_DOMAIN?: string;
  ADMIN_DEV_ROLE?: string;
  [key: string]: any;
};

type RequireAdminAccessOptions = {
  requiredPermission?: AdminPermission;
  requiredRole?: AdminRole;
};

type AdminAccessResult = {
  ok: boolean;
  error: string | null;
  status: number;
  claims: AccessTokenPayload | null;
  session: AdminSession;
};

const buildForbidden = (
  error: string,
  claims: AccessTokenPayload | null,
  session: AdminSession,
): AdminAccessResult => ({
  ok: false,
  error,
  status: 403,
  claims,
  session,
});

export function evaluateAdminAccess(
  claims: AccessTokenPayload | null,
  env: AdminEnv,
  options: RequireAdminAccessOptions = {},
): AdminAccessResult {
  let session = buildAdminSession(claims);
  const isDev = Boolean(import.meta.env?.DEV);

  if (!claims && isDev && env.ADMIN_DEV_ROLE) {
    const role = env.ADMIN_DEV_ROLE.toLowerCase();
    if (ADMIN_ROLES.includes(role as AdminRole)) {
      session = {
        roles: [role as AdminRole],
        permissions: getAdminPermissions([role as AdminRole]),
      };
    }
  }

  if (!claims && session.roles.length === 0) {
    return {
      ok: false,
      error: 'Unauthorized',
      status: 401,
      claims,
      session,
    };
  }

  if (session.roles.length === 0) {
    return buildForbidden('Admin role required.', claims, session);
  }

  if (options.requiredRole && !session.roles.includes(options.requiredRole)) {
    return buildForbidden(`Requires ${options.requiredRole} role.`, claims, session);
  }

  if (
    options.requiredPermission &&
    !hasAdminPermission(session.permissions, options.requiredPermission)
  ) {
    return buildForbidden(`Missing ${options.requiredPermission} permission.`, claims, session);
  }

  return {
    ok: true,
    error: null,
    status: 200,
    claims,
    session,
  };
}

export async function requireAdminAccess(
  request: Request,
  env: AdminEnv,
  options: RequireAdminAccessOptions = {},
): Promise<AdminAccessResult> {
  const claims = await verifyAccessWithClaims(request, env);
  return evaluateAdminAccess(claims, env, options);
}
