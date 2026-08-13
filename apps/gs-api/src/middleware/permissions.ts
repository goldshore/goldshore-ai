/**
 * Permissions Middleware
 */

import type { AuthContext } from './auth';

export async function checkPermission(auth: AuthContext, requiredPermission: string, env: any): Promise<boolean> {
  if (!auth.user) return false;
  
  const db = env.PLATFORM_DB;
  const user = await db
    .prepare('SELECT roles FROM admin_users WHERE id = ?')
    .bind(auth.user.id)
    .first();

  if (!user) return false;

  const roles = JSON.parse(user.roles || '[]');
  const permissions = await getPermissionsForRoles(roles, db);
  
  return permissions.includes(requiredPermission);
}

async function getPermissionsForRoles(roles: string[], db: any): Promise<string[]> {
  const perms = new Set<string>();
  
  for (const role of roles) {
    const rolePerms = await db
      .prepare('SELECT permissions FROM admin_roles WHERE name = ?')
      .bind(role)
      .first();
    
    if (rolePerms) {
      const parsed = JSON.parse(rolePerms.permissions || '[]');
      parsed.forEach((p: string) => perms.add(p));
    }
  }
  
  return Array.from(perms);
}

export function requirePermission(permission: string) {
  return async (handler: Function) => {
    return async (req: Request, env: any, auth: AuthContext) => {
      const hasPermission = await checkPermission(auth, permission, env);
      if (!hasPermission) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return handler(req, env, auth);
    };
  };
}
