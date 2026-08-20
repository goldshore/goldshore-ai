import type { Env, Variables } from '../../types';
import { Hono } from 'hono';
import { requireRbacPermission } from '../../middleware/requireRbacPermission';
import { errorHandler } from './middleware/auth';
import * as permDb from './db/rbac-permissions';

const permissions = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

/**
 * GET /api/admin/rbac/permissions
 * List all permissions grouped by category
 */
permissions.get(
  '/',
  await requireRbacPermission('perm_audit_view'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;

    const byCategory = await permDb.listPermissions(db);

    const categoryList = Object.entries(byCategory).map(([category, perms]) => ({
      category,
      permissions: perms,
      count: perms.length,
    }));

    return c.json({
      categories: categoryList,
      total: categoryList.reduce((sum, cat) => sum + cat.count, 0),
    });
  })
);

/**
 * GET /api/admin/rbac/permissions/:permissionId
 * Get single permission and which roles use it
 */
permissions.get(
  '/:permissionId',
  await requireRbacPermission('perm_audit_view'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const permId = c.req.param('permissionId');

    const perm = await permDb.getPermissionById(db, permId);
    if (!perm) {
      return c.json({ error: 'Permission not found' }, 404);
    }

    const usedBy = await permDb.getPermissionUsage(db, permId);

    return c.json({
      ...perm,
      used_by_roles: usedBy,
      usage_count: usedBy.length,
    });
  })
);

export default permissions;
