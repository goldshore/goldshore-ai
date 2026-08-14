import React, { useState } from 'react';
import { Form } from './Form';

interface SettingsManagerProps {
  jwtToken: string;
  initialSettings: Record<string, any>;
}

export default function SettingsManager({ jwtToken, initialSettings }: SettingsManagerProps) {
  const [settings, setSettings] = useState<Record<string, any>>(initialSettings || {});
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSaveSetting = async (key: string, value: any) => {
    try {
      const response = await fetch(`/api/admin/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, value }),
      });

      if (response.ok) {
        setSettings((prev) => ({ ...prev, [key]: value }));
        setEditing(null);
        setSuccess(`Setting "${key}" updated successfully`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Failed to save setting');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleDeleteSetting = async (key: string) => {
    if (!confirm(`Are you sure you want to delete the setting "${key}"?`)) return;

    try {
      const response = await fetch(`/api/admin/settings?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setSettings((prev) => {
          const updated = { ...prev };
          delete updated[key];
          return updated;
        });
        setSuccess(`Setting "${key}" deleted`);
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleAddNewSetting = async (data: Record<string, any>) => {
    const { key, value } = data;
    if (!key || !value) {
      setError('Key and value are required');
      return;
    }

    await handleSaveSetting(key, value);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
          {success}
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Current Settings</h3>
        <div className="space-y-2">
          {Object.entries(settings).length === 0 ? (
            <p className="text-sm gs-text-subtle">No settings configured yet.</p>
          ) : (
            Object.entries(settings).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="font-mono text-sm font-semibold">{key}</p>
                  <p className="text-sm gs-text-subtle">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(key)}
                    className="px-3 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded hover:bg-blue-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteSetting(key)}
                    className="px-3 py-1 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {editing && (
        <div className="gs-card space-y-4">
          <h3 className="text-lg font-semibold">Edit Setting: {editing}</h3>
          <Form
            fields={[
              {
                name: 'value',
                label: 'Value',
                type: 'text',
                required: true,
                value: settings[editing],
              },
            ]}
            onSubmit={(data) => {
              handleSaveSetting(editing, data.value);
            }}
            submitLabel="Save Setting"
          />
          <button
            onClick={() => setEditing(null)}
            className="w-full px-4 py-2 text-sm font-medium border rounded gs-text-subtle hover:bg-opacity-50"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="gs-card space-y-4">
        <h3 className="text-lg font-semibold">Add New Setting</h3>
        <Form
          fields={[
            {
              name: 'key',
              label: 'Setting Key',
              type: 'text',
              required: true,
              placeholder: 'e.g., company_name',
            },
            {
              name: 'value',
              label: 'Setting Value',
              type: 'text',
              required: true,
              placeholder: 'e.g., My Company',
            },
          ]}
          onSubmit={handleAddNewSetting}
          submitLabel="Add Setting"
        />
      </div>
    </div>
  );
}
