CREATE TABLE IF NOT EXISTS admin_tokens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at DATETIME,
  last_used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_admin_tokens_status ON admin_tokens(status);
CREATE INDEX IF NOT EXISTS idx_admin_tokens_expires_at ON admin_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_tokens_created_at ON admin_tokens(created_at DESC);
