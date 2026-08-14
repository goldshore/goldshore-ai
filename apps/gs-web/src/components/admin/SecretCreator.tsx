import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface Secret {
  id?: string;
  name: string;
  value: string;
  category: 'api_key' | 'password' | 'token' | 'connection_string' | 'other';
  isVisible: boolean;
  lastUpdated?: string;
  expiresAt?: string;
}

interface SecretCreatorProps {
  onSave?: (secret: Secret) => void;
  onCancel?: () => void;
  existingSecret?: Secret;
}

const SecretCreator: React.FC<SecretCreatorProps> = ({
  onSave,
  onCancel,
  existingSecret
}) => {
  const [secret, setSecret] = useState<Secret>(existingSecret || {
    name: '',
    value: '',
    category: 'api_key',
    isVisible: false
  });
  const [showValue, setShowValue] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleGenerateSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let generated = '';
    for (let i = 0; i < 32; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSecret(prev => ({ ...prev, value: generated }));
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret.value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!secret.name || !secret.value) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      onSave?.(secret);
    } finally {
      setIsSaving(false);
    }
  };

  const strengthScore = calculateSecretStrength(secret.value);
  const strengthColor = strengthScore < 3 ? 'red' : strengthScore < 6 ? 'yellow' : 'green';

  return (
    <motion.div
      className="gs-secret-creator"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="gs-secret-header">
        <h3>{existingSecret ? 'Edit Secret' : 'Create New Secret'}</h3>
        <p className="gs-secret-description">
          Securely create and manage API keys, passwords, and other secrets.
        </p>
      </div>

      <div className="gs-form-group">
        <label className="gs-form-label">
          Secret Name
          <span className="gs-required">*</span>
        </label>
        <input
          type="text"
          placeholder="e.g., STRIPE_API_KEY"
          value={secret.name}
          onChange={(e) => setSecret(prev => ({ ...prev, name: e.target.value }))}
          className="gs-form-input"
          disabled={!!existingSecret}
        />
        <p className="gs-input-hint">Use UPPERCASE_WITH_UNDERSCORES format</p>
      </div>

      <div className="gs-form-group">
        <label className="gs-form-label">Category</label>
        <select
          value={secret.category}
          onChange={(e) => setSecret(prev => ({ ...prev, category: e.target.value as Secret['category'] }))}
          className="gs-form-select"
        >
          <option value="api_key">API Key</option>
          <option value="password">Password</option>
          <option value="token">Token</option>
          <option value="connection_string">Connection String</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="gs-form-group">
        <label className="gs-form-label">
          Secret Value
          <span className="gs-required">*</span>
        </label>
        <div className="gs-secret-input-wrapper">
          <input
            type={showValue ? 'text' : 'password'}
            value={secret.value}
            onChange={(e) => setSecret(prev => ({ ...prev, value: e.target.value }))}
            className="gs-form-input gs-secret-input"
            placeholder="Paste your secret or generate a new one"
          />
          <button
            onClick={() => setShowValue(!showValue)}
            className="gs-secret-toggle"
            title={showValue ? 'Hide' : 'Show'}
          >
            {showValue ? '👁️' : '🔒'}
          </button>
        </div>

        <div className="gs-secret-strength">
          <div className="gs-strength-label">
            Strength: <span className={`gs-strength-${strengthColor}`}>{getStrengthLabel(strengthScore)}</span>
          </div>
          <div className="gs-strength-bar">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className={`gs-strength-segment ${i < strengthScore ? `gs-strength-${strengthColor}` : ''}`}
              />
            ))}
          </div>
        </div>

        <div className="gs-secret-buttons">
          <button
            onClick={handleGenerateSecret}
            className="gs-btn gs-btn-secondary gs-btn-sm"
          >
            🎲 Generate Random
          </button>
          <button
            onClick={handleCopySecret}
            className="gs-btn gs-btn-secondary gs-btn-sm"
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
        </div>
      </div>

      {secret.expiresAt && (
        <div className="gs-form-group">
          <label className="gs-form-label">Expires At</label>
          <input
            type="datetime-local"
            value={secret.expiresAt}
            onChange={(e) => setSecret(prev => ({ ...prev, expiresAt: e.target.value }))}
            className="gs-form-input"
          />
          <p className="gs-input-hint">Optional: Set an expiration date for this secret</p>
        </div>
      )}

      <div className="gs-secret-notice">
        <p>
          <strong>⚠️ Security Notice:</strong> This secret will be encrypted at rest. Never share this secret with unauthorized users. Store it securely.
        </p>
      </div>

      <div className="gs-form-actions">
        {onCancel && (
          <button
            onClick={onCancel}
            className="gs-btn gs-btn-outline"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={isSaving || !secret.name || !secret.value}
          className="gs-btn gs-btn-primary"
        >
          {isSaving ? 'Saving...' : existingSecret ? 'Update Secret' : 'Create Secret'}
        </button>
      </div>
    </motion.div>
  );
};

function calculateSecretStrength(value: string): number {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 16) score += 1;
  if (/[a-z]/.test(value)) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[!@#$%^&*]/.test(value)) score += 1;
  if (/[^a-zA-Z0-9!@#$%^&*]/.test(value)) score += 1;
  return Math.min(score, 8);
}

function getStrengthLabel(score: number): string {
  if (score < 2) return 'Weak';
  if (score < 5) return 'Fair';
  if (score < 7) return 'Good';
  return 'Very Strong';
}

export default SecretCreator;
