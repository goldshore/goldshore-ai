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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { token } = useAuthToken();

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSendEmail = async () => {
    setError(null);
    setSuccess(null);

    if (!formData.to.trim()) {
      setError('Recipient email is required');
      return;
    }

    if (!validateEmail(formData.to)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!formData.subject.trim()) {
      setError('Subject is required');
      return;
    }

    setIsSending(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('/api/admin/email/send', {
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
        setFormData({ to: '', subject: '', template: '' });
        setSuccess('Email queued successfully');
        setTimeout(() => {
          setIsModalOpen(false);
          window.location.reload();
        }, 1000);
      } else if (response.status === 401) {
        setError('Authentication expired. Please refresh the page.');
      } else if (response.status === 400) {
        const err = await response.json().catch(() => ({}));
        setError(err.message || 'Invalid email data');
      } else {
        setError(`Failed to send email (HTTP ${response.status})`);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to send email');
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="gs-stack">
      <div className="gs-row gs-row--between">
        <h2>Email Management</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="gs-button"
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
                className={`${
 v === 'sent'
 ? 'success'
 : v === 'failed'
 ? 'danger'
 : 'warning'
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
          <button className="gs-link-button gs-link-button--danger" title="Delete">
            Delete
          </button>
        )}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setError(null);
          setSuccess(null);
        }}
        title="Send Email"
        onSubmit={handleSendEmail}
        isLoading={isSending}
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
