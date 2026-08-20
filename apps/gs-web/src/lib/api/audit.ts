export interface AuditEntry {
  id: string;
  actor_email: string;
  action: string;
  target_type: 'role' | 'user' | 'permission' | 'system';
  target_id: string;
  target_name: string;
  changes: Record<string, any>;
  reason?: string;
  ip_address?: string;
  created_at: string;
}

export interface AuditLogResponse {
  entries: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

export async function listAuditLogs(params?: {
  limit?: number;
  offset?: number;
  filter?: string;
}): Promise<AuditLogResponse> {
  const query = new URLSearchParams();
  if (params?.limit) query.append('limit', params.limit.toString());
  if (params?.offset) query.append('offset', params.offset.toString());
  if (params?.filter) query.append('filter', params.filter);

  const response = await fetch(`/api/admin/audit?${query}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch audit logs: ${response.statusText}`);
  }

  return response.json();
}

export async function exportAuditLogs(params?: {
  format?: 'csv' | 'json';
  filter?: string;
}): Promise<Blob> {
  const query = new URLSearchParams();
  if (params?.format) query.append('format', params.format);
  if (params?.filter) query.append('filter', params.filter);

  const response = await fetch(`/api/admin/audit/export?${query}`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Failed to export audit logs: ${response.statusText}`);
  }

  return response.blob();
}
