-- Object-first search and human-gated social drafting.
CREATE TABLE IF NOT EXISTS gs_objects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','verified','published','archived')),
  provenance_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gs_object_sources (
  id TEXT PRIMARY KEY,
  object_id TEXT NOT NULL REFERENCES gs_objects(id) ON DELETE CASCADE,
  uri TEXT NOT NULL,
  content_hash TEXT,
  excerpt TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gs_object_sources_object ON gs_object_sources(object_id);

CREATE TABLE IF NOT EXISTS social_accounts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('instagram','facebook')),
  display_name TEXT NOT NULL,
  external_account_id TEXT,
  scopes_json TEXT NOT NULL DEFAULT '[]',
  token_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','connected','revoked','error')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS social_drafts (
  id TEXT PRIMARY KEY,
  object_id TEXT REFERENCES gs_objects(id) ON DELETE SET NULL,
  account_id TEXT NOT NULL REFERENCES social_accounts(id),
  body TEXT NOT NULL,
  media_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','rejected','published','failed')),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_by TEXT,
  approved_by TEXT,
  approved_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_social_drafts_status ON social_drafts(status, created_at DESC);

CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  requested_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT
);
