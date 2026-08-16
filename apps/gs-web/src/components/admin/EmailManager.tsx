import React, { useState } from 'react';
import DataTable from './DataTable';
import Modal from './Modal';
import FormField from './FormField';
import AuthGuard from './AuthGuard';
import { useAuthToken } from '../../utils/auth';

interface Email {
  id: string;
  to: string;
  subject: string;
  template?: string;
  status: 'pending' | 'sent' | 'failed';
  created_at: string;
}

interface Props {
  jwtToken?: string;
  initialEmails?: Email[];
}

function EmailManagerContent({ jwtToken: _jwtToken }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ to: '', subject: '', template: '' });
  const [isSending, setIsSending] = useState(false);
  const { token } = useAuthToken();

  const handleSendEmail = async () => {
    setIsSending(true);
    try {
      const response = await fetch('/api/admin/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setFormData({ to: '', subject: '', template: '' });
        setIsModalOpen(false);
        window.location.reload();
      } else if (response.status === 401) {
        alert('Authentication expired. Please refresh the page.');
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Email Management</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          + Send Email
        </button>
      </div>

      <DataTable<Email>
        columns={[
          { key: 'to', label: 'To' },
          { key: 'subject', label: 'Subject' },
          {
            key: 'status',
            label: 'Status',
            render: (v) => (
              <span
                className={`px-2 py-1 rounded text-sm font-medium ${
                  v === 'sent'
                    ? 'bg-green-100 text-green-800'
                    : v === 'failed'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {v}
              </span>
            ),
          },
          {
            key: 'created_at',
            label: 'Sent',
            render: (v) => new Date(v).toLocaleString(),
          },
        ]}
        endpoint="/api/admin/email"
        title="Email History"
        actions={() => (
          <button className="text-red-500 hover:text-red-700" title="Delete">
            Delete
          </button>
        )}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Send Email"
        onSubmit={handleSendEmail}
        isLoading={isSending}
      >
        <FormField
          label="Recipient Email"
          name="to"
          type="email"
          value={formData.to}
          onChange={(v) => setFormData({ ...formData, to: String(v) })}
          placeholder="recipient@example.com"
          required
        />
        <FormField
          label="Subject"
          name="subject"
          value={formData.subject}
          onChange={(v) => setFormData({ ...formData, subject: String(v) })}
          placeholder="Email subject"
          required
        />
        <FormField
          label="Template"
          name="template"
          type="select"
          value={formData.template}
          onChange={(v) => setFormData({ ...formData, template: String(v) })}
          options={[
            { value: 'welcome', label: 'Welcome Email' },
            { value: 'password_reset', label: 'Password Reset' },
            { value: 'notification', label: 'Notification' },
          ]}
        />
      </Modal>
    </div>
  );
}

export default function EmailManager(props: Props) {
  return (
    <AuthGuard>
      <EmailManagerContent {...props} />
    </AuthGuard>
  );
}
