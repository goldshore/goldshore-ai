import React, { useState } from 'react';
import { FileText, Plus, Trash2, Eye } from 'lucide-react';
import { DataTable } from './DataTable';
import { Modal } from './Modal';
import { FormField } from './FormField';

interface Entry {
  id: string;
  name: string;
  email: string;
  company?: string;
  message: string;
  status: 'new' | 'contacted' | 'qualified' | 'rejected';
  created_at: string;
}

export function EntriesManager() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', company: '', message: '' });
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveEntry = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setFormData({ name: '', email: '', company: '', message: '' });
        setIsModalOpen(false);
        window.location.reload();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText size={32} /> Lead Entries
        </h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          <Plus size={20} /> New Entry
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
              <Eye size={18} />
            </button>
            <button className="text-red-500 hover:text-red-700" title="Delete">
              <Trash2 size={18} />
            </button>
          </div>
        )}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="New Lead Entry"
        onSubmit={handleSaveEntry}
        isLoading={isSaving}
      >
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
