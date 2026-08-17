const API_BASE = '/api/admin/rbac/audit';

export async function listAuditLogs(
  offset = 0,
  limit = 50,
  filters?: {
    actorEmail?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
    startDate?: string;
    endDate?: string;
  }
) {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });

  if (filters?.actorEmail) params.set('actorEmail', filters.actorEmail);
  if (filters?.action) params.set('action', filters.action);
  if (filters?.targetType) params.set('targetType', filters.targetType);
  if (filters?.targetId) params.set('targetId', filters.targetId);
  if (filters?.startDate) params.set('startDate', filters.startDate);
  if (filters?.endDate) params.set('endDate', filters.endDate);

  const res = await fetch(`${API_BASE}?${params}`);
  if (!res.ok) throw new Error(`Failed to list audit logs: ${res.statusText}`);
  return res.json();
}

export async function getAuditLogById(logId: string) {
  const res = await fetch(`${API_BASE}/${logId}`);
  if (!res.ok) throw new Error(`Failed to get audit log: ${res.statusText}`);
  return res.json();
}

export async function exportAuditLogs(
  format: 'csv' | 'json',
  filters?: {
    startDate?: string;
    endDate?: string;
    actorEmail?: string;
  }
) {
  const params = new URLSearchParams({ format });
  if (filters?.startDate) params.set('startDate', filters.startDate);
  if (filters?.endDate) params.set('endDate', filters.endDate);
  if (filters?.actorEmail) params.set('actorEmail', filters.actorEmail);

  const res = await fetch(`${API_BASE}/export?${params}`);
  if (!res.ok) throw new Error(`Failed to export audit logs: ${res.statusText}`);

  if (format === 'csv') {
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    return res.json();
  }
}
