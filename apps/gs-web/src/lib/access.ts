import {
  buildAdminSession,
  hasAdminPermission,
  verifyAccessWithClaims,
  type AdminPermission,
} from '@goldshore/auth';

type AccessResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export async function requireAdminAccess(
  request: Request,
  env: Record<string, unknown>,
  options?: { requiredPermission?: AdminPermission },
): Promise<AccessResult> {
  const claims = await verifyAccessWithClaims(request, env);
  if (!claims) {
    return { ok: false, error: 'Unauthorized', status: 401 };
  }

  const session = buildAdminSession(claims);
  if (session.roles.length === 0) {
    return { ok: false, error: 'Forbidden', status: 403 };
  }

  if (
    options?.requiredPermission &&
    !hasAdminPermission(session.permissions, options.requiredPermission)
  ) {
    return { ok: false, error: 'Forbidden', status: 403 };
  }

  return { ok: true };
}
