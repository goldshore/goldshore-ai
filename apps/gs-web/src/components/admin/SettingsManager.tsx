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
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { token } = useAuthToken();

  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings);
      setLoading(false);
      return;
    }

    const fetchSettings = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch('/api/admin/settings', {
          signal: controller.signal,
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          setSettings(data.data || {});
        } else if (response.status === 401) {
          setMessage({ type: 'error', text: 'Authentication expired. Please refresh the page.' });
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setMessage({ type: 'error', text: 'Failed to load settings' });
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(settings),
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
        setTimeout(() => setMessage(null), 3000);
      } else if (response.status === 401) {
        setMessage({ type: 'error', text: 'Authentication expired. Please refresh the page.' });
      } else if (response.status === 400) {
        const err = await response.json().catch(() => ({}));
        setMessage({ type: 'error', text: err.message || 'Invalid settings data' });
      } else {
        setMessage({ type: 'error', text: `Failed to save settings (HTTP ${response.status})` });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setMessage({ type: 'error', text: 'Request timed out. Please try again.' });
      } else {
        setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save settings' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Settings</h2>

      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="bg-white p-6 rounded-lg border space-y-6">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Platform Configuration</h3>
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="space-y-2">
                <div className="h-4 bg-gray-300 rounded w-24 animate-pulse" />
                <div className="h-10 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="h-10 bg-gray-300 rounded w-32 animate-pulse" />
        </div>
      ) : (

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
      )}
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
