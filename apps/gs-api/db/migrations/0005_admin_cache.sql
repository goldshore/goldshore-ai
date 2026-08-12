-- Migration: 0005_admin_cache
-- Creates admin dashboard cache table for repo health, governance, and project data
-- Run: wrangler d1 migrations apply PLATFORM_DB --env prod

-- ---- admin_cache -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_cache (
  id              TEXT PRIMARY KEY,
  entity_type     TEXT NOT NULL,        -- 'health', 'governance', 'projects', 'mcp_access', 'findings'
  entity_id       TEXT,                 -- optional: issue_id, pr_id, etc.
  data            TEXT NOT NULL,        -- JSON blob
  last_updated    TEXT NOT NULL DEFAULT (datetime('now')),
  ttl_seconds     INTEGER DEFAULT 300,  -- 5 min for health, 30 min for issues, 3600 for governance
  cached_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_cache_type ON admin_cache (entity_type);
CREATE INDEX IF NOT EXISTS idx_admin_cache_entity ON admin_cache (entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_cache_updated ON admin_cache (last_updated);

-- ---- audit_findings -------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_findings (
  id              TEXT PRIMARY KEY,
  issue_id        INTEGER NOT NULL,
  title           TEXT NOT NULL,
  severity        TEXT NOT NULL,       -- 'critical', 'high', 'medium', 'low'
  status          TEXT NOT NULL,       -- 'open', 'in_progress', 'resolved'
  github_url      TEXT NOT NULL,
  labels          TEXT,                -- JSON array of label strings
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_findings_severity ON audit_findings (severity);
CREATE INDEX IF NOT EXISTS idx_findings_status ON audit_findings (status);
CREATE INDEX IF NOT EXISTS idx_findings_synced ON audit_findings (synced_at);
