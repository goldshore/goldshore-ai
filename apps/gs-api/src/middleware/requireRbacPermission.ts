import type { Context } from 'hono';
import type { Env, Variables } from '../types';
import type { PermissionId } from '../lib/types/rbac';
import { hasPermission } from '../lib/rbac';

export async function requireRbacPermission(requiredPermission: PermissionId) {
  return async (
    c: Context<{
      Bindings: Env;
      Variables: Variables;
    }>,
    next: () => Promise<void>
  ) => {
    const db = c.env.PLATFORM_DB;
    const claims = c.get('accessClaims');

    if (!claims?.email) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const email = claims.email;

    const user = await db.prepare(
      'SELECT * FROM admin_users WHERE email = ?'
    ).bind(email).first();

    if (!user || user.status !== 'active') {
      return c.json({ error: 'Access denied' }, 403);
    }

    const role = await db.prepare(
      'SELECT * FROM admin_roles WHERE id = ?'
    ).bind(user.role_id).first();

    if (!role) {
      return c.json({ error: 'Access denied' }, 403);
    }

    if (!hasPermission(user, role, requiredPermission)) {
      return c.json(
        { error: `Permission denied: ${requiredPermission} required` },
        403
      );
    }

    c.set('user', user);
    c.set('role', role);
    await next();
  };
}
