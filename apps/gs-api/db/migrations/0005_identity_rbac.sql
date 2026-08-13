-- Durable identity, authorization, approval, and audit state. KV is not a
-- source of truth for any of these records.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT, status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','invited','disabled','deprovisioned')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')), disabled_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS identities (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, provider_subject TEXT NOT NULL, email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), last_seen_at TEXT,
  UNIQUE(provider, provider_subject)
);
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY, resource TEXT NOT NULL, action TEXT NOT NULL, description TEXT,
  UNIQUE(resource, action)
);
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY(role_id, permission_id)
);
CREATE TABLE IF NOT EXISTS role_assignments (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  assigned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), revoked_at TEXT,
  UNIQUE(user_id, role_id)
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, assurance_level INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), expires_at TEXT NOT NULL,
  last_seen_at TEXT, revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY, email TEXT NOT NULL COLLATE NOCASE, role_id TEXT NOT NULL REFERENCES roles(id),
  token_hash TEXT NOT NULL UNIQUE, invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','expired','revoked')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), expires_at TEXT NOT NULL, accepted_at TEXT
);
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY, operation TEXT NOT NULL, resource_id TEXT, request_json TEXT NOT NULL,
  requested_by TEXT NOT NULL, approved_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','executed','rejected','expired')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), expires_at TEXT NOT NULL,
  approved_at TEXT, executed_at TEXT,
  CHECK(approved_by IS NULL OR approved_by <> requested_by)
);
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY, occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actor TEXT NOT NULL, action TEXT NOT NULL, status TEXT NOT NULL,
  target_type TEXT, target_id TEXT, request_id TEXT, metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_role_assignments_user ON role_assignments(user_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry ON sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_invitations_email_status ON invitations(email, status);
CREATE INDEX IF NOT EXISTS idx_approvals_status_expiry ON approvals(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_occurred_at ON audit_events(occurred_at DESC);

-- Audit records are append-only even for privileged D1 callers.
CREATE TRIGGER IF NOT EXISTS audit_events_no_update BEFORE UPDATE ON audit_events
BEGIN SELECT RAISE(ABORT, 'audit events are immutable'); END;
CREATE TRIGGER IF NOT EXISTS audit_events_no_delete BEFORE DELETE ON audit_events
BEGIN SELECT RAISE(ABORT, 'audit events are immutable'); END;

INSERT OR IGNORE INTO roles(id,name,description,is_system) VALUES
 ('role_owner','owner','Unrestricted owner; at least one active owner is required',1),
 ('role_admin','admin','Administrative operator',1),
 ('role_editor','editor','Content operator',1),
 ('role_viewer','viewer','Read-only operator',1);

INSERT OR IGNORE INTO permissions(id,resource,action) VALUES
 ('dashboard_read','dashboard','read'),
 ('cms_read','cms','read'),('cms_create','cms','create'),('cms_update','cms','update'),('cms_publish','cms','publish'),('cms_delete','cms','delete'),
 ('api_configuration_read','api_configuration','read'),('api_configuration_update','api_configuration','update'),
 ('mailboxes_read','mailboxes','read'),('mailboxes_create','mailboxes','create'),('mailboxes_update','mailboxes','update'),('mailboxes_delete','mailboxes','delete'),
 ('email_subscribers_read','email_subscribers','read'),('email_subscribers_create','email_subscribers','create'),('email_subscribers_update','email_subscribers','update'),('email_subscribers_delete','email_subscribers','delete'),
 ('forms_read','forms','read'),('forms_create','forms','create'),('forms_update','forms','update'),('forms_publish','forms','publish'),('forms_delete','forms','delete'),
 ('deployments_read','deployments','read'),('deployments_create','deployments','create'),('deployments_promote','deployments','promote'),
 ('rollbacks_read','rollbacks','read'),('rollbacks_create','rollbacks','create'),
 ('integrations_read','integrations','read'),('integrations_manage','integrations','manage'),
 ('google_business_profile_read','google_business_profile','read'),('google_business_profile_manage','google_business_profile','manage'),
 ('github_read','github','read'),('github_manage','github','manage'),
 ('cloudflare_inventory_read','cloudflare_inventory','read'),('cloudflare_inventory_manage','cloudflare_inventory','manage'),
 ('secret_metadata_read','secret_metadata','read'),('secret_metadata_rotate','secret_metadata','rotate'),
 ('users_read','users','read'),('users_create','users','create'),('users_invite','users','invite'),('users_update','users','update'),('users_disable','users','disable'),('users_delete','users','delete'),
 ('roles_read','roles','read'),('roles_manage','roles','manage'),
 ('approvals_read','approvals','read'),('approvals_create','approvals','create'),('approvals_approve','approvals','approve'),('approvals_execute','approvals','execute'),
 ('audit_read','audit','read');

-- The owner role is the bootstrap authority. Less privileged role grants are
-- intentionally managed by audited administration flows after migration.
INSERT OR IGNORE INTO role_permissions(role_id,permission_id)
SELECT 'role_owner', id FROM permissions;
