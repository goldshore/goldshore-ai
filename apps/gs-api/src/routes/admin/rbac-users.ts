import type { Env, Variables } from '../../types';
import { Hono } from 'hono';
import { requireRbacPermission } from '../../middleware/requireRbacPermission';
import { errorHandler, parsePagination } from './middleware/auth';
import * as usersDb from './db/rbac-users';
import * as rolesDb from './db/rbac-roles';
import * as auditDb from './db/rbac-audit';
import { isValidEmail } from '../../lib/rbac';

const rbacUsers = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

rbacUsers.use('*', parsePagination);

/**
 * GET /api/admin/rbac/users
 * List admin users with roles and status
 */
rbacUsers.get(
  '/',
  await requireRbacPermission('perm_users_view'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const { offset, limit } = c.get('pagination');

    const result = await usersDb.listAdminUsers(db, {
      offset,
      limit,
      status: c.req.query('status'),
      roleId: c.req.query('roleId'),
    });

    return c.json({
      users: result.users,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  })
);

/**
 * GET /api/admin/rbac/users/:userId
 * Get single user details
 */
rbacUsers.get(
  '/:userId',
  await requireRbacPermission('perm_users_view'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const userId = c.req.param('userId');

    const user = await usersDb.getUserById(db, userId);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json(user);
  })
);

/**
 * POST /api/admin/rbac/users
 * Create and invite new admin user
 */
rbacUsers.post(
  '/',
  await requireRbacPermission('perm_users_create'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const actor = c.get('user');
    const body = await c.req.json() as any;

    if (!body.email || !body.role_id) {
      return c.json(
        { error: 'Missing required fields: email, role_id' },
        400
      );
    }

    if (!isValidEmail(body.email)) {
      return c.json({ error: 'Invalid email address' }, 400);
    }

    const existing = await usersDb.getUserByEmail(db, body.email);
    if (existing) {
      return c.json({ error: 'User with this email already exists' }, 409);
    }

    const role = await rolesDb.getRoleById(db, body.role_id);
    if (!role) {
      return c.json({ error: 'Role not found' }, 404);
    }

    const userId = crypto.randomUUID();
    await usersDb.createUser(db, {
      id: userId,
      email: body.email,
      name: body.name,
      roleId: body.role_id,
      invitedBy: actor.email,
    });

    await auditDb.createAuditEntry(db, {
      actorEmail: actor.email,
      action: 'assigned_role',
      targetType: 'user',
      targetId: userId,
      targetName: body.email,
      changes: { role_id: body.role_id },
      reason: body.reason,
      ipAddress: c.req.header('cf-connecting-ip'),
      userAgent: c.req.header('user-agent'),
    });

    return c.json({
      id: userId,
      email: body.email,
      name: body.name,
      role_id: body.role_id,
      status: 'active',
      created_at: new Date().toISOString(),
    }, 201);
  })
);

/**
 * PATCH /api/admin/rbac/users/:userId
 * Update user role or status
 */
rbacUsers.patch(
  '/:userId',
  await requireRbacPermission('perm_users_update'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const userId = c.req.param('userId');
    const actor = c.get('user');
    const body = await c.req.json() as any;

    const user = await usersDb.getUserById(db, userId);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (body.role_id) {
      const role = await rolesDb.getRoleById(db, body.role_id);
      if (!role) {
        return c.json({ error: 'Role not found' }, 404);
      }
    }

    const changes: any = {};
    if (body.role_id) changes.role_id = body.role_id;
    if (body.status) changes.status = body.status;

    await usersDb.updateUser(db, userId, {
      roleId: body.role_id,
      status: body.status,
    });

    await auditDb.createAuditEntry(db, {
      actorEmail: actor.email,
      action: 'updated_user',
      targetType: 'user',
      targetId: userId,
      targetName: user.email,
      changes,
      reason: body.reason,
      ipAddress: c.req.header('cf-connecting-ip'),
      userAgent: c.req.header('user-agent'),
    });

    return c.json({ success: true, message: 'User updated' });
  })
);

/**
 * DELETE /api/admin/rbac/users/:userId
 * Revoke user access
 */
rbacUsers.delete(
  '/:userId',
  await requireRbacPermission('perm_users_delete'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const userId = c.req.param('userId');
    const actor = c.get('user');

    const user = await usersDb.getUserById(db, userId);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    await usersDb.revokeUser(db, userId);

    await auditDb.createAuditEntry(db, {
      actorEmail: actor.email,
      action: 'revoked_role',
      targetType: 'user',
      targetId: userId,
      targetName: user.email,
      reason: c.req.query('reason'),
      ipAddress: c.req.header('cf-connecting-ip'),
      userAgent: c.req.header('user-agent'),
    });

    return c.json({ success: true, message: 'User access revoked' });
  })
);

/**
 * POST /api/admin/rbac/users/:userId/suspend
 * Suspend user access (reversible)
 */
rbacUsers.post(
  '/:userId/suspend',
  await requireRbacPermission('perm_users_suspend'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const userId = c.req.param('userId');
    const actor = c.get('user');
    const body = await c.req.json() as any;

    const user = await usersDb.getUserById(db, userId);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    await usersDb.suspendUser(db, userId);

    await auditDb.createAuditEntry(db, {
      actorEmail: actor.email,
      action: 'suspended_user',
      targetType: 'user',
      targetId: userId,
      targetName: user.email,
      reason: body.reason,
      ipAddress: c.req.header('cf-connecting-ip'),
      userAgent: c.req.header('user-agent'),
    });

    return c.json({ success: true, message: 'User suspended' });
  })
);

/**
 * POST /api/admin/rbac/users/:userId/restore
 * Restore suspended user
 */
rbacUsers.post(
  '/:userId/restore',
  await requireRbacPermission('perm_users_restore'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const userId = c.req.param('userId');
    const actor = c.get('user');
    const body = await c.req.json() as any;

    const user = await usersDb.getUserById(db, userId);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    await usersDb.restoreUser(db, userId);

    await auditDb.createAuditEntry(db, {
      actorEmail: actor.email,
      action: 'restored_user',
      targetType: 'user',
      targetId: userId,
      targetName: user.email,
      reason: body.reason,
      ipAddress: c.req.header('cf-connecting-ip'),
      userAgent: c.req.header('user-agent'),
    });

    return c.json({ success: true, message: 'User restored' });
  })
);

export default rbacUsers;
