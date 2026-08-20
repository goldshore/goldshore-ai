import type { AdminUser, AdminUserWithRole } from '../../../lib/types/rbac';

export async function listAdminUsers(
  db: any,
  options: { offset: number; limit: number; status?: string; roleId?: string }
) {
  const where: string[] = [];
  const params: any[] = [];

  if (options.status) {
    where.push('status = ?');
    params.push(options.status);
  }

  if (options.roleId) {
    where.push('role_id = ?');
    params.push(options.roleId);
  }

  const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';

  const total = await db.prepare(
    `SELECT COUNT(*) as count FROM admin_users${whereClause}`
  ).bind(...params).first();

  const users = await db.prepare(
    `SELECT u.id, u.email, u.name, u.role_id, u.status, u.last_login, u.created_at, r.name as role_name
     FROM admin_users u
     LEFT JOIN admin_roles r ON u.role_id = r.id
     ${whereClause}
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, options.limit, options.offset).all();

  return {
    users: users.results || [],
    total: total?.count || 0,
    limit: options.limit,
    offset: options.offset,
  };
}

export async function getUserById(db: any, userId: string): Promise<AdminUserWithRole | null> {
  return await db.prepare(
    `SELECT u.*, r.name as role_name
     FROM admin_users u
     LEFT JOIN admin_roles r ON u.role_id = r.id
     WHERE u.id = ?`
  ).bind(userId).first();
}

export async function getUserByEmail(db: any, email: string): Promise<AdminUser | null> {
  return await db.prepare('SELECT * FROM admin_users WHERE email = ?').bind(email).first();
}

export async function createUser(
  db: any,
  data: {
    id: string;
    email: string;
    name?: string;
    roleId: string;
    invitedBy?: string;
  }
) {
  return await db.prepare(
    'INSERT INTO admin_users (id, email, name, role_id, status, invited_at, invited_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
  ).bind(data.id, data.email, data.name, data.roleId, 'active', data.invitedBy).run();
}

export async function updateUser(
  db: any,
  userId: string,
  data: {
    name?: string;
    roleId?: string;
    status?: 'active' | 'suspended' | 'revoked';
  }
) {
  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }

  if (data.roleId) {
    updates.push('role_id = ?');
    params.push(data.roleId);
  }

  if (data.status) {
    updates.push('status = ?');
    params.push(data.status);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(userId);

  if (updates.length === 1) {
    throw new Error('No updates provided');
  }

  return await db.prepare(
    `UPDATE admin_users SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...params).run();
}

export async function suspendUser(db: any, userId: string) {
  return await updateUser(db, userId, { status: 'suspended' });
}

export async function restoreUser(db: any, userId: string) {
  return await updateUser(db, userId, { status: 'active' });
}

export async function revokeUser(db: any, userId: string) {
  return await updateUser(db, userId, { status: 'revoked' });
}

export async function updateLastLogin(db: any, email: string) {
  return await db.prepare(
    'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE email = ?'
  ).bind(email).run();
}
