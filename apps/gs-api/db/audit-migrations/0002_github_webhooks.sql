-- Apply this migration to the AUDIT_DB binding / gs_audit_db, not PLATFORM_DB.
CREATE TABLE IF NOT EXISTS github_webhooks (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_github_webhooks_event
  ON github_webhooks (event_type DESC, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_github_webhooks_timestamp
  ON github_webhooks (timestamp DESC);
