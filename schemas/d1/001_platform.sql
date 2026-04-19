-- ============================================================
-- Gold Shore Labs — D1 Schema
-- gs_platform_db (9703574e-adb7-481e-8d98-96f8ce5f8a90)
-- Run: wrangler d1 execute gs_platform_db --file=schemas/d1/001_platform.sql --remote
-- ============================================================

-- ── LEAD SUBMISSIONS (contact forms → KV + D1) ──────────────
CREATE TABLE IF NOT EXISTS lead_submissions (
  id                      TEXT PRIMARY KEY,
  form_type               TEXT NOT NULL DEFAULT 'contact',
  name                    TEXT,
  email                   TEXT,
  company                 TEXT,
  role                    TEXT,
  website                 TEXT,
  team_size               TEXT,
  industry                TEXT,
  timeline                TEXT,
  budget                  TEXT,
  goals                   TEXT,
  message                 TEXT,
  status                  TEXT NOT NULL DEFAULT 'new'
                          CHECK (status IN ('new','read','archived','blocked','duplicate')),
  received_at             TEXT NOT NULL DEFAULT (datetime('now')),
  ip_address              TEXT,
  user_agent              TEXT,
  auto_responder_subject  TEXT,
  auto_responder_text     TEXT,
  auto_responder_html     TEXT
);

CREATE INDEX IF NOT EXISTS idx_lead_submissions_email       ON lead_submissions (email);
CREATE INDEX IF NOT EXISTS idx_lead_submissions_form_type   ON lead_submissions (form_type);
CREATE INDEX IF NOT EXISTS idx_lead_submissions_status      ON lead_submissions (status);
CREATE INDEX IF NOT EXISTS idx_lead_submissions_received_at ON lead_submissions (received_at DESC);

-- ── FORM CONFIGS (dynamic form definitions) ──────────────────
CREATE TABLE IF NOT EXISTS form_configs (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','disabled','archived')),
  fields      TEXT NOT NULL DEFAULT '[]',   -- JSON array of field definitions
  recipients  TEXT NOT NULL DEFAULT '[]',   -- JSON array of recipient objects
  integrations TEXT NOT NULL DEFAULT '[]',  -- JSON array of integration configs
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_form_configs_slug   ON form_configs (slug);
CREATE INDEX IF NOT EXISTS idx_form_configs_status ON form_configs (status);

-- ── FORM SUBMISSION LOGS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS form_submission_logs (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  submission_id TEXT NOT NULL,
  form_slug     TEXT NOT NULL,
  status        TEXT NOT NULL,
  message       TEXT,
  details       TEXT,  -- JSON
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_form_logs_submission_id ON form_submission_logs (submission_id);
CREATE INDEX IF NOT EXISTS idx_form_logs_form_slug     ON form_submission_logs (form_slug);
CREATE INDEX IF NOT EXISTS idx_form_logs_created_at    ON form_submission_logs (created_at DESC);

-- ── PLATFORM CONFIG (runtime key/value store) ────────────────
CREATE TABLE IF NOT EXISTS platform_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  value_type  TEXT NOT NULL DEFAULT 'string'
              CHECK (value_type IN ('string','number','boolean','json')),
  description TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by  TEXT
);

-- ── WORKER REGISTRY ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS worker_registry (
  script_name   TEXT PRIMARY KEY,
  display_name  TEXT,
  domain        TEXT,
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','inactive','deploying','error')),
  last_deploy   TEXT,
  health_url    TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed worker registry
INSERT OR IGNORE INTO worker_registry (script_name, display_name, domain, status, health_url) VALUES
  ('goldshore-gateway', 'Gateway',       'gw.goldshore.ai',    'active', 'https://gw.goldshore.ai/health'),
  ('goldshore-api',     'API',           'api.goldshore.ai',   'active', 'https://api.goldshore.ai/health'),
  ('goldshore-agent',   'Agent',         'agent.goldshore.ai', 'active', 'https://agent.goldshore.ai/health'),
  ('goldshore-admin',   'Admin',         'admin.goldshore.ai', 'active', NULL),
  ('goldshore-mail',    'Mail',          NULL,                 'active', NULL),
  ('banproof-me',       'Banproof',      'banproof.me',        'active', 'https://banproof.me/health'),
  ('rmarston-com',      'rmarston.com',  'rmarston.com',       'active', NULL),
  ('armsway',           'Armsway',       'armsway.com',        'active', NULL);

-- ── SENTIMENT SIGNALS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sentiment_signals (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  source      TEXT NOT NULL,  -- 'sports' | 'government' | 'opensource' | 'ai_network'
  entity      TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  score       REAL,
  metadata    TEXT,           -- JSON
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  ttl         TEXT            -- expiry hint
);

CREATE INDEX IF NOT EXISTS idx_signals_source      ON sentiment_signals (source);
CREATE INDEX IF NOT EXISTS idx_signals_entity      ON sentiment_signals (entity);
CREATE INDEX IF NOT EXISTS idx_signals_recorded_at ON sentiment_signals (recorded_at DESC);

-- ── MEDIA ASSETS (tracks R2 references) ─────────────────────
CREATE TABLE IF NOT EXISTS media_assets (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  r2_key      TEXT NOT NULL UNIQUE,         -- key in R2 bucket
  bucket      TEXT NOT NULL DEFAULT 'gs-assets',
  filename    TEXT,
  mime_type   TEXT,
  size_bytes  INTEGER,
  uploaded_by TEXT,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','archived','deleted')),
  metadata    TEXT,                          -- JSON
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_media_assets_r2_key     ON media_assets (r2_key);
CREATE INDEX IF NOT EXISTS idx_media_assets_bucket     ON media_assets (bucket);
CREATE INDEX IF NOT EXISTS idx_media_assets_uploaded_at ON media_assets (uploaded_at DESC);

-- ── CONTENT PROCESSING JOBS (Banproof Workflow) ──────────────
CREATE TABLE IF NOT EXISTS content_jobs (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workflow_id     TEXT,                    -- Cloudflare Workflow instance ID
  job_type        TEXT NOT NULL,           -- 'media_ingest' | 'ai_analysis' | 'sentiment_score'
  source_r2_key   TEXT,
  target_r2_key   TEXT,
  status          TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued','processing','complete','failed')),
  poa_record      TEXT,                    -- JSON — Proof of Agency chain
  result          TEXT,                    -- JSON
  error           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_content_jobs_status     ON content_jobs (status);
CREATE INDEX IF NOT EXISTS idx_content_jobs_workflow_id ON content_jobs (workflow_id);
CREATE INDEX IF NOT EXISTS idx_content_jobs_created_at ON content_jobs (created_at DESC);

-- Seed form configs
INSERT OR IGNORE INTO form_configs (slug, name, fields, recipients) VALUES
  ('contact', 'General Contact', '[{"name":"name","label":"Name","required":true},{"name":"email","label":"Email","type":"email","required":true},{"name":"inquiry","label":"Inquiry","required":true},{"name":"message","label":"Message","required":true}]', '[]'),
  ('org-contact', 'Org Contact', '[{"name":"name","required":true},{"name":"email","type":"email","required":true},{"name":"company"},{"name":"inquiry","required":true},{"name":"message","required":true}]', '[]'),
  ('armsway-inquiry', 'Armsway Inquiry', '[{"name":"name","required":true},{"name":"email","type":"email","required":true},{"name":"company"},{"name":"message","required":true}]', '[]');
