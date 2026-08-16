import React, { useState } from 'react';
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
}

interface Props {
  jwtToken?: string;
  initialEntries?: Entry[];
}

function EntriesManagerContent({ jwtToken: _jwtToken }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', company: '', message: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { token } = useAuthToken();

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('/api/admin/entries', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formData),
      });

      clearTimeout(timeoutId);

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
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create entry');
      }
    } finally {
      setIsSaving(false);
    }
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

      <DataTable<Entry>
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'company', label: 'Company' },
          { key: 'status', label: 'Status', render: (v) => <span className={`px-2 py-1 rounded text-sm font-medium ${v === 'qualified' ? 'bg-green-100 text-green-800' : v === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{v}</span> },
          { key: 'created_at', label: 'Date', render: (v) => new Date(v).toLocaleDateString() },
        ]}
        endpoint="/api/admin/entries"
        title="Submitted Entries"
        actions={(row) => (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSelectedEntry(row);
                setIsDetailOpen(true);
              }}
              className="text-blue-500 hover:text-blue-700"
              title="View details"
            >
              View
            </button>
            <button className="text-red-500 hover:text-red-700" title="Delete">
              Delete
            </button>
          </div>
        )}
      />

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
          <div className="space-y-3">
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
              <p>{selectedEntry.status}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Submitted</label>
              <p>{new Date(selectedEntry.created_at).toLocaleString()}</p>
            </div>
          </div>
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
