-- gs-web D1 migration: contact form tables
-- Run: wrangler d1 execute gs_platform_db --file=migrations/0001_contact_forms.sql --remote

CREATE TABLE IF NOT EXISTS lead_submissions (
  id TEXT PRIMARY KEY,
  form_type TEXT NOT NULL,
  name TEXT,
  email TEXT,
  company TEXT,
  role TEXT,
  website TEXT,
  team_size TEXT,
  industry TEXT,
  timeline TEXT,
  budget TEXT,
  goals TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  received_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  auto_responder_subject TEXT NOT NULL,
  auto_responder_text TEXT NOT NULL,
  auto_responder_html TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS lead_submissions_form_type_idx ON lead_submissions (form_type);
CREATE INDEX IF NOT EXISTS lead_submissions_received_at_idx ON lead_submissions (received_at);
CREATE INDEX IF NOT EXISTS lead_submissions_status_idx ON lead_submissions (status);

CREATE TABLE IF NOT EXISTS form_configs (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  fields TEXT NOT NULL DEFAULT '[]',
  recipients TEXT NOT NULL DEFAULT '[]',
  integrations TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS form_configs_slug_idx ON form_configs (slug);

CREATE TABLE IF NOT EXISTS form_submission_logs (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  form_slug TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS form_submission_logs_form_slug_idx ON form_submission_logs (form_slug);
CREATE INDEX IF NOT EXISTS form_submission_logs_created_at_idx ON form_submission_logs (created_at);

-- Seed a default "contact" form config so the form works without additional setup
INSERT OR IGNORE INTO form_configs (id, slug, name, status, fields, recipients, integrations, created_at, updated_at)
VALUES (
  'default-contact',
  'contact',
  'Contact Form',
  'active',
  '[]',
  '[]',
  '[]',
  datetime('now'),
  datetime('now')
);
