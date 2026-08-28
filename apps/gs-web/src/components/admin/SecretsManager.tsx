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
    <div className="gs-stack">
      {error && (
        <div className="gs-card gs-alert gs-alert--error">
          <p>{error}</p>
        </div>
      )}

      <div className="gs-row gs-row--between">
        <h2>Manage Secrets</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          disabled={loading}
          className="gs-btn gs-btn-primary"
        >
          {showCreateForm ? 'Cancel' : '+ Create Secret'}
        </button>
      </div>

      {showCreateForm && (
        <div className="gs-card gs-stack-sm">
          <h3>Create New Secret</h3>
          <form onSubmit={handleCreateSecret} className="gs-stack-sm">
            <div>
              <label>Integration ID</label>
              <input
                type="text"
                placeholder="e.g., stripe, github, google"
                value={formData.integration_id}
                onChange={(e) => setFormData({ ...formData, integration_id: e.target.value })}
                
                required
              />
            </div>
            <div>
              <label>Key Type</label>
              <input
                type="text"
                placeholder="e.g., api_key, secret_key, webhook_secret"
                value={formData.key_type}
                onChange={(e) => setFormData({ ...formData, key_type: e.target.value })}
                
                required
              />
            </div>
            <div>
              <label>Secret Value</label>
              <textarea
                placeholder="Paste the secret value here (will be encrypted)"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                className="gs-mono"
                rows={3}
                required
              />
            </div>
            <div>
              <label>Expiration (Optional)</label>
              <input
                type="datetime-local"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                
              />
            </div>
            <div className="gs-row">
              <button
                type="submit"
                disabled={loading || !formData.integration_id || !formData.key_type || !formData.value}
                className="gs-btn gs-btn-primary"
              >
                {loading ? 'Creating...' : 'Create Secret'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="gs-btn gs-btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="gs-card">
        <table>
          <thead>
            <tr className="gs-text-subtle">
              <th>Integration</th>
              <th>Key Type</th>
              <th>Key Prefix</th>
              <th>Created</th>
              <th>Created By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {secrets.length === 0 ? (
              <tr>
                <td colSpan={6} className="gs-text-subtle">
                  No secrets found
                </td>
              </tr>
            ) : (
              secrets.map((secret) => (
                <tr key={secret.id} className="border-[var(--gs-color-border)]/50">
                  <td className="gs-mono">{secret.integration_id}</td>
                  <td>{secret.key_type}</td>
                  <td className="gs-cell-meta gs-mono">{secret.key_prefix}***</td>
                  <td className="gs-text-subtle">
                    {new Date(secret.created_at).toLocaleDateString()}
                  </td>
                  <td className="gs-text-subtle">{secret.created_by}</td>
                  <td>
                    <button
                      onClick={() => setShowRotateForm(secret.id)}
                      disabled={loading}
                      className="gs-btn gs-btn-secondary"
                    >
                      Rotate
                    </button>
                    <button
                      onClick={() => handleDeleteSecret(secret.id)}
                      disabled={loading}
                      className="gs-btn gs-btn-danger"
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
        <div className="gs-card gs-alert gs-alert--warning gs-stack-sm">
          <h3>Rotate Secret</h3>
          <p>
            Enter the new secret value below. The old value will be archived.
          </p>
          <textarea
            placeholder="Paste the new secret value"
            value={rotateData.new_value}
            onChange={(e) => setRotateData({ new_value: e.target.value })}
            className="gs-mono"
            rows={3}
          />
          <div className="gs-row">
            <button
              onClick={() => handleRotateSecret(showRotateForm)}
              disabled={loading || !rotateData.new_value}
              className="gs-btn gs-btn-warning"
            >
              {loading ? 'Rotating...' : 'Rotate Secret'}
            </button>
            <button
              onClick={() => {
                setShowRotateForm(null);
                setRotateData({ new_value: '' });
              }}
              className="gs-btn gs-btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
