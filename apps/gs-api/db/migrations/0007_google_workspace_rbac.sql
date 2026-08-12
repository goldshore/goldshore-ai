-- Google Workspace is an authorization source, not a second identity store.
-- These tables record sync history and ownership of grants applied to the
-- canonical users/identities and access_application_roles tables.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS google_workspace_sync_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  users_seen INTEGER NOT NULL DEFAULT 0,
  users_granted INTEGER NOT NULL DEFAULT 0,
  users_deprovisioned INTEGER NOT NULL DEFAULT 0,
  conflicts INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_google_workspace_single_running_sync
  ON google_workspace_sync_runs(status)
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS idx_google_workspace_sync_started
  ON google_workspace_sync_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS google_workspace_users (
  google_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  access_user_id TEXT NOT NULL,
  primary_email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  group_emails_json TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  managed_access_user INTEGER NOT NULL DEFAULT 0 CHECK (managed_access_user IN (0, 1)),
  last_seen_at TEXT NOT NULL,
  deprovisioned_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_google_workspace_users_active
  ON google_workspace_users(active, primary_email);

CREATE TABLE IF NOT EXISTS google_workspace_access_grants (
  access_user_id TEXT NOT NULL,
  application TEXT NOT NULL CHECK (application IN ('admin-production', 'admin-preview', 'api-production', 'api-preview')),
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (access_user_id, application)
);
