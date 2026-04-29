CREATE TABLE IF NOT EXISTS form_configs (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  fields TEXT NOT NULL,
  recipients TEXT NOT NULL,
  integrations TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS form_configs_slug_idx
  ON form_configs (slug);

CREATE TABLE IF NOT EXISTS form_submission_logs (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  form_slug TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS form_submission_logs_form_slug_idx
  ON form_submission_logs (form_slug);

CREATE INDEX IF NOT EXISTS form_submission_logs_created_at_idx
  ON form_submission_logs (created_at);
