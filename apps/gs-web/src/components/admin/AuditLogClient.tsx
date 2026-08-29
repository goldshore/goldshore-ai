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
    <div className="gs-stack">
      {error && (
        <div className="gs-alert gs-alert--error">
          {error}
        </div>
      )}

      <div className="gs-panel">
        <h2>Filters</h2>
        <div className="gs-list-grid">
          <div className="gs-input-group">
            <label>
              User Email
            </label>
            <input
              type="text"
              value={filters.actorEmail}
              onChange={(e) => handleFilterChange('actorEmail', e.target.value)}
              placeholder="Filter by user..."
            />
          </div>
          <div className="gs-input-group">
            <label>
              Action
            </label>
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
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
          <div className="gs-input-group">
            <label>
              From Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>
          <div className="gs-input-group">
            <label>
              To Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>
          <div className="gs-grid-cell-end">
            <button
              onClick={handleExport}
              className="gs-button gs-button--block"
            >
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="gs-panel">
        <AuditLog entries={entries} isLoading={isLoading} onExport={handleExport} />

        {total > limit && (
          <div className="gs-row gs-row--between">
            <p className="gs-text-subtle">
              Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} entries
            </p>
            <div className="gs-row">
              <button
                type="button"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="gs-button gs-button--secondary gs-button--small"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="gs-button gs-button--secondary gs-button--small"
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
