-- Migration: 0002_integration_secrets
-- Secure encrypted storage for third-party API keys, separate from integration config
-- This table stores secrets with encryption at rest using AES-256-GCM

CREATE TABLE IF NOT EXISTS integration_secrets (
  id TEXT PRIMARY KEY,
  integration_id TEXT NOT NULL,
  key_type TEXT NOT NULL CHECK (key_type IN ('apiKey', 'apiSecret', 'webhook_secret', 'oauth_token')),
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  rotated_at TEXT,
  expires_at TEXT,
  created_by TEXT,
  rotation_count INTEGER DEFAULT 0,
  metadata_json TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_secrets_integration_key_type
  ON integration_secrets(integration_id, key_type);
CREATE INDEX IF NOT EXISTS idx_integration_secrets_key_prefix
  ON integration_secrets(key_prefix);
CREATE INDEX IF NOT EXISTS idx_integration_secrets_created_by
  ON integration_secrets(created_by);
CREATE INDEX IF NOT EXISTS idx_integration_secrets_expires_at
  ON integration_secrets(expires_at);

-- Add columns to integrations table to track secret status
ALTER TABLE integrations ADD COLUMN secrets_status TEXT DEFAULT 'pending' CHECK (secrets_status IN ('pending', 'configured', 'expired', 'revoked'));
ALTER TABLE integrations ADD COLUMN last_secret_sync TEXT;

-- D1/SQLite does not support Postgres RLS or column-level grants.
-- Secrets are protected by API permission checks and metadata-only list/read helpers.
