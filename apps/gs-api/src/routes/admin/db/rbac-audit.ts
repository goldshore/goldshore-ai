import type { AdminAuditLog } from '../../../lib/types/rbac';
import { createAuditLogEntry, redactAuditLog } from '../../../lib/rbac';

export async function createAuditEntry(
  db: any,
  params: {
    actorEmail: string;
    action: any;
    targetType: 'role' | 'user' | 'permission';
    targetId: string;
    targetName?: string;
    changes?: Record<string, any>;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
  }
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const entry = createAuditLogEntry({
    actor_email: params.actorEmail,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    target_name: params.targetName,
    changes: params.changes,
    reason: params.reason,
    ip_address: params.ipAddress,
    user_agent: params.userAgent,
    status: 'success',
  });

  return await db.prepare(
    'INSERT INTO admin_audit_log (id, actor_email, action, target_type, target_id, target_name, changes, reason, ip_address, user_agent, status, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id,
    entry.actor_email,
    entry.action,
    entry.target_type,
    entry.target_id,
    entry.target_name,
    entry.changes,
    entry.reason,
    entry.ip_address,
    entry.user_agent,
    entry.status,
    now
  ).run();
}

export async function listAuditLogs(
  db: any,
  options: {
    offset: number;
    limit: number;
    actorEmail?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
    startDate?: string;
    endDate?: string;
  }
) {
  const where: string[] = [];
  const params: any[] = [];

  if (options.actorEmail) {
    where.push('actor_email = ?');
    params.push(options.actorEmail);
  }

  if (options.action) {
    where.push('action = ?');
    params.push(options.action);
  }

  if (options.targetType) {
    where.push('target_type = ?');
    params.push(options.targetType);
  }

  if (options.targetId) {
    where.push('target_id = ?');
    params.push(options.targetId);
  }

  if (options.startDate) {
    where.push('timestamp >= ?');
    params.push(options.startDate);
  }

  if (options.endDate) {
    where.push('timestamp <= ?');
    params.push(options.endDate);
  }

  const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';

  const total = await db.prepare(
    `SELECT COUNT(*) as count FROM admin_audit_log${whereClause}`
  ).bind(...params).first();

  const logs = await db.prepare(
    `SELECT * FROM admin_audit_log${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`
  ).bind(...params, options.limit, options.offset).all();

  return {
    logs: logs.results || [],
    total: total?.count || 0,
    limit: options.limit,
    offset: options.offset,
  };
}

export async function getAuditLogById(db: any, logId: string): Promise<AdminAuditLog | null> {
  const log = await db.prepare('SELECT * FROM admin_audit_log WHERE id = ?').bind(logId).first();
  if (log) {
    return redactAuditLog(log);
  }
  return null;
}

export async function generateAuditExport(
  db: any,
  options: {
    startDate?: string;
    endDate?: string;
    format: 'csv' | 'json';
  }
) {
  const where: string[] = [];
  const params: any[] = [];

  if (options.startDate) {
    where.push('timestamp >= ?');
    params.push(options.startDate);
  }

  if (options.endDate) {
    where.push('timestamp <= ?');
    params.push(options.endDate);
  }

  const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';

  const logs = await db.prepare(
    `SELECT * FROM admin_audit_log${whereClause} ORDER BY timestamp DESC`
  ).bind(...params).all();

  const data = (logs.results || []).map(log => redactAuditLog(log));

  if (options.format === 'csv') {
    return convertToCSV(data);
  } else {
    return JSON.stringify(data, null, 2);
  }
}

function convertToCSV(logs: AdminAuditLog[]): string {
  const headers = [
    'id',
    'timestamp',
    'actor_email',
    'action',
    'target_type',
    'target_id',
    'target_name',
    'status',
    'reason',
  ];

  const rows = logs.map(log => [
    log.id,
    log.timestamp,
    log.actor_email,
    log.action,
    log.target_type,
    log.target_id,
    log.target_name || '',
    log.status,
    log.reason || '',
  ]);

  const header = headers.join(',');
  const body = rows.map(row =>
    row.map(cell => {
      if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',')
  ).join('\n');

  return `${header}\n${body}`;
}
