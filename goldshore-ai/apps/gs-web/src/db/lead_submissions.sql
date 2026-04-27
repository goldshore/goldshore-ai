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

CREATE INDEX IF NOT EXISTS lead_submissions_form_type_idx
  ON lead_submissions (form_type);

CREATE INDEX IF NOT EXISTS lead_submissions_received_at_idx
  ON lead_submissions (received_at);

CREATE INDEX IF NOT EXISTS lead_submissions_status_idx
  ON lead_submissions (status);
