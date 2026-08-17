import React, { useState, useEffect } from 'react';
import DataTable from './DataTable';
import Modal from './Modal';
import FormField from './FormField';
import AuthGuard from './AuthGuard';
import { useAuthToken } from '../../utils/auth';

interface Entry {
  id: string;
  name: string;
  email: string;
  company?: string;
  message: string;
  status: 'new' | 'contacted' | 'qualified' | 'rejected';
  created_at: string;
  type?: 'contact' | 'lead';
  metadata?: Record<string, any>;
}

interface Props {
  jwtToken?: string;
  initialEntries?: Entry[];
}

function EntriesManagerContent({ jwtToken: _jwtToken }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isQualifyOpen, setIsQualifyOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', company: '', message: '' });
  const [qualifyReason, setQualifyReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'status' | 'delete' | null>(null);
  const [bulkStatus, setBulkStatus] = useState<Entry['status']>('new');
  const [entries, setEntries] = useState<Entry[]>([]);
  const { token } = useAuthToken();

  useEffect(() => {
    // Initialize entries from props
    if (Array.isArray(initialEntries)) {
      setEntries(initialEntries);
    }
  }, [initialEntries]);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const selectAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entries.map((e) => e.id)));
    }
  };

  const handleBulkAction = async () => {
    if (selectedIds.size === 0) {
      setError('No entries selected');
      return;
    }

    setIsSaving(true);
    try {
      if (bulkAction === 'delete') {
        const response = await fetch('/api/admin/entries/leads/bulk-delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ ids: Array.from(selectedIds) }),
        });

        if (response.ok) {
          setSuccess(`Deleted ${selectedIds.size} entries`);
          setEntries(entries.filter((e) => !selectedIds.has(e.id)));
          setSelectedIds(new Set());
          setBulkAction(null);
          setTimeout(() => setSuccess(null), 3000);
        } else {
          const err = await response.json().catch(() => ({}));
          setError(err.message || 'Failed to delete entries');
        }
      } else if (bulkAction === 'status') {
        const response = await fetch('/api/admin/entries/leads/bulk-update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ ids: Array.from(selectedIds), status: bulkStatus }),
        });

        if (response.ok) {
          setSuccess(`Updated ${selectedIds.size} entries to ${bulkStatus}`);
          setEntries(entries.map((e) => selectedIds.has(e.id) ? { ...e, status: bulkStatus } : e));
          setSelectedIds(new Set());
          setBulkAction(null);
          setTimeout(() => setSuccess(null), 3000);
        } else {
          const err = await response.json().catch(() => ({}));
          setError(err.message || 'Failed to update entries');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to perform bulk action');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQualify = async () => {
    if (!selectedEntry || !qualifyReason.trim()) {
      setError('Qualification reason is required');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/entries/leads/${selectedEntry.id}/qualify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reason: qualifyReason }),
      });

      if (response.ok) {
        setSuccess('Lead qualified successfully');
        setIsQualifyOpen(false);
        setQualifyReason('');
        setEntries(entries.map((e) =>
          e.id === selectedEntry.id ? { ...e, status: 'qualified' } : e
        ));
        setSelectedEntry({
          ...selectedEntry,
          status: 'qualified',
        });
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const err = await response.json().catch(() => ({}));
        setError(err.message || 'Failed to qualify lead');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to qualify lead');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEntry = async () => {
    setError(null);
    setSuccess(null);

    if (!formData.name.trim()) {
      setError('Full name is required');
      return;
    }

    if (!formData.email.trim()) {
      setError('Email address is required');
      return;
    }

    if (!validateEmail(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!formData.message.trim()) {
      setError('Message is required');
      return;
    }

    if (formData.message.length < 10) {
      setError('Message must be at least 10 characters');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setFormData({ name: '', email: '', company: '', message: '' });
        setSuccess('Entry created successfully');
        setTimeout(() => {
          setIsModalOpen(false);
          window.location.reload();
        }, 1000);
      } else if (response.status === 401) {
        setError('Authentication expired. Please refresh the page.');
      } else if (response.status === 400) {
        const err = await response.json().catch(() => ({}));
        setError(err.message || 'Invalid entry data');
      } else {
        setError(`Failed to create entry (HTTP ${response.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create entry');
    } finally {
      setIsSaving(false);
    }
  };

  const statusColors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-800',
    contacted: 'bg-yellow-100 text-yellow-800',
    qualified: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Lead Entries</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          + New Entry
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
          {success}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-medium">{selectedIds.size} entries selected</span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Clear selection
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setBulkAction('status')}
              className="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              Change Status
            </button>
            <button
              onClick={() => setBulkAction('delete')}
              className="px-3 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {bulkAction && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded space-y-3">
          {bulkAction === 'status' && (
            <>
              <label className="block">
                <span className="text-sm font-medium">New Status</span>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value as Entry['status'])}
                  className="mt-1 block w-full border rounded px-2 py-1"
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
            </>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleBulkAction}
              disabled={isSaving}
              className="px-3 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
            >
              {isSaving ? 'Processing...' : 'Confirm'}
            </button>
            <button
              onClick={() => {
                setBulkAction(null);
                setSelectedIds(new Set());
              }}
              className="px-3 py-2 bg-gray-400 text-white rounded text-sm hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.size === entries.length && entries.length > 0}
                  onChange={selectAll}
                />
              </th>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Company</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(entry.id)}
                    onChange={() => toggleSelection(entry.id)}
                  />
                </td>
                <td className="p-3 font-medium">{entry.name}</td>
                <td className="p-3 text-gray-600">{entry.email}</td>
                <td className="p-3 text-gray-600">{entry.company || '—'}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[entry.status] || 'bg-gray-100'}`}>
                    {entry.status}
                  </span>
                </td>
                <td className="p-3 text-gray-600">{new Date(entry.created_at).toLocaleDateString()}</td>
                <td className="p-3 text-sm space-x-2">
                  <button
                    onClick={() => {
                      setSelectedEntry(entry);
                      setIsDetailOpen(true);
                    }}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    View
                  </button>
                  {entry.status !== 'qualified' && (
                    <button
                      onClick={() => {
                        setSelectedEntry(entry);
                        setIsQualifyOpen(true);
                      }}
                      className="text-green-500 hover:text-green-700"
                    >
                      Qualify
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setError(null);
          setSuccess(null);
        }}
        title="New Lead Entry"
        onSubmit={handleSaveEntry}
        isLoading={isSaving}
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            {success}
          </div>
        )}
        <FormField
          label="Full Name"
          name="name"
          value={formData.name}
          onChange={(v) => setFormData({ ...formData, name: String(v) })}
          required
        />
        <FormField
          label="Email"
          name="email"
          type="email"
          value={formData.email}
          onChange={(v) => setFormData({ ...formData, email: String(v) })}
          required
        />
        <FormField
          label="Company"
          name="company"
          value={formData.company}
          onChange={(v) => setFormData({ ...formData, company: String(v) })}
        />
        <FormField
          label="Message"
          name="message"
          type="textarea"
          value={formData.message}
          onChange={(v) => setFormData({ ...formData, message: String(v) })}
          required
        />
      </Modal>

      {selectedEntry && (
        <Modal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={`Entry: ${selectedEntry.name}`}
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Email</label>
              <p>{selectedEntry.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Company</label>
              <p>{selectedEntry.company || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Message</label>
              <p className="bg-gray-50 p-3 rounded text-sm">{selectedEntry.message}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Status</label>
              <span className={`inline-block mt-1 px-2 py-1 rounded text-sm font-medium ${statusColors[selectedEntry.status]}`}>
                {selectedEntry.status}
              </span>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Submitted</label>
              <p>{new Date(selectedEntry.created_at).toLocaleString()}</p>
            </div>
            {selectedEntry.metadata?.qualification_reason && (
              <div>
                <label className="text-sm font-medium text-gray-600">Qualification Reason</label>
                <p>{selectedEntry.metadata.qualification_reason}</p>
              </div>
            )}
            {selectedEntry.status !== 'qualified' && (
              <button
                onClick={() => setIsQualifyOpen(true)}
                className="mt-4 w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Qualify This Lead
              </button>
            )}
          </div>
        </Modal>
      )}

      {selectedEntry && (
        <Modal
          isOpen={isQualifyOpen}
          onClose={() => {
            setIsQualifyOpen(false);
            setQualifyReason('');
          }}
          title={`Qualify Lead: ${selectedEntry.name}`}
          onSubmit={handleQualify}
          isLoading={isSaving}
        >
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}
          <FormField
            label="Qualification Reason"
            name="reason"
            type="textarea"
            value={qualifyReason}
            onChange={(v) => setQualifyReason(String(v))}
            required
            placeholder="Why is this lead qualified?"
          />
        </Modal>
      )}
    </div>
  );
}

export default function EntriesManager(props: Props) {
  return (
    <AuthGuard>
      <EntriesManagerContent {...props} />
    </AuthGuard>
  );
}
