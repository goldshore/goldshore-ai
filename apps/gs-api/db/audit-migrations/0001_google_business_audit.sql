-- Apply this migration to the AUDIT_DB binding / gs_audit_db, not PLATFORM_DB.
CREATE TABLE IF NOT EXISTS google_business_audit (
  id TEXT PRIMARY KEY,
  occurred_at TEXT NOT NULL,
  actor TEXT NOT NULL,
  target_account_id TEXT,
  target_location_id TEXT,
  operation TEXT NOT NULL,
  google_request_id TEXT,
  result TEXT NOT NULL,
  http_status INTEGER,
  detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_google_business_audit_occurred
  ON google_business_audit (occurred_at DESC);
