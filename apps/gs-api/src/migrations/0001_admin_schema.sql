-- Admin Dashboard Schema
-- Created for Phase 1: Enterprise Admin Platform Build-Out

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  status TEXT NOT NULL DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  invited_at DATETIME,
  last_login DATETIME
);

-- Contact form entries / leads
CREATE TABLE IF NOT EXISTS admin_entries (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  message TEXT,
  source TEXT,
  status TEXT DEFAULT 'new',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Email queue and logs
CREATE TABLE IF NOT EXISTS admin_emails (
  id TEXT PRIMARY KEY,
  type TEXT DEFAULT 'email',
  name TEXT,
  email_to TEXT,
  email_from TEXT DEFAULT 'noreply@goldshore.ai',
  subject TEXT,
  template TEXT,
  status TEXT DEFAULT 'queued',
  attempts INTEGER DEFAULT 0,
  error_code TEXT,
  message_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME,
  retry_at DATETIME
);

-- Email templates
CREATE TABLE IF NOT EXISTS admin_email_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  template TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Platform settings
CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  type TEXT DEFAULT 'string',
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API secrets and keys
CREATE TABLE IF NOT EXISTS admin_secrets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  type TEXT DEFAULT 'api_key',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  last_used_at DATETIME,
  rotation_required BOOLEAN DEFAULT 0
);

-- Audit logs for admin actions
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  user_email TEXT,
  action TEXT,
  resource_type TEXT,
  resource_id TEXT,
  changes TEXT,
  status TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_status ON admin_users(status);
CREATE INDEX IF NOT EXISTS idx_admin_entries_created ON admin_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_entries_status ON admin_entries(status);
CREATE INDEX IF NOT EXISTS idx_admin_emails_status ON admin_emails(status);
CREATE INDEX IF NOT EXISTS idx_admin_emails_email_to ON admin_emails(email_to);
CREATE INDEX IF NOT EXISTS idx_admin_emails_created ON admin_emails(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_email_templates_name ON admin_email_templates(name);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_user ON admin_audit_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at);
