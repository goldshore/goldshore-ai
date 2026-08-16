import React, { useState, useEffect } from 'react';
import { Settings, Save, Loader } from 'lucide-react';
import { FormField } from './FormField';

export function SettingsManager() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/admin/settings');
        if (response.ok) {
          const data = await response.json();
          setSettings(data.data || {});
        }
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (response.ok) {
        setMessage('Settings saved successfully!');
        setTimeout(() => setMessage(''), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <Settings size={32} /> Settings
      </h1>

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg">
          {message}
        </div>
      )}

      <div className="bg-white p-6 rounded-lg border space-y-6">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Platform Configuration</h2>
          
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
          className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          <Save size={20} /> {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
