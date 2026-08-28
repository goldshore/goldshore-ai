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
    new: 'info',
    contacted: 'warning',
    qualified: 'success',
    rejected: 'danger',
  };

  return (
    <div className="gs-stack">
      <div className="gs-row gs-row--between">
        <h2>Lead Entries</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="gs-button"
        >
          + New Entry
        </button>
      </div>

      {error && (
        <div className="gs-alert gs-alert--error">
          {error}
        </div>
      )}

      {success && (
        <div className="gs-alert gs-alert--success">
          {success}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="gs-alert gs-alert--info">
          <div className="gs-row gs-row--between">
            <span>{selectedIds.size} entries selected</span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="gs-text-subtle"
            >
              Clear selection
            </button>
          </div>
          <div className="gs-row">
            <button
              onClick={() => setBulkAction('status')}
              className="gs-button"
            >
              Change Status
            </button>
            <button
              onClick={() => setBulkAction('delete')}
              className="gs-button"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {bulkAction && (
        <div>
          {bulkAction === 'status' && (
            <>
              <label>
                <span>New Status</span>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value as Entry['status'])}
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
            </>
          )}
          <div className="gs-row">
            <button
              onClick={handleBulkAction}
              disabled={isSaving}
              className="gs-button"
            >
              {isSaving ? 'Processing...' : 'Confirm'}
            </button>
            <button
              onClick={() => {
                setBulkAction(null);
                setSelectedIds(new Set());
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div>
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={selectedIds.size === entries.length && entries.length > 0}
                  onChange={selectAll}
                />
              </th>
              <th>Name</th>
              <th>Email</th>
              <th>Company</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} >
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(entry.id)}
                    onChange={() => toggleSelection(entry.id)}
                  />
                </td>
                <td>{entry.name}</td>
                <td className="gs-text-subtle">{entry.email}</td>
                <td className="gs-text-subtle">{entry.company || '—'}</td>
                <td>
                  <span className={`gs-badge ${statusColors[entry.status] || ''}`}>
                    {entry.status}
                  </span>
                </td>
                <td className="gs-text-subtle">{new Date(entry.created_at).toLocaleDateString()}</td>
                <td>
                  <button
                    onClick={() => {
                      setSelectedEntry(entry);
                      setIsDetailOpen(true);
                    }}
                    className="gs-link-button"
                  >
                    View
                  </button>
                  {entry.status !== 'qualified' && (
                    <button
                      onClick={() => {
                        setSelectedEntry(entry);
                        setIsQualifyOpen(true);
                      }}
                      className="gs-link-button"
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
          <div className="gs-alert gs-alert--error">
            {error}
          </div>
        )}
        {success && (
          <div className="gs-alert gs-alert--success">
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
          <div className="gs-stack-sm">
            <div>
              <label className="gs-text-subtle">Email</label>
              <p>{selectedEntry.email}</p>
            </div>
            <div>
              <label className="gs-text-subtle">Company</label>
              <p>{selectedEntry.company || 'N/A'}</p>
            </div>
            <div>
              <label className="gs-text-subtle">Message</label>
              <p>{selectedEntry.message}</p>
            </div>
            <div>
              <label className="gs-text-subtle">Status</label>
              <span className={`gs-badge ${statusColors[selectedEntry.status]}`}>
                {selectedEntry.status}
              </span>
            </div>
            <div>
              <label className="gs-text-subtle">Submitted</label>
              <p>{new Date(selectedEntry.created_at).toLocaleString()}</p>
            </div>
            {selectedEntry.metadata?.qualification_reason && (
              <div>
                <label className="gs-text-subtle">Qualification Reason</label>
                <p>{selectedEntry.metadata.qualification_reason}</p>
              </div>
            )}
            {selectedEntry.status !== 'qualified' && (
              <button
                onClick={() => setIsQualifyOpen(true)}
                className="gs-button gs-button--block"
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
            <div className="gs-alert gs-alert--error">
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
