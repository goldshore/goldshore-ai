-- Admin cache and secrets table
-- Cache: temporary storage for health reports, API responses
-- Secrets: encrypted integration credentials (stripe, meta, openai, etc)

-- Cache table for repo health, API responses, etc
CREATE TABLE IF NOT EXISTS admin_cache (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL, -- 'health', 'api_response', 'report'
  data TEXT NOT NULL, -- JSON
  ttl_seconds INTEGER DEFAULT 300,
  cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_cache_entity_type ON admin_cache(entity_type);
CREATE INDEX IF NOT EXISTS idx_admin_cache_cached_at ON admin_cache(cached_at DESC);

-- Secrets table for integration credentials
CREATE TABLE IF NOT EXISTS admin_secrets (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL, -- STRIPE_SECRET_KEY, META_ACCESS_TOKEN, etc
  integration TEXT NOT NULL, -- 'stripe', 'meta', 'openai', 'google', 'cloudflare'
  encrypted_value TEXT NOT NULL, -- AES-256-GCM encrypted secret
  type TEXT DEFAULT 'api_key', -- 'api_key', 'access_token', 'connection_string', 'webhook_secret'
  is_active BOOLEAN DEFAULT 1,
  last_rotated DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_secrets_integration ON admin_secrets(integration);
CREATE INDEX IF NOT EXISTS idx_admin_secrets_is_active ON admin_secrets(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_secrets_created_at ON admin_secrets(created_at DESC);
