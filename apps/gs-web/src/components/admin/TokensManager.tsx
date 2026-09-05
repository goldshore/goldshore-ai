import { useState, useEffect } from 'react';

interface Token {
  id: string;
  name: string;
  prefix: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  status: string;
}

interface TokensManagerProps {
  initialTokens?: Token[];
  apiBaseUrl?: string;
  jwtToken?: string;
}

export default function TokensManager({
  initialTokens = [],
  apiBaseUrl = '/api/admin',
  jwtToken = ''
}: TokensManagerProps) {
  const [tokens, setTokens] = useState<Token[]>(initialTokens);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    expires_at: '',
  });

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/tokens`, {
        method: 'POST',
        headers: {
          'CF-Authorization': jwtToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          expires_at: formData.expires_at || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create token');
      }

      const data = await res.json();
      setGeneratedToken(data.token);

      setFormData({ name: '', expires_at: '' });
      setShowCreateForm(false);

      // Refresh list
      await loadTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create token');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshToken = async (tokenId: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/tokens/${tokenId}`, {
        method: 'PATCH',
        headers: {
          'CF-Authorization': jwtToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'refresh' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to refresh token');
      }

      const data = await res.json();
      setGeneratedToken(data.token);

      // Refresh list
      await loadTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh token');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    if (!confirm('Are you sure you want to revoke this token?')) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/tokens/${tokenId}`, {
        method: 'DELETE',
        headers: {
          'CF-Authorization': jwtToken,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to revoke token');
      }

      // Refresh list
      await loadTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke token');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, tokenId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTokenId(tokenId);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  const loadTokens = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/tokens`, {
        headers: {
          'CF-Authorization': jwtToken,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        setTokens(data.items || []);
      }
    } catch (err) {
      console.error('Failed to load tokens:', err);
    }
  };

  useEffect(() => {
    if (initialTokens.length === 0) {
      loadTokens();
    }
  }, []);

  return (
    <div className="gs-stack">
      {error && (
        <div className="gs-card gs-alert gs-alert--error">
          <p>{error}</p>
        </div>
      )}

      {generatedToken && (
        <div className="gs-card gs-alert gs-alert--success">
          <div>
            <h3>✅ Token Created Successfully</h3>
            <p>
              Save this token now. You won't be able to see it again.
            </p>
          </div>
          <div className="gs-row gs-mono">
            <code>{generatedToken}</code>
            <button
              onClick={() => copyToClipboard(generatedToken, 'new')}
              className="gs-btn gs-btn-primary"
            >
              {copiedTokenId === 'new' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => setGeneratedToken(null)}
            className="gs-btn gs-btn-secondary"
          >
            Done
          </button>
        </div>
      )}

      <div className="gs-row gs-row--between">
        <h2>API Tokens</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          disabled={loading}
          className="gs-btn gs-btn-primary"
        >
          {showCreateForm ? 'Cancel' : '+ Generate Token'}
        </button>
      </div>

      {showCreateForm && (
        <div className="gs-card gs-stack-sm">
          <h3>Generate New Token</h3>
          <form onSubmit={handleCreateToken} className="gs-stack-sm">
            <div>
              <label>Token Name</label>
              <input
                type="text"
                placeholder="e.g., CI/CD Pipeline, Mobile App, Webhook"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                
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
              <p className="gs-cell-meta">Leave empty for no expiration</p>
            </div>
            <div className="gs-row">
              <button
                type="submit"
                disabled={loading || !formData.name}
                className="gs-btn gs-btn-primary"
              >
                {loading ? 'Generating...' : 'Generate Token'}
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
              <th>Name</th>
              <th>Prefix</th>
              <th>Last Used</th>
              <th>Expires</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tokens.length === 0 ? (
              <tr>
                <td colSpan={6} className="gs-text-subtle">
                  No API tokens yet
                </td>
              </tr>
            ) : (
              tokens.map((token) => (
                <tr key={token.id} className="border-[var(--gs-color-border)]/50">
                  <td>{token.name}</td>
                  <td className="gs-text-subtle gs-mono">{token.prefix}***</td>
                  <td className="gs-text-subtle">
                    {token.last_used_at
                      ? new Date(token.last_used_at).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="gs-text-subtle">
                    {token.expires_at
                      ? new Date(token.expires_at).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td>
                    <span
                      className={`${
 token.status === 'active'
 ? 'gs-pill gs-pill--success'
 : 'gs-pill gs-pill--danger'
 }`}
                    >
                      {token.status}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleRefreshToken(token.id)}
                      disabled={loading}
                      className="gs-btn gs-btn-secondary"
                    >
                      Refresh
                    </button>
                    <button
                      onClick={() => handleRevokeToken(token.id)}
                      disabled={loading}
                      className="gs-btn gs-btn-danger"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="gs-card gs-alert gs-alert--info">
        <h3>ℹ️ API Token Tips</h3>
        <ul className="gs-input-group">
          <li>• Tokens start with a prefix for easy identification</li>
          <li>• The full token is only shown once—save it immediately</li>
          <li>• Use separate tokens for different applications</li>
          <li>• Refresh tokens to rotate credentials without downtime</li>
          <li>• Revoke tokens immediately if compromised</li>
        </ul>
      </div>
    </div>
  );
}
