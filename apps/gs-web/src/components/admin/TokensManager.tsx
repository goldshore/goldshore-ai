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
    <div className="space-y-6">
      {error && (
        <div className="gs-card bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {generatedToken && (
        <div className="gs-card bg-green-50 border border-green-200 p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-green-900 mb-2">✅ Token Created Successfully</h3>
            <p className="text-sm text-green-800 mb-3">
              Save this token now. You won't be able to see it again.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-green-100 p-3 rounded font-mono text-sm">
            <code className="flex-1 truncate">{generatedToken}</code>
            <button
              onClick={() => copyToClipboard(generatedToken, 'new')}
              className="gs-btn gs-btn-primary text-xs px-3 py-1 whitespace-nowrap"
            >
              {copiedTokenId === 'new' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => setGeneratedToken(null)}
            className="gs-btn gs-btn-secondary text-sm px-4 py-2"
          >
            Done
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">API Tokens</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          disabled={loading}
          className="gs-btn gs-btn-primary text-sm px-4 py-2"
        >
          {showCreateForm ? 'Cancel' : '+ Generate Token'}
        </button>
      </div>

      {showCreateForm && (
        <div className="gs-card p-6 space-y-4">
          <h3 className="font-semibold">Generate New Token</h3>
          <form onSubmit={handleCreateToken} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Token Name</label>
              <input
                type="text"
                placeholder="e.g., CI/CD Pipeline, Mobile App, Webhook"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-[var(--gs-color-border)] rounded"
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
              <p className="text-xs text-gray-500 mt-1">Leave empty for no expiration</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={loading || !formData.name}
                className="gs-btn gs-btn-primary px-4 py-2 text-sm"
              >
                {loading ? 'Generating...' : 'Generate Token'}
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
              <th className="pb-2 px-4">Name</th>
              <th className="pb-2 px-4">Prefix</th>
              <th className="pb-2 px-4">Last Used</th>
              <th className="pb-2 px-4">Expires</th>
              <th className="pb-2 px-4">Status</th>
              <th className="pb-2 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tokens.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 px-4 text-center gs-text-subtle text-sm">
                  No API tokens yet
                </td>
              </tr>
            ) : (
              tokens.map((token) => (
                <tr key={token.id} className="border-b border-[var(--gs-color-border)]/50">
                  <td className="py-3 px-4 font-medium">{token.name}</td>
                  <td className="py-3 px-4 font-mono text-sm text-gray-500">{token.prefix}***</td>
                  <td className="py-3 px-4 text-sm gs-text-subtle">
                    {token.last_used_at
                      ? new Date(token.last_used_at).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="py-3 px-4 text-sm gs-text-subtle">
                    {token.expires_at
                      ? new Date(token.expires_at).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        token.status === 'active'
                          ? 'gs-pill gs-pill--success'
                          : 'gs-pill gs-pill--danger'
                      }`}
                    >
                      {token.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 space-x-2">
                    <button
                      onClick={() => handleRefreshToken(token.id)}
                      disabled={loading}
                      className="gs-btn gs-btn-secondary text-xs px-2 py-1"
                    >
                      Refresh
                    </button>
                    <button
                      onClick={() => handleRevokeToken(token.id)}
                      disabled={loading}
                      className="gs-btn gs-btn-danger text-xs px-2 py-1"
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

      <div className="gs-card bg-blue-50 border border-blue-200 p-4">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ API Token Tips</h3>
        <ul className="text-sm text-blue-800 space-y-1">
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
