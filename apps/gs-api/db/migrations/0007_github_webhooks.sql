-- Durable receipt log for signed GitHub repository webhooks.
CREATE TABLE IF NOT EXISTS webhook_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  repository TEXT NOT NULL,
  payload TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('received', 'processed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_repository_timestamp
  ON webhook_logs(repository, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_timestamp
  ON webhook_logs(event_type, timestamp DESC);
