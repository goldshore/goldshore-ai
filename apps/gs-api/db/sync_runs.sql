CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subdomain TEXT NOT NULL,
  actor TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  result TEXT NOT NULL CHECK (result IN ('success', 'error')),
  drift_summary TEXT
);

CREATE INDEX IF NOT EXISTS sync_runs_subdomain_started_idx ON sync_runs(subdomain, started_at DESC);
CREATE INDEX IF NOT EXISTS sync_runs_result_completed_idx ON sync_runs(result, completed_at DESC);
