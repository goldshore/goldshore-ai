import type { Env, Variables } from '../../types';
import { Hono } from 'hono';
import { requireRbacPermission } from '../../middleware/requireRbacPermission';
import { errorHandler, parsePagination } from './middleware/auth';
import * as rolesDb from './db/rbac-roles';
import * as auditDb from './db/rbac-audit';
import { isValidRoleName, canModifyRole, generateChangesSummary } from '../../lib/rbac';

const roles = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

roles.use('*', parsePagination);

/**
 * GET /api/admin/roles
 * List all roles with pagination
 */
roles.get(
  '/',
  await requireRbacPermission('perm_roles_view'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const { offset, limit } = c.get('pagination');

    const result = await rolesDb.listRoles(db, { offset, limit });

    return c.json({
      roles: result.roles,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  })
);

/**
 * GET /api/admin/roles/:roleId
 * Get single role with assigned users
 */
roles.get(
  '/:roleId',
  await requireRbacPermission('perm_roles_view'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const roleId = c.req.param('roleId');

    const role = await rolesDb.getRoleById(db, roleId);
    if (!role) {
      return c.json({ error: 'Role not found' }, 404);
    }

    const users = await rolesDb.getRoleUsers(db, roleId);

    return c.json({
      ...role,
      users: users.results || [],
    });
  })
);

/**
 * POST /api/admin/roles
 * Create new role (superadmin only)
 */
roles.post(
  '/',
  await requireRbacPermission('perm_roles_create'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const user = c.get('user');
    const body = await c.req.json() as any;

    if (!body.name || !body.permission_ids) {
      return c.json(
        { error: 'Missing required fields: name, permission_ids' },
        400
      );
    }

    if (!isValidRoleName(body.name)) {
      return c.json(
        { error: 'Invalid role name: must be 3-50 chars, alphanumeric/hyphen/underscore' },
        400
      );
    }

    const existing = await rolesDb.getRoleByName(db, body.name);
    if (existing) {
      return c.json({ error: 'Role with this name already exists' }, 409);
    }

    const roleId = `role_${body.name.toLowerCase()}`;
    const createdRole = await rolesDb.createRole(db, {
      id: roleId,
      name: body.name,
      description: body.description,
      permissionIds: body.permission_ids,
    });

    await auditDb.createAuditEntry(db, {
      actorEmail: user.email,
      action: 'created_role',
      targetType: 'role',
      targetId: roleId,
      targetName: body.name,
      changes: { permission_ids: body.permission_ids },
      reason: body.reason,
      ipAddress: c.req.header('cf-connecting-ip'),
      userAgent: c.req.header('user-agent'),
    });

    return c.json({
      id: roleId,
      name: body.name,
      description: body.description,
      permissions: body.permission_ids,
      created_at: new Date().toISOString(),
    }, 201);
  })
);

/**
 * PATCH /api/admin/roles/:roleId
 * Update role permissions
 */
roles.patch(
  '/:roleId',
  await requireRbacPermission('perm_roles_update'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const roleId = c.req.param('roleId');
    const user = c.get('user');
    const body = await c.req.json() as any;

    const role = await rolesDb.getRoleById(db, roleId);
    if (!role) {
      return c.json({ error: 'Role not found' }, 404);
    }

    if (role.is_default && body.permission_ids) {
      return c.json(
        { error: 'Cannot modify permissions of default roles' },
        403
      );
    }

    const before = JSON.parse(role.permissions || '[]');
    const changes = generateChangesSummary(
      { permissions: before },
      { permissions: body.permission_ids || before }
    );

    await rolesDb.updateRole(db, roleId, {
      description: body.description,
      permissionIds: body.permission_ids,
    });

    await auditDb.createAuditEntry(db, {
      actorEmail: user.email,
      action: 'updated_role',
      targetType: 'role',
      targetId: roleId,
      targetName: role.name,
      changes: changes,
      reason: body.reason,
      ipAddress: c.req.header('cf-connecting-ip'),
      userAgent: c.req.header('user-agent'),
    });

    return c.json({ success: true, message: 'Role updated' });
  })
);

/**
 * DELETE /api/admin/roles/:roleId
 * Delete role
 */
roles.delete(
  '/:roleId',
  await requireRbacPermission('perm_roles_delete'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const roleId = c.req.param('roleId');
    const user = c.get('user');

    const role = await rolesDb.getRoleById(db, roleId);
    if (!role) {
      return c.json({ error: 'Role not found' }, 404);
    }

    if (role.is_default) {
      return c.json(
        { error: 'Cannot delete default system roles' },
        403
      );
    }

    await rolesDb.deleteRole(db, roleId);

    await auditDb.createAuditEntry(db, {
      actorEmail: user.email,
      action: 'deleted_role',
      targetType: 'role',
      targetId: roleId,
      targetName: role.name,
      reason: c.req.query('reason'),
      ipAddress: c.req.header('cf-connecting-ip'),
      userAgent: c.req.header('user-agent'),
    });

    return c.json({ success: true, message: 'Role deleted' });
  })
);

export default roles;
