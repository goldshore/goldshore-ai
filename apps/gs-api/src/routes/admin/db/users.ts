/**
 * Admin users database queries
 * Handles team member access and permissions
 */

export async function getAdminUsers(
  db: any,
  options: {
    offset: number;
    limit: number;
    role?: string;
    status?: string;
  }
) {
  try {
    const where: string[] = [];
    const params: any[] = [];

    if (options.role) {
      where.push('role = ?');
      params.push(options.role);
    }

    if (options.status) {
      where.push('status = ?');
      params.push(options.status);
    }

    let query = 'SELECT id, email, name, role, status, created_at, invited_at, accepted_at, last_login FROM admin_users';
    let countQuery = 'SELECT COUNT(*) as total FROM admin_users';

    if (where.length) {
      const whereClause = where.join(' AND ');
      query += ' WHERE ' + whereClause;
      countQuery += ' WHERE ' + whereClause;
    }

    const total = await db.prepare(countQuery).bind(...params).first();
    const users = await db.prepare(
      query + ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(...params, options.limit, options.offset).all();

    return {
      items: users.results || [],
      total: total?.total || 0,
      offset: options.offset,
      limit: options.limit,
      page: Math.floor(options.offset / options.limit) + 1,
    };
  } catch (err) {
    throw new Error(`Failed to get admin users: ${err}`);
  }
}

export async function getUserById(db: any, id: string) {
  try {
    return await db.prepare(
      'SELECT * FROM admin_users WHERE id = ?'
    ).bind(id).first();
  } catch (err) {
    throw new Error(`Failed to get user: ${err}`);
  }
}

export async function getUserByEmail(db: any, email: string) {
  try {
    return await db.prepare(
      'SELECT * FROM admin_users WHERE email = ?'
    ).bind(email).first();
  } catch (err) {
    throw new Error(`Failed to get user: ${err}`);
  }
}

export async function createUser(
  db: any,
  data: {
    email: string;
    name: string;
    role: string;
    permissions?: string[];
  }
) {
  try {
    const id = crypto.randomUUID();
    const permissions = data.permissions ? JSON.stringify(data.permissions) : null;

    return await db.prepare(
      'INSERT INTO admin_users (id, email, name, role, permissions, status, invited_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
    ).bind(id, data.email, data.name, data.role, permissions, 'invited').run();
  } catch (err) {
    throw new Error(`Failed to create user: ${err}`);
  }
}

export async function updateUser(
  db: any,
  id: string,
  data: {
    name?: string;
    role?: string;
    permissions?: string[];
    status?: string;
  }
) {
  try {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.name) {
      updates.push('name = ?');
      params.push(data.name);
    }

    if (data.role) {
      updates.push('role = ?');
      params.push(data.role);
    }

    if (data.permissions) {
      updates.push('permissions = ?');
      params.push(JSON.stringify(data.permissions));
    }

    if (data.status) {
      updates.push('status = ?');
      params.push(data.status);
    }

    if (data.status === 'active' && !data.permissions) {
      updates.push('accepted_at = CURRENT_TIMESTAMP');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    if (updates.length === 1) {
      throw new Error('No updates provided');
    }

    return await db.prepare(
      `UPDATE admin_users SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...params).run();
  } catch (err) {
    throw new Error(`Failed to update user: ${err}`);
  }
}

export async function updateUserLastLogin(db: any, email: string) {
  try {
    return await db.prepare(
      'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE email = ?'
    ).bind(email).run();
  } catch (err) {
    throw new Error(`Failed to update last login: ${err}`);
  }
}

export async function deleteUser(db: any, id: string) {
  try {
    return await db.prepare(
      'DELETE FROM admin_users WHERE id = ?'
    ).bind(id).run();
  } catch (err) {
    throw new Error(`Failed to delete user: ${err}`);
  }
}

export async function revokeUserAccess(db: any, id: string) {
  try {
    return await updateUser(db, id, { status: 'removed' });
  } catch (err) {
    throw new Error(`Failed to revoke access: ${err}`);
  }
}
