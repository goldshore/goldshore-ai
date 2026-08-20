-- Admin Platform Schema
-- Includes email, entries (contact forms), users, settings, and audit logging

-- Email management table
CREATE TABLE IF NOT EXISTS admin_emails (
  id TEXT PRIMARY KEY,
  type TEXT DEFAULT 'log', -- 'log' or 'template'
  queue_id TEXT,
  recipient TEXT,
  subject TEXT,
  template TEXT, -- Email template or HTML content
  status TEXT DEFAULT 'queued', -- 'queued', 'sent', 'failed', 'template'
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_emails_status ON admin_emails(status);
CREATE INDEX IF NOT EXISTS idx_admin_emails_created_at ON admin_emails(created_at DESC);

-- Contact form submissions
CREATE TABLE IF NOT EXISTS admin_contact_submissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  source TEXT, -- 'website', 'email', 'manual', etc.
  status TEXT DEFAULT 'new', -- 'new', 'responded', 'resolved', 'spam'
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_contacts_status ON admin_contact_submissions(status);
CREATE INDEX IF NOT EXISTS idx_admin_contacts_created_at ON admin_contact_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_contacts_email ON admin_contact_submissions(email);

-- Lead submissions
CREATE TABLE IF NOT EXISTS admin_leads (
  id TEXT PRIMARY KEY,
  source TEXT, -- 'website', 'ads', 'referral', 'manual', etc.
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  metadata TEXT, -- JSON: { utm_campaign, interests, notes, etc. }
  status TEXT DEFAULT 'new', -- 'new', 'contacted', 'qualified', 'converted', 'lost'
  assigned_to TEXT, -- Email of assigned team member
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_leads_status ON admin_leads(status);
CREATE INDEX IF NOT EXISTS idx_admin_leads_created_at ON admin_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_leads_source ON admin_leads(source);

-- Admin users (team members with dashboard access)
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'viewer', -- 'admin', 'moderator', 'viewer'
  permissions TEXT, -- JSON array of permission strings
  status TEXT DEFAULT 'invited', -- 'invited', 'active', 'inactive', 'removed'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  invited_at DATETIME,
  accepted_at DATETIME,
  last_login DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- Global settings (key-value store)
CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  type TEXT DEFAULT 'string', -- 'string', 'json', 'number', 'boolean'
  description TEXT,
  updated_by TEXT, -- Email of user who updated
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit log for all admin actions
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'resend', etc.
  resource TEXT NOT NULL, -- 'email', 'contact', 'lead', 'user', 'setting', etc.
  resource_id TEXT, -- ID of the affected resource
  changes TEXT, -- JSON of before/after values
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_user_email ON admin_audit_log(user_email);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON admin_audit_log(created_at DESC);
