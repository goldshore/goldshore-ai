import React, { useState, useEffect } from 'react';
import AuditLog from './AuditLog';
import { listAuditLogs, exportAuditLogs } from '@lib/api/audit';

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

export default function AuditLogClient() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [filters, setFilters] = useState({
    actorEmail: '',
    action: '',
    targetType: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    loadAuditLogs();
  }, [offset, filters]);

  const loadAuditLogs = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await listAuditLogs(offset, limit, filters);
      setEntries(result.entries || []);
      setTotal(result.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setError(null);
      await exportAuditLogs('csv', {
        startDate: filters.startDate,
        endDate: filters.endDate,
        actorEmail: filters.actorEmail,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export audit logs');
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setOffset(0);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              User Email
            </label>
            <input
              type="text"
              value={filters.actorEmail}
              onChange={(e) => handleFilterChange('actorEmail', e.target.value)}
              placeholder="Filter by user..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Action
            </label>
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All actions</option>
              <option value="created_role">Created role</option>
              <option value="updated_role">Updated role</option>
              <option value="deleted_role">Deleted role</option>
              <option value="created_user">Created user</option>
              <option value="suspended_user">Suspended user</option>
              <option value="restored_user">Restored user</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              From Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              To Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleExport}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded"
            >
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <AuditLog entries={entries} isLoading={isLoading} onExport={handleExport} />

        {total > limit && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} entries
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-3 py-2 border border-gray-300 rounded text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="px-3 py-2 border border-gray-300 rounded text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
