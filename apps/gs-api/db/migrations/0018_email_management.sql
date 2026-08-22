-- ============================================================
-- Email Management Schema (Phase 1: Email Management Feature)
-- Supports: templates, logs, queue, tracking
-- ============================================================

-- Email templates for campaign and transactional emails
CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  html_body TEXT,
  plain_text_body TEXT,
  category TEXT NOT NULL CHECK(category IN ('transactional', 'marketing', 'notification', 'campaign')),
  variables TEXT NOT NULL DEFAULT '[]',  -- JSON array of variable names
  metadata TEXT DEFAULT '{}',  -- JSON object for tags, description, etc.
  is_active BOOLEAN DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_active ON email_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_email_templates_created_by ON email_templates(created_by);

-- Email sending queue for background job processing
CREATE TABLE IF NOT EXISTS email_queue (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  to_email TEXT NOT NULL,
  to_name TEXT,
  variables TEXT DEFAULT '{}',  -- JSON object with template variable values
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'sent', 'failed', 'bounced', 'spam')),
  priority INTEGER DEFAULT 0,  -- Higher numbers = higher priority
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  scheduled_for TEXT,  -- ISO 8601 timestamp for scheduled sends
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  next_retry_at TEXT,
  FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_to_email ON email_queue(to_email);
CREATE INDEX IF NOT EXISTS idx_email_queue_template_id ON email_queue(template_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_created_at ON email_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled_for ON email_queue(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_queue_next_retry_at ON email_queue(next_retry_at) WHERE next_retry_at IS NOT NULL;

-- Email delivery logs for auditing and analytics
CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  queue_id TEXT,
  to_email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('sent', 'bounced', 'complained', 'suppressed', 'failed')),
  delivery_status TEXT CHECK(delivery_status IN ('delivered', 'undeliverable', 'delayed', 'unknown')) DEFAULT 'unknown',
  error_code TEXT,
  error_message TEXT,
  provider TEXT CHECK(provider IN ('sendgrid', 'resend', 'mailgun', 'ses', 'internal')) DEFAULT 'resend',
  provider_message_id TEXT,
  provider_response TEXT,  -- JSON response from email provider
  opened_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  last_opened_at TEXT,
  last_clicked_at TEXT,
  metadata TEXT DEFAULT '{}',  -- JSON object for additional tracking data
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at TEXT,
  FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE SET NULL,
  FOREIGN KEY (queue_id) REFERENCES email_queue(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_to_email ON email_logs(to_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_template_id ON email_logs(template_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_delivered_at ON email_logs(delivered_at DESC) WHERE delivered_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_logs_provider ON email_logs(provider);

-- Email suppression list for bounces, complaints, and unsubscribes
CREATE TABLE IF NOT EXISTS email_suppressions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  reason TEXT NOT NULL CHECK(reason IN ('bounce', 'complaint', 'unsubscribe', 'manual')),
  suppression_type TEXT NOT NULL CHECK(suppression_type IN ('hard_bounce', 'soft_bounce', 'spam_complaint', 'unsubscribe_request')),
  bounce_type TEXT CHECK(bounce_type IN ('permanent', 'transient')),
  bounce_subtype TEXT CHECK(bounce_subtype IN ('general', 'mailbox_does_not_exist', 'message_too_large', 'content_rejected', 'undefined', 'temporary_failure')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT  -- NULL = permanent suppression
);

CREATE INDEX IF NOT EXISTS idx_email_suppressions_email ON email_suppressions(email);
CREATE INDEX IF NOT EXISTS idx_email_suppressions_reason ON email_suppressions(reason);
CREATE INDEX IF NOT EXISTS idx_email_suppressions_expires_at ON email_suppressions(expires_at) WHERE expires_at IS NOT NULL;

-- Email analytics and campaign tracking
CREATE TABLE IF NOT EXISTS email_analytics (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  date TEXT NOT NULL,  -- YYYY-MM-DD format for daily aggregation
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_complained INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_suppressed INTEGER DEFAULT 0,
  open_rate REAL DEFAULT 0.0,
  click_rate REAL DEFAULT 0.0,
  bounce_rate REAL DEFAULT 0.0,
  complaint_rate REAL DEFAULT 0.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE CASCADE,
  UNIQUE(template_id, date)
);

CREATE INDEX IF NOT EXISTS idx_email_analytics_template_id ON email_analytics(template_id);
CREATE INDEX IF NOT EXISTS idx_email_analytics_date ON email_analytics(date DESC);
