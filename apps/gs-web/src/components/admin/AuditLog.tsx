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
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-600">Loading audit logs...</div>
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-600">No audit logs found</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Date</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">User</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Action</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Target</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Changes</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">IP Address</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {entries.map((entry) => (
            <tr key={entry.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-900">
                {new Date(entry.created_at).toLocaleDateString()} {new Date(entry.created_at).toLocaleTimeString()}
              </td>
              <td className="px-4 py-3 text-gray-900">{entry.actor_email}</td>
              <td className="px-4 py-3">
                <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                  {entry.action.replace(/_/g, ' ')}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-900">
                <div className="text-sm">
                  <div className="font-medium">{entry.target_name}</div>
                  <div className="text-gray-500 text-xs">{entry.target_type}</div>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600 text-xs">
                <pre className="bg-gray-50 p-2 rounded overflow-auto max-w-xs">
                  {JSON.stringify(entry.changes, null, 2)}
                </pre>
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs">{entry.ip_address || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
