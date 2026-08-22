CREATE TABLE IF NOT EXISTS sql_sync_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('hostgator-mysql', 'mysql')),
  database_name TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('staging', 'production')),
  binding_name TEXT NOT NULL DEFAULT 'HOSTGATOR_DB',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'setup_required' CHECK (status IN ('setup_required', 'ready', 'disabled')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sql_sync_plans (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES sql_sync_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sql_text TEXT NOT NULL,
  checksum TEXT NOT NULL,
  analysis_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'executing', 'completed', 'failed', 'cancelled')),
  requested_by TEXT NOT NULL,
  approved_by TEXT,
  approved_at TEXT,
  executed_at TEXT,
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sql_sync_plans_profile ON sql_sync_plans(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sql_sync_plans_status ON sql_sync_plans(status, updated_at DESC);
