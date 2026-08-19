import type { Env, Variables } from '../../types';
import { Hono } from 'hono';
import { requireRbacPermission } from '../../middleware/requireRbacPermission';
import { errorHandler, parsePagination } from './middleware/auth';
import * as auditDb from './db/rbac-audit';

const audit = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

audit.use('*', parsePagination);

/**
 * GET /api/admin/rbac/audit
 * List audit logs with filtering
 */
audit.get(
  '/',
  await requireRbacPermission('perm_audit_view'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const { offset, limit } = c.get('pagination');

    const result = await auditDb.listAuditLogs(db, {
      offset,
      limit,
      actorEmail: c.req.query('actorEmail'),
      action: c.req.query('action'),
      targetType: c.req.query('targetType'),
      targetId: c.req.query('targetId'),
      startDate: c.req.query('startDate'),
      endDate: c.req.query('endDate'),
    });

    return c.json({
      logs: result.logs,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  })
);

/**
 * GET /api/admin/rbac/audit/:logId
 * Get single audit log with full details
 */
audit.get(
  '/:logId',
  await requireRbacPermission('perm_audit_view'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const logId = c.req.param('logId');

    const log = await auditDb.getAuditLogById(db, logId);
    if (!log) {
      return c.json({ error: 'Audit log not found' }, 404);
    }

    return c.json(log);
  })
);

/**
 * POST /api/admin/rbac/audit/export
 * Export audit logs as CSV or JSON
 */
audit.post(
  '/export',
  await requireRbacPermission('perm_audit_export'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const body = await c.req.json() as any;
    const actor = c.get('user');

    const format = body.format || 'json';
    if (!['csv', 'json'].includes(format)) {
      return c.json({ error: 'Format must be csv or json' }, 400);
    }

    const content = await auditDb.generateAuditExport(db, {
      startDate: body.startDate,
      endDate: body.endDate,
      format: format as 'csv' | 'json',
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `audit-export-${timestamp}.${format}`;
    const contentType = format === 'csv' ? 'text/csv' : 'application/json';

    // TODO: Upload to R2 and return signed URL
    // For now, return inline
    return c.newResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  })
);

export default audit;
