import type { AdminRole, PermissionId } from '../../../lib/types/rbac';
import { parsePermissions, serializePermissions, generateChangesSummary } from '../../../lib/rbac';

export async function listRoles(
  db: any,
  options: { offset: number; limit: number }
) {
  const total = await db.prepare('SELECT COUNT(*) as count FROM admin_roles').first();
  const roles = await db.prepare(
    'SELECT * FROM admin_roles ORDER BY name ASC LIMIT ? OFFSET ?'
  ).bind(options.limit, options.offset).all();

  return {
    roles: roles.results || [],
    total: total?.count || 0,
    limit: options.limit,
    offset: options.offset,
  };
}

export async function getRoleById(db: any, roleId: string): Promise<AdminRole | null> {
  return await db.prepare('SELECT * FROM admin_roles WHERE id = ?').bind(roleId).first();
}

export async function getRoleByName(db: any, name: string): Promise<AdminRole | null> {
  return await db.prepare('SELECT * FROM admin_roles WHERE name = ?').bind(name).first();
}

export async function createRole(
  db: any,
  data: {
    id: string;
    name: string;
    description?: string;
    permissionIds: PermissionId[];
  }
) {
  const permissions = serializePermissions(data.permissionIds);

  return await db.prepare(
    'INSERT INTO admin_roles (id, name, description, permissions, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
  ).bind(data.id, data.name, data.description, permissions).run();
}

export async function updateRole(
  db: any,
  roleId: string,
  data: {
    description?: string;
    permissionIds?: PermissionId[];
  }
) {
  const updates: string[] = [];
  const params: any[] = [];

  if (data.description !== undefined) {
    updates.push('description = ?');
    params.push(data.description);
  }

  if (data.permissionIds) {
    updates.push('permissions = ?');
    params.push(serializePermissions(data.permissionIds));
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(roleId);

  if (updates.length === 1) {
    throw new Error('No updates provided');
  }

  return await db.prepare(
    `UPDATE admin_roles SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...params).run();
}

export async function deleteRole(db: any, roleId: string) {
  const usedBy = await db.prepare(
    'SELECT COUNT(*) as count FROM admin_users WHERE role_id = ?'
  ).bind(roleId).first();

  if (usedBy?.count > 0) {
    throw new Error('Cannot delete role: users still assigned to this role');
  }

  return await db.prepare('DELETE FROM admin_roles WHERE id = ?').bind(roleId).run();
}

export async function getRoleUsers(db: any, roleId: string) {
  return await db.prepare(
    'SELECT id, email, name, status, last_login FROM admin_users WHERE role_id = ? ORDER BY created_at DESC'
  ).bind(roleId).all();
}
