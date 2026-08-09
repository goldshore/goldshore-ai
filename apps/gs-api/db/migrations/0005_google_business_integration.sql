-- Google provider credentials are encrypted by the Worker before entering D1.
CREATE TABLE IF NOT EXISTS google_oauth_credentials (
  connection_id TEXT PRIMARY KEY,
  encrypted_tokens TEXT NOT NULL,
  granted_scopes TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revoked_at TEXT
);
