import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface APIKey {
  id: string;
  name: string;
  key: string;
  prefix: string;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  isActive: boolean;
  permissions?: string[];
}

interface APIKeyRotatorProps {
  onRotate?: (oldKeyId: string, newKey: APIKey) => void;
  onRevoke?: (keyId: string) => void;
  keys?: APIKey[];
}

const APIKeyRotator: React.FC<APIKeyRotatorProps> = ({
  onRotate,
  onRevoke,
  keys = []
}) => {
  const [selectedKey, setSelectedKey] = useState<APIKey | null>(null);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [newKey, setNewKey] = useState<APIKey | null>(null);
  const [copied, setCopied] = useState(false);

  const handleRotate = async () => {
    if (!selectedKey) return;

    setIsProcessing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const generatedKey: APIKey = {
        id: `key_${Date.now()}`,
        name: selectedKey.name,
        key: generateAPIKey(),
        prefix: selectedKey.prefix,
        createdAt: new Date().toISOString(),
        isActive: true,
        permissions: selectedKey.permissions
      };

      setNewKey(generatedKey);
      onRotate?.(selectedKey.id, generatedKey);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRevoke = async () => {
    if (!selectedKey) return;

    setIsProcessing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      onRevoke?.(selectedKey.id);
      setSelectedKey(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <motion.div
      className="gs-api-rotator"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="gs-rotator-header">
        <h3>API Key Management</h3>
        <p>Rotate or revoke API keys to maintain security</p>
      </div>

      <div className="gs-rotator-content">
        {/* Keys List */}
        <div className="gs-keys-list">
          <h4 className="gs-list-title">Your API Keys</h4>

          {keys.length === 0 ? (
            <div className="gs-empty-state">
              <p>No API keys yet. Create one to get started.</p>
            </div>
          ) : (
            <motion.div className="gs-keys-table">
              {keys.map((key) => (
                <motion.div
                  key={key.id}
                  className={`gs-key-row ${selectedKey?.id === key.id ? 'selected' : ''} ${!key.isActive ? 'inactive' : ''}`}
                  onClick={() => setSelectedKey(key)}
                  whileHover={{ x: 4 }}
                >
                  <div className="gs-key-info">
                    <div className="gs-key-name">{key.name}</div>
                    <div className="gs-key-prefix">{key.prefix}****</div>
                  </div>
                  <div className="gs-key-meta">
                    <div className="gs-key-created">
                      <span className="gs-meta-label">Created</span>
                      <span className="gs-meta-value">{formatDate(key.createdAt)}</span>
                    </div>
                    <div className={`gs-key-status ${key.isActive ? 'active' : 'inactive'}`}>
                      {key.isActive ? '✓ Active' : '✗ Revoked'}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Details & Actions */}
        <AnimatePresence>
          {selectedKey && !newKey && (
            <motion.div
              className="gs-key-details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="gs-details-header">
                <h4>{selectedKey.name}</h4>
                <span className={`gs-status-badge ${selectedKey.isActive ? 'active' : 'inactive'}`}>
                  {selectedKey.isActive ? 'Active' : 'Revoked'}
                </span>
              </div>

              <div className="gs-detail-section">
                <div className="gs-detail-row">
                  <span className="gs-detail-label">Key ID:</span>
                  <code className="gs-detail-value">{selectedKey.id}</code>
                </div>
                <div className="gs-detail-row">
                  <span className="gs-detail-label">Created:</span>
                  <span className="gs-detail-value">{formatDate(selectedKey.createdAt)}</span>
                </div>
                {selectedKey.lastUsedAt && (
                  <div className="gs-detail-row">
                    <span className="gs-detail-label">Last Used:</span>
                    <span className="gs-detail-value">{formatDate(selectedKey.lastUsedAt)}</span>
                  </div>
                )}
                {selectedKey.permissions && (
                  <div className="gs-detail-row">
                    <span className="gs-detail-label">Permissions:</span>
                    <div className="gs-permissions">
                      {selectedKey.permissions.map(perm => (
                        <span key={perm} className="gs-permission-tag">{perm}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="gs-detail-actions">
                <motion.button
                  onClick={() => setShowRotateConfirm(true)}
                  disabled={!selectedKey.isActive}
                  className="gs-btn gs-btn-warning"
                  whileHover={{ scale: 1.05 }}
                >
                  🔄 Rotate Key
                </motion.button>
                <motion.button
                  onClick={() => setShowRevokeConfirm(true)}
                  className="gs-btn gs-btn-danger"
                  whileHover={{ scale: 1.05 }}
                >
                  ✕ Revoke Key
                </motion.button>
              </div>
            </motion.div>
          )}

          {newKey && (
            <motion.div
              className="gs-key-generated"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="gs-success-icon">✓</div>
              <h4>New API Key Generated</h4>
              <p>Your old key has been rotated. Copy your new key and store it securely.</p>

              <div className="gs-new-key-display">
                <div className="gs-key-copy-wrapper">
                  <code className="gs-new-key">{newKey.key}</code>
                  <button
                    onClick={handleCopyKey}
                    className="gs-btn gs-btn-sm gs-btn-secondary"
                  >
                    {copied ? '✓ Copied' : '📋 Copy'}
                  </button>
                </div>
              </div>

              <div className="gs-warning-box">
                <strong>⚠️ Important:</strong> You won't be able to see this key again. Store it securely now.
              </div>

              <button
                onClick={() => {
                  setNewKey(null);
                  setSelectedKey(null);
                  setShowRotateConfirm(false);
                }}
                className="gs-btn gs-btn-primary gs-btn-full"
              >
                Done
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Confirmation Dialogs */}
      <AnimatePresence>
        {showRotateConfirm && (
          <motion.div
            className="gs-confirm-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowRotateConfirm(false)}
          >
            <motion.div
              className="gs-confirm-dialog"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
            >
              <h4>Rotate API Key?</h4>
              <p>
                Your current API key will be deactivated and a new one will be generated.
                Update any applications using the old key immediately.
              </p>
              <div className="gs-dialog-actions">
                <button
                  onClick={() => setShowRotateConfirm(false)}
                  className="gs-btn gs-btn-outline"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleRotate();
                    setShowRotateConfirm(false);
                  }}
                  disabled={isProcessing}
                  className="gs-btn gs-btn-warning"
                >
                  {isProcessing ? 'Rotating...' : 'Confirm Rotation'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showRevokeConfirm && (
          <motion.div
            className="gs-confirm-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowRevokeConfirm(false)}
          >
            <motion.div
              className="gs-confirm-dialog"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
            >
              <h4>Revoke API Key?</h4>
              <p>
                This action cannot be undone. Any applications using this key will stop working immediately.
              </p>
              <div className="gs-dialog-actions">
                <button
                  onClick={() => setShowRevokeConfirm(false)}
                  className="gs-btn gs-btn-outline"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleRevoke();
                    setShowRevokeConfirm(false);
                  }}
                  disabled={isProcessing}
                  className="gs-btn gs-btn-danger"
                >
                  {isProcessing ? 'Revoking...' : 'Confirm Revocation'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

function generateAPIKey(): string {
  const prefix = 'sk_live_';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return prefix + key;
}

export default APIKeyRotator;
