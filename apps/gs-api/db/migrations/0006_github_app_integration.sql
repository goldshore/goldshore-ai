-- GitHub App Integration Tables
-- Purpose: Track webhook events, OAuth sessions, deployment status, and GitHub sync

-- Webhook event log
CREATE TABLE IF NOT EXISTS webhook_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  repository TEXT NOT NULL,
  payload TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'received',
  error_message TEXT,
  processed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_repository ON webhook_logs(repository);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_timestamp ON webhook_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);

-- OAuth sessions (supplementary to KV)
CREATE TABLE IF NOT EXISTS oauth_sessions (
  session_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  user_login TEXT NOT NULL,
  user_email TEXT,
  provider TEXT DEFAULT 'github',
  access_token_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_oauth_sessions_user_id ON oauth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires_at ON oauth_sessions(expires_at);

-- Deployment tracking
CREATE TABLE IF NOT EXISTS deployment_status (
  id TEXT PRIMARY KEY,
  branch TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  status TEXT NOT NULL, -- pending, running, success, failure, cancelled
  environment TEXT DEFAULT 'prod', -- prod, preview
  workflow_run_id INTEGER,
  workflow_name TEXT,
  github_url TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  duration_ms INTEGER,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deployment_status_branch ON deployment_status(branch);
CREATE INDEX IF NOT EXISTS idx_deployment_status_environment ON deployment_status(environment);
CREATE INDEX IF NOT EXISTS idx_deployment_status_status ON deployment_status(status);
CREATE INDEX IF NOT EXISTS idx_deployment_status_created_at ON deployment_status(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployment_status_workflow_run_id ON deployment_status(workflow_run_id);

-- GitHub issue sync (for audit findings)
CREATE TABLE IF NOT EXISTS github_issues (
  issue_id INTEGER PRIMARY KEY,
  repository TEXT NOT NULL,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  labels TEXT, -- JSON array of label names
  status TEXT NOT NULL, -- open, closed
  severity TEXT, -- critical, high, medium, low (from label)
  github_url TEXT NOT NULL,
  author_login TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_github_issues_repository ON github_issues(repository);
CREATE INDEX IF NOT EXISTS idx_github_issues_status ON github_issues(status);
CREATE INDEX IF NOT EXISTS idx_github_issues_severity ON github_issues(severity);
CREATE INDEX IF NOT EXISTS idx_github_issues_synced_at ON github_issues(synced_at DESC);

-- GitHub PR sync (for review tracking)
CREATE TABLE IF NOT EXISTS github_pull_requests (
  pr_id INTEGER PRIMARY KEY,
  repository TEXT NOT NULL,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL, -- open, closed, merged
  labels TEXT, -- JSON array of label names
  base_branch TEXT NOT NULL,
  head_branch TEXT NOT NULL,
  github_url TEXT NOT NULL,
  author_login TEXT NOT NULL,
  reviewers TEXT, -- JSON array of reviewer logins
  approved_by TEXT, -- JSON array of approvers
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  merged_at DATETIME,
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_github_pull_requests_repository ON github_pull_requests(repository);
CREATE INDEX IF NOT EXISTS idx_github_pull_requests_status ON github_pull_requests(status);
CREATE INDEX IF NOT EXISTS idx_github_pull_requests_base_branch ON github_pull_requests(base_branch);
CREATE INDEX IF NOT EXISTS idx_github_pull_requests_synced_at ON github_pull_requests(synced_at DESC);

-- GitHub App permissions audit trail
CREATE TABLE IF NOT EXISTS github_app_audit (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL, -- installed, uninstalled, scopes_updated, webhook_triggered
  repository TEXT NOT NULL,
  permissions TEXT, -- JSON object of current permissions
  triggered_by TEXT,
  details TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_github_app_audit_action ON github_app_audit(action);
CREATE INDEX IF NOT EXISTS idx_github_app_audit_repository ON github_app_audit(repository);
CREATE INDEX IF NOT EXISTS idx_github_app_audit_timestamp ON github_app_audit(timestamp DESC);
