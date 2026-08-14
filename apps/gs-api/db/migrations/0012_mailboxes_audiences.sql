CREATE TABLE IF NOT EXISTS email_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT 'goldshore',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand, name)
);
INSERT OR IGNORE INTO email_lists(id,name,brand,description,status,created_by)
  VALUES('newsletter','newsletter','goldshore','Primary GoldShore newsletter','active','migration');

CREATE TABLE IF NOT EXISTS managed_mailboxes (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  forward_to TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  routing_verified INTEGER NOT NULL DEFAULT 0 CHECK (routing_verified IN (0,1)),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_managed_mailboxes_status ON managed_mailboxes(status, updated_at DESC);
