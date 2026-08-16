import React, { useState } from 'react';
import { Table } from './Table';
import { Pagination } from './Pagination';
import { FilterBar } from './FilterBar';

interface Entry {
  id: string;
  type: 'contact' | 'lead';
  name: string;
  email: string;
  status: string;
  created_at: string;
  message?: string;
  phone?: string;
  source?: string;
}

interface EntriesManagerProps {
  jwtToken: string;
  initialEntries: {
    items: Entry[];
    total: number;
    offset: number;
    limit: number;
    error?: string | null;
  };
}

export default function EntriesManager({ jwtToken, initialEntries }: EntriesManagerProps) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries.items || []);
  const [total, setTotal] = useState(initialEntries.total || 0);
  const [offset, setOffset] = useState(initialEntries.offset || 0);
  const [limit, setLimit] = useState(initialEntries.limit || 25);
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [responding, setResponding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = async (newOffset: number, filters: Record<string, string> = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        offset: String(newOffset),
        limit: String(limit),
        ...filters,
      });

      const response = await fetch(`/api/admin/entries?${params}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEntries(data.items || []);
        setTotal(data.total || 0);
        setOffset(newOffset);
      } else {
        const errorMsg = `HTTP ${response.status}: Failed to fetch entries`;
        console.error(`[EntriesManager] ${errorMsg}`);
        try {
          const errorData = await response.json();
          console.error('[EntriesManager] Error details:', errorData);
          setError(errorData.message || errorMsg);
        } catch {
          setError(errorMsg);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[EntriesManager] Network error:', err);
      setError(`Connection failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkResponded = async (entryId: string) => {
    setResponding(entryId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/entries/contacts/${entryId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: 'Responded' }),
      });

      if (response.ok) {
        await fetchEntries(offset);
        setSelectedEntry(null);
      } else {
        const errorMsg = `HTTP ${response.status}: Failed to mark as responded`;
        console.error(`[EntriesManager] ${errorMsg}`, { entryId });
        try {
          const errorData = await response.json();
          console.error('[EntriesManager] Error details:', errorData);
          setError(errorData.message || errorMsg);
        } catch {
          setError(errorMsg);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[EntriesManager] Mark responded failed:', err, { entryId });
      setError(`Connection failed: ${message}`);
    } finally {
      setResponding(null);
    }
  };

  const handleDeleteEntry = async (entryId: string, type: 'contact' | 'lead') => {
    if (!confirm('Are you sure you want to delete this entry?')) return;

    setError(null);
    try {
      const endpoint = type === 'contact' ? 'contacts' : 'leads';
      const response = await fetch(`/api/admin/entries/${endpoint}/${entryId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        await fetchEntries(offset);
        setSelectedEntry(null);
      } else {
        const errorMsg = `HTTP ${response.status}: Failed to delete entry`;
        console.error(`[EntriesManager] ${errorMsg}`, { entryId, type });
        try {
          const errorData = await response.json();
          console.error('[EntriesManager] Error details:', errorData);
          setError(errorData.message || errorMsg);
        } catch {
          setError(errorMsg);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[EntriesManager] Delete failed:', err, { entryId, type });
      setError(`Connection failed: ${message}`);
    }
  };

  const filters = [
    {
      key: 'status',
      label: 'Status',
      type: 'select' as const,
      options: [
        { label: 'New', value: 'new' },
        { label: 'Responded', value: 'responded' },
        { label: 'Archived', value: 'archived' },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-center justify-between">
          <div>
            <strong>Error:</strong> {error}
          </div>
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-700 hover:text-red-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      <FilterBar
        filters={filters}
        onFilter={(filters) => fetchEntries(0, filters)}
        onSearch={(query) => fetchEntries(0, { search: query })}
      />

      <Table<Entry>
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'type', label: 'Type' },
          {
            key: 'status',
            label: 'Status',
            render: (status) => (
              <span
                className={`px-2 py-1 text-xs font-semibold rounded ${
                  status === 'responded'
                    ? 'bg-green-100 text-green-800'
                    : status === 'archived'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-blue-100 text-blue-800'
                }`}
              >
                {status}
              </span>
            ),
          },
          { key: 'created_at', label: 'Created', width: '180px' },
        ]}
        data={entries}
        loading={loading}
        onRowClick={setSelectedEntry}
        emptyMessage="No entries found"
      />

      <Pagination
        total={total}
        offset={offset}
        limit={limit}
        onOffsetChange={fetchEntries}
      />

      {selectedEntry && (
        <div className="gs-card space-y-4">
          <h3 className="text-lg font-semibold">Entry Details</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <p className="text-sm gs-text-subtle">Name</p>
                <p className="font-semibold">{selectedEntry.name}</p>
              </div>
              <div>
                <p className="text-sm gs-text-subtle">Email</p>
                <p className="font-mono text-sm">{selectedEntry.email}</p>
              </div>
              {selectedEntry.phone && (
                <div>
                  <p className="text-sm gs-text-subtle">Phone</p>
                  <p className="font-mono text-sm">{selectedEntry.phone}</p>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm gs-text-subtle">Type</p>
                <p className="font-semibold capitalize">{selectedEntry.type}</p>
              </div>
              <div>
                <p className="text-sm gs-text-subtle">Status</p>
                <p className="font-semibold capitalize">{selectedEntry.status}</p>
              </div>
              <div>
                <p className="text-sm gs-text-subtle">Created</p>
                <p>{new Date(selectedEntry.created_at).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {selectedEntry.message && (
            <div>
              <p className="text-sm gs-text-subtle mb-2">Message</p>
              <p className="p-3 bg-gray-50 rounded text-sm">{selectedEntry.message}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {selectedEntry.type === 'contact' && selectedEntry.status !== 'responded' && (
              <button
                onClick={() => handleMarkResponded(selectedEntry.id)}
                disabled={responding === selectedEntry.id}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {responding === selectedEntry.id ? 'Marking...' : 'Mark Responded'}
              </button>
            )}
            <button
              onClick={() => handleDeleteEntry(selectedEntry.id, selectedEntry.type)}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700"
            >
              Delete
            </button>
            <button
              onClick={() => setSelectedEntry(null)}
              className="px-4 py-2 text-sm font-medium border rounded gs-text-subtle hover:bg-opacity-50"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
