/**
 * Permission Functions
 *
 * Utilities for permission checking, role assignment, and access control
 */

export interface Permission {
  id: string;
  name: string;
  description: string;
  scope: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

export interface UserRoles {
  userId: string;
  roles: Role[];
}

export async function getUserPermissions(
  userId: string,
  db: any
): Promise<string[]> {
  const user = await db
    .prepare('SELECT * FROM admin_users WHERE id = ?')
    .bind(userId)
    .first();

  if (!user) return [];

  const roles = JSON.parse(user.roles || '[]');
  const permissions = new Set<string>();

  for (const roleId of roles) {
    const role = await db
      .prepare('SELECT permissions FROM admin_roles WHERE id = ?')
      .bind(roleId)
      .first();

    if (role) {
      const rolePerms = JSON.parse(role.permissions || '[]');
      rolePerms.forEach((perm: string) => permissions.add(perm));
    }
  }

  return Array.from(permissions);
}

export async function hasPermission(
  userId: string,
  permission: string,
  db: any
): Promise<boolean> {
  const permissions = await getUserPermissions(userId, db);
  return permissions.includes(permission);
}

export async function hasAnyPermission(
  userId: string,
  permissions: string[],
  db: any
): Promise<boolean> {
  const userPerms = await getUserPermissions(userId, db);
  return permissions.some(perm => userPerms.includes(perm));
}

export async function hasAllPermissions(
  userId: string,
  permissions: string[],
  db: any
): Promise<boolean> {
  const userPerms = await getUserPermissions(userId, db);
  return permissions.every(perm => userPerms.includes(perm));
}

export async function assignRole(
  userId: string,
  roleId: string,
  assignedBy: string,
  db: any
): Promise<boolean> {
  try {
    const user = await db
      .prepare('SELECT * FROM admin_users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) return false;

    const roles = JSON.parse(user.roles || '[]');
    if (roles.includes(roleId)) return true; // Already assigned

    roles.push(roleId);

    await db
      .prepare('UPDATE admin_users SET roles = ? WHERE id = ?')
      .bind(JSON.stringify(roles), userId)
      .run();

    // Log the role assignment
    await db
      .prepare(
        `
        INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, timestamp)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `
      )
      .bind(
        crypto.randomUUID(),
        assignedBy,
        'ROLE_ASSIGNED',
        'admin_role',
        userId
      )
      .run();

    return true;
  } catch {
    return false;
  }
}

export async function removeRole(
  userId: string,
  roleId: string,
  removedBy: string,
  db: any
): Promise<boolean> {
  try {
    const user = await db
      .prepare('SELECT * FROM admin_users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) return false;

    const roles = JSON.parse(user.roles || '[]');
    const filtered = roles.filter((r: string) => r !== roleId);

    if (filtered.length === roles.length) return true; // Not found, no change

    await db
      .prepare('UPDATE admin_users SET roles = ? WHERE id = ?')
      .bind(JSON.stringify(filtered), userId)
      .run();

    // Log the role removal
    await db
      .prepare(
        `
        INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, timestamp)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `
      )
      .bind(
        crypto.randomUUID(),
        removedBy,
        'ROLE_REMOVED',
        'admin_role',
        userId
      )
      .run();

    return true;
  } catch {
    return false;
  }
}

export async function getRole(roleId: string, db: any): Promise<Role | null> {
  const role = await db
    .prepare('SELECT * FROM admin_roles WHERE id = ?')
    .bind(roleId)
    .first();

  if (!role) return null;

  return {
    id: role.id,
    name: role.name,
    description: role.description || '',
    permissions: JSON.parse(role.permissions || '[]'),
  };
}

export async function createRole(
  name: string,
  description: string,
  permissions: string[],
  db: any
): Promise<string> {
  const id = crypto.randomUUID();

  await db
    .prepare(
      `
      INSERT INTO admin_roles (id, name, description, permissions, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `
    )
    .bind(id, name, description, JSON.stringify(permissions))
    .run();

  return id;
}

export async function updateRole(
  roleId: string,
  name: string,
  description: string,
  permissions: string[],
  db: any
): Promise<boolean> {
  try {
    await db
      .prepare(
        'UPDATE admin_roles SET name = ?, description = ?, permissions = ? WHERE id = ?'
      )
      .bind(name, description, JSON.stringify(permissions), roleId)
      .run();

    return true;
  } catch {
    return false;
  }
}

export async function deleteRole(roleId: string, db: any): Promise<boolean> {
  try {
    // Remove all role assignments
    await db
      .prepare(
        'DELETE FROM admin_user_roles WHERE role_id = ?'
      )
      .bind(roleId)
      .run();

    // Delete the role
    await db
      .prepare('DELETE FROM admin_roles WHERE id = ?')
      .bind(roleId)
      .run();

    return true;
  } catch {
    return false;
  }
}

export const CORE_PERMISSIONS = {
  SYSTEM_READ: 'system:read',
  SYSTEM_WRITE: 'system:write',
  AUDIT_READ: 'audit:read',
  FORMS_READ: 'forms:read',
  FORMS_WRITE: 'forms:write',
  CLOUDFLARE_INVENTORY_READ: 'cloudflare_inventory:read',
  SECRET_METADATA_READ: 'secret_metadata:read',
  USERS_READ: 'users:read',
  API_CONFIGURATION_READ: 'api_configuration:read',
};
