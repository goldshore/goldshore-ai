import React, { useState, useEffect } from 'react';
import FormField from './FormField';
import AuthGuard from './AuthGuard';
import { useAuthToken } from '../../utils/auth';

interface Props {
  jwtToken?: string;
  initialSettings?: Record<string, any>;
}

function SettingsContent({ initialSettings }: Props) {
  const [settings, setSettings] = useState<Record<string, string>>(initialSettings || {});
  const [loading, setLoading] = useState(!initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const { token } = useAuthToken();

  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings);
      setLoading(false);
      return;
    }

    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/admin/settings', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (response.ok) {
          const data = await response.json();
          setSettings(data.data || {});
        }
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [initialSettings, token]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(settings),
      });
      if (response.ok) {
        setMessage('Settings saved successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else if (response.status === 401) {
        setMessage('Authentication expired. Please refresh the page.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Settings</h2>

      {message && (
        <div className={`p-4 rounded-lg ${
          message.includes('Authentication')
            ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
            : 'bg-green-50 border border-green-200 text-green-800'
        }`}>
          {message}
        </div>
      )}

      <div className="bg-white p-6 rounded-lg border space-y-6">
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Platform Configuration</h3>

          <FormField
            label="Site Name"
            name="site_name"
            value={settings.site_name || ''}
            onChange={(v) => setSettings({ ...settings, site_name: String(v) })}
            placeholder="GoldShore"
          />

          <FormField
            label="Admin Email"
            name="admin_email"
            type="email"
            value={settings.admin_email || ''}
            onChange={(v) => setSettings({ ...settings, admin_email: String(v) })}
            placeholder="admin@example.com"
          />

          <FormField
            label="Support Email"
            name="support_email"
            type="email"
            value={settings.support_email || ''}
            onChange={(v) => setSettings({ ...settings, support_email: String(v) })}
            placeholder="support@example.com"
          />

          <FormField
            label="API Base URL"
            name="api_base_url"
            value={settings.api_base_url || ''}
            onChange={(v) => setSettings({ ...settings, api_base_url: String(v) })}
            placeholder="https://api.goldshore.ai"
          />

          <FormField
            label="Max File Upload (MB)"
            name="max_upload_mb"
            type="number"
            value={settings.max_upload_mb || 100}
            onChange={(v) => setSettings({ ...settings, max_upload_mb: String(v) })}
          />

          <FormField
            label="Email Provider"
            name="email_provider"
            type="select"
            value={settings.email_provider || 'mailchannels'}
            onChange={(v) => setSettings({ ...settings, email_provider: String(v) })}
            options={[
              { value: 'mailchannels', label: 'MailChannels' },
              { value: 'sendgrid', label: 'SendGrid' },
              { value: 'ses', label: 'AWS SES' },
            ]}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

export default function SettingsManager(props: Props) {
  return (
    <AuthGuard>
      <SettingsContent {...props} />
    </AuthGuard>
  );
}
