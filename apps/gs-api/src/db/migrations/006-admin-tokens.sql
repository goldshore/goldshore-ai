CREATE TABLE IF NOT EXISTS admin_tokens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  service TEXT NOT NULL,
  token_type TEXT NOT NULL,
  masked_value TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  last_used DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_tokens_service ON admin_tokens(service);
CREATE INDEX IF NOT EXISTS idx_admin_tokens_is_active ON admin_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_tokens_created_at ON admin_tokens(created_at DESC);
