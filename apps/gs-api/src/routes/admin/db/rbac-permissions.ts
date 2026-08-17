import type { AdminPermission, PermissionCategory } from '../../../lib/types/rbac';

export async function listPermissions(db: any) {
  const permissions = await db.prepare(
    'SELECT * FROM admin_permissions ORDER BY category, name ASC'
  ).all();

  const byCategory: Record<PermissionCategory, AdminPermission[]> = {
    dashboard: [],
    workers: [],
    email: [],
    users: [],
    secrets: [],
    audit: [],
  };

  for (const perm of permissions.results || []) {
    if (perm.category in byCategory) {
      byCategory[perm.category as PermissionCategory].push(perm);
    }
  }

  return byCategory;
}

export async function getPermissionById(db: any, permId: string): Promise<AdminPermission | null> {
  return await db.prepare('SELECT * FROM admin_permissions WHERE id = ?').bind(permId).first();
}

export async function getPermissionsByIds(db: any, permIds: string[]) {
  if (permIds.length === 0) return [];

  const placeholders = permIds.map(() => '?').join(',');
  const permissions = await db.prepare(
    `SELECT * FROM admin_permissions WHERE id IN (${placeholders})`
  ).bind(...permIds).all();

  return permissions.results || [];
}

export async function getPermissionUsage(db: any, permId: string) {
  const roles = await db.prepare(
    'SELECT id, name, permissions FROM admin_roles'
  ).all();

  const usedBy: string[] = [];

  for (const role of roles.results || []) {
    try {
      const perms = JSON.parse(role.permissions || '[]');
      if (perms.includes(permId)) {
        usedBy.push(role.id);
      }
    } catch {
      // Skip if JSON parsing fails
    }
  }

  return usedBy;
}
