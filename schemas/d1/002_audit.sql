-- ============================================================
-- Gold Shore Labs — Audit D1 Schema
-- gs_audit_db (1ae71d76-188f-481b-91d9-db2d39013f68)
-- Run: wrangler d1 execute gs_audit_db --file=schemas/d1/002_audit.sql --remote
-- ============================================================

-- ── AGENT AUDIT (gs-deploy-agent operations) ─────────────────
CREATE TABLE IF NOT EXISTS agent_audit (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          TEXT NOT NULL,
  action      TEXT NOT NULL,
  repo        TEXT,
  branch      TEXT,
  script_name TEXT,
  result      TEXT NOT NULL CHECK (result IN ('ok','error')),
  detail      TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_ts     ON agent_audit (ts DESC);
CREATE INDEX IF NOT EXISTS idx_agent_audit_action ON agent_audit (action);
CREATE INDEX IF NOT EXISTS idx_agent_audit_repo   ON agent_audit (repo);

-- ── WORKER AUDIT (all worker operations) ─────────────────────
CREATE TABLE IF NOT EXISTS worker_audit (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  ts          TEXT NOT NULL DEFAULT (datetime('now')),
  worker      TEXT NOT NULL,
  action      TEXT NOT NULL,
  actor       TEXT,           -- CF-Access-User-Email or system
  cf_ray      TEXT,
  trace_id    TEXT,
  result      TEXT NOT NULL CHECK (result IN ('ok','error','blocked')),
  status_code INTEGER,
  detail      TEXT,           -- JSON or text
  ip_address  TEXT
);

CREATE INDEX IF NOT EXISTS idx_worker_audit_ts     ON worker_audit (ts DESC);
CREATE INDEX IF NOT EXISTS idx_worker_audit_worker ON worker_audit (worker);
CREATE INDEX IF NOT EXISTS idx_worker_audit_actor  ON worker_audit (actor);
CREATE INDEX IF NOT EXISTS idx_worker_audit_action ON worker_audit (action);

-- ── INTEGRATION AUDIT (gateway integration controls) ─────────
CREATE TABLE IF NOT EXISTS integration_audit (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  trace_id            TEXT NOT NULL UNIQUE,
  classification      TEXT NOT NULL,
  secrets_policy      TEXT NOT NULL,
  method              TEXT NOT NULL,
  path                TEXT NOT NULL,
  actor               TEXT,
  cf_ray              TEXT,
  ts                  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at          TEXT  -- 30-day TTL hint
);

CREATE INDEX IF NOT EXISTS idx_integration_audit_trace_id ON integration_audit (trace_id);
CREATE INDEX IF NOT EXISTS idx_integration_audit_ts       ON integration_audit (ts DESC);
CREATE INDEX IF NOT EXISTS idx_integration_audit_actor    ON integration_audit (actor);

-- ── SECURITY EVENTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS security_events (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  ts          TEXT NOT NULL DEFAULT (datetime('now')),
  event_type  TEXT NOT NULL,  -- 'auth_failure' | 'rate_limit' | 'spam_blocked' | 'csrf' | 'xss_attempt'
  worker      TEXT,
  path        TEXT,
  ip_address  TEXT,
  user_agent  TEXT,
  detail      TEXT
);

CREATE INDEX IF NOT EXISTS idx_security_events_ts         ON security_events (ts DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events (event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_ip         ON security_events (ip_address);

-- ── EMAIL DELIVERY LOG ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_delivery_log (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  submission_id   TEXT,
  form_type       TEXT,
  to_email        TEXT,
  from_email      TEXT,
  subject         TEXT,
  email_type      TEXT NOT NULL CHECK (email_type IN ('notification','auto_responder')),
  attempted       INTEGER NOT NULL DEFAULT 0,
  success         INTEGER NOT NULL DEFAULT 0,
  provider_status INTEGER,
  provider_body   TEXT,
  sent_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_log_submission_id ON email_delivery_log (submission_id);
CREATE INDEX IF NOT EXISTS idx_email_log_sent_at       ON email_delivery_log (sent_at DESC);
