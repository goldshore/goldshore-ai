import { useState, useEffect } from 'react';

interface Secret {
  id: string;
  integration_id: string;
  key_type: string;
  key_prefix: string;
  status: string;
  created_at: string;
  created_by: string;
}

interface SecretsManagerProps {
  initialSecrets?: Secret[];
  apiBaseUrl?: string;
  jwtToken?: string;
}

export default function SecretsManager({
  initialSecrets = [],
  apiBaseUrl = 'https://api.goldshore.ai/admin',
  jwtToken = ''
}: SecretsManagerProps) {
  const [secrets, setSecrets] = useState<Secret[]>(initialSecrets);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showRotateForm, setShowRotateForm] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    integration_id: '',
    key_type: '',
    value: '',
    expires_at: '',
  });

  const [rotateData, setRotateData] = useState({
    new_value: '',
  });

  const handleCreateSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/secrets`, {
        method: 'POST',
        headers: {
          'CF-Authorization': jwtToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integration_id: formData.integration_id,
          key_type: formData.key_type,
          value: formData.value,
          expires_at: formData.expires_at || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create secret');
      }

      setFormData({ integration_id: '', key_type: '', value: '', expires_at: '' });
      setShowCreateForm(false);

      // Refresh list
      await loadSecrets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create secret');
    } finally {
      setLoading(false);
    }
  };

  const handleRotateSecret = async (secretId: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/secrets/${secretId}`, {
        method: 'PATCH',
        headers: {
          'CF-Authorization': jwtToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'rotate',
          new_value: rotateData.new_value,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to rotate secret');
      }

      setRotateData({ new_value: '' });
      setShowRotateForm(null);

      // Refresh list
      await loadSecrets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rotate secret');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSecret = async (secretId: string) => {
    if (!confirm('Are you sure you want to delete this secret?')) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/secrets/${secretId}`, {
        method: 'DELETE',
        headers: {
          'CF-Authorization': jwtToken,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete secret');
      }

      // Refresh list
      await loadSecrets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete secret');
    } finally {
      setLoading(false);
    }
  };

  const loadSecrets = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/secrets`, {
        headers: {
          'CF-Authorization': jwtToken,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        setSecrets(data.items || []);
      }
    } catch (err) {
      console.error('Failed to load secrets:', err);
    }
  };

  useEffect(() => {
    if (initialSecrets.length === 0) {
      loadSecrets();
    }
  }, []);

  return (
    <div className="space-y-6">
      {error && (
        <div className="gs-card bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Manage Secrets</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          disabled={loading}
          className="gs-btn gs-btn-primary text-sm px-4 py-2"
        >
          {showCreateForm ? 'Cancel' : '+ Create Secret'}
        </button>
      </div>

      {showCreateForm && (
        <div className="gs-card p-6 space-y-4">
          <h3 className="font-semibold">Create New Secret</h3>
          <form onSubmit={handleCreateSecret} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Integration ID</label>
              <input
                type="text"
                placeholder="e.g., stripe, github, google"
                value={formData.integration_id}
                onChange={(e) => setFormData({ ...formData, integration_id: e.target.value })}
                className="w-full px-3 py-2 border border-[var(--gs-color-border)] rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Key Type</label>
              <input
                type="text"
                placeholder="e.g., api_key, secret_key, webhook_secret"
                value={formData.key_type}
                onChange={(e) => setFormData({ ...formData, key_type: e.target.value })}
                className="w-full px-3 py-2 border border-[var(--gs-color-border)] rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Secret Value</label>
              <textarea
                placeholder="Paste the secret value here (will be encrypted)"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                className="w-full px-3 py-2 border border-[var(--gs-color-border)] rounded font-mono text-sm"
                rows={3}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Expiration (Optional)</label>
              <input
                type="datetime-local"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                className="w-full px-3 py-2 border border-[var(--gs-color-border)] rounded"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={loading || !formData.integration_id || !formData.key_type || !formData.value}
                className="gs-btn gs-btn-primary px-4 py-2 text-sm"
              >
                {loading ? 'Creating...' : 'Create Secret'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="gs-btn gs-btn-secondary px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="gs-card overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-sm gs-text-subtle border-b border-[var(--gs-color-border)]">
              <th className="pb-2 px-4">Integration</th>
              <th className="pb-2 px-4">Key Type</th>
              <th className="pb-2 px-4">Key Prefix</th>
              <th className="pb-2 px-4">Created</th>
              <th className="pb-2 px-4">Created By</th>
              <th className="pb-2 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {secrets.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 px-4 text-center gs-text-subtle text-sm">
                  No secrets found
                </td>
              </tr>
            ) : (
              secrets.map((secret) => (
                <tr key={secret.id} className="border-b border-[var(--gs-color-border)]/50">
                  <td className="py-3 px-4 font-mono text-sm">{secret.integration_id}</td>
                  <td className="py-3 px-4 text-sm">{secret.key_type}</td>
                  <td className="py-3 px-4 font-mono text-xs text-gray-500">{secret.key_prefix}***</td>
                  <td className="py-3 px-4 text-sm gs-text-subtle">
                    {new Date(secret.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-sm gs-text-subtle">{secret.created_by}</td>
                  <td className="py-3 px-4 space-x-2">
                    <button
                      onClick={() => setShowRotateForm(secret.id)}
                      disabled={loading}
                      className="gs-btn gs-btn-secondary text-xs px-2 py-1"
                    >
                      Rotate
                    </button>
                    <button
                      onClick={() => handleDeleteSecret(secret.id)}
                      disabled={loading}
                      className="gs-btn gs-btn-danger text-xs px-2 py-1"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showRotateForm && (
        <div className="gs-card p-6 space-y-4 bg-yellow-50 border border-yellow-200">
          <h3 className="font-semibold text-yellow-900">Rotate Secret</h3>
          <p className="text-sm text-yellow-800">
            Enter the new secret value below. The old value will be archived.
          </p>
          <textarea
            placeholder="Paste the new secret value"
            value={rotateData.new_value}
            onChange={(e) => setRotateData({ new_value: e.target.value })}
            className="w-full px-3 py-2 border border-yellow-300 rounded font-mono text-sm"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleRotateSecret(showRotateForm)}
              disabled={loading || !rotateData.new_value}
              className="gs-btn gs-btn-warning px-4 py-2 text-sm"
            >
              {loading ? 'Rotating...' : 'Rotate Secret'}
            </button>
            <button
              onClick={() => {
                setShowRotateForm(null);
                setRotateData({ new_value: '' });
              }}
              className="gs-btn gs-btn-secondary px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
