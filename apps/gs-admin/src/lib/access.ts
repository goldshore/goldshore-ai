import {
  buildAdminSession,
  hasAdminPermission,
  verifyAccessWithClaims,
  type AdminPermission,
  type Env,
} from '@goldshore/auth';

type AccessResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export async function requireAdminAccess(
  request: Request,
  env: Env,
  options?: { requiredPermission?: AdminPermission },
): Promise<AccessResult> {
  const claims = await verifyAccessWithClaims(request, env);
  if (!claims) {
    return { ok: false, error: 'Unauthorized', status: 401 };
  }

  if (options?.requiredPermission) {
    const session = buildAdminSession(claims);
    if (!hasAdminPermission(session.permissions, options.requiredPermission)) {
      return { ok: false, error: 'Forbidden', status: 403 };
    }
  }

  return { ok: true };
}
