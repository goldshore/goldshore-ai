-- Account Center state is owned by PLATFORM_DB. Provider token material remains
-- encrypted in the existing integration secrets store and is never stored here.
CREATE TABLE IF NOT EXISTS account_consents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('product_analytics','advertising','marketing')),
  granted INTEGER NOT NULL CHECK (granted IN (0,1)),
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  withdrawn_at TEXT,
  UNIQUE(user_id, purpose)
);

CREATE TABLE IF NOT EXISTS account_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('export','deletion')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_account_consents_user ON account_consents(user_id, purpose);
CREATE INDEX IF NOT EXISTS idx_account_requests_user ON account_requests(user_id, created_at DESC);
