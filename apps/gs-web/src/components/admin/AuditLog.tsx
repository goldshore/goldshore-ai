import React from 'react';

interface AuditEntry {
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

interface AuditLogProps {
  entries: AuditEntry[];
  isLoading: boolean;
  onExport: () => void;
}

export default function AuditLog({ entries, isLoading }: AuditLogProps) {
  if (isLoading) {
    return (
      <div className="gs-empty gs-text-subtle">Loading audit logs...</div>
    );
  }

  if (!entries.length) {
    return (
      <div className="gs-empty gs-text-subtle">No audit logs found</div>
    );
  }

  return (
    <div className="gs-table-scroll">
      <table className="gs-admin-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>User</th>
            <th>Action</th>
            <th>Target</th>
            <th>Changes</th>
            <th>IP Address</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>
                {new Date(entry.created_at).toLocaleDateString()} {new Date(entry.created_at).toLocaleTimeString()}
              </td>
              <td>{entry.actor_email}</td>
              <td>
                <span className="gs-badge">
                  {entry.action.replace(/_/g, ' ')}
                </span>
              </td>
              <td>
                <div>
                  <div>{entry.target_name}</div>
                  <div className="gs-cell-meta">{entry.target_type}</div>
                </div>
              </td>
              <td>
                <pre className="gs-code-cell">
                  {JSON.stringify(entry.changes, null, 2)}
                </pre>
              </td>
              <td className="gs-cell-meta">{entry.ip_address || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
