-- ============================================================
-- Admin RBAC Schema (Phase 2: Permission Updater)
-- Supports: role management, user access control, audit logging
-- ============================================================

-- ── ROLES & PERMISSIONS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions TEXT NOT NULL,  -- JSON array of permission IDs
  is_default BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_roles_name ON admin_roles(name);

CREATE TABLE IF NOT EXISTS admin_permissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK(category IN ('dashboard', 'workers', 'email', 'users', 'secrets', 'audit')),
  description TEXT,
  scope TEXT CHECK(scope IN ('read', 'create', 'update', 'delete', 'execute', 'manage')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_permissions_category ON admin_permissions(category);
CREATE INDEX IF NOT EXISTS idx_admin_permissions_name ON admin_permissions(name);

-- ── USERS & ACCESS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active', 'suspended', 'revoked')) DEFAULT 'active',
  last_login TEXT,
  last_ip TEXT,
  invited_at TEXT,
  invited_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (role_id) REFERENCES admin_roles(id)
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role_id ON admin_users(role_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_status ON admin_users(status);
CREATE INDEX IF NOT EXISTS idx_admin_users_created ON admin_users(created_at DESC);

-- ── AUDIT LOG ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN (
    'created_role',
    'updated_role',
    'deleted_role',
    'created_permission',
    'deleted_permission',
    'assigned_role',
    'revoked_role',
    'suspended_user',
    'restored_user',
    'deleted_user',
    'updated_user'
  )),
  target_type TEXT NOT NULL CHECK(target_type IN ('role', 'user', 'permission')),
  target_id TEXT NOT NULL,
  target_name TEXT,
  changes TEXT,  -- JSON object with before/after state
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT CHECK(status IN ('success', 'failure')) DEFAULT 'success',
  error_message TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor ON admin_audit_log(actor_email);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_timestamp ON admin_audit_log(timestamp DESC);

-- ── PERMISSION DEFAULTS ────────────────────────────────────
INSERT INTO admin_permissions (id, name, category, description, scope)
VALUES
  -- Dashboard permissions
  ('perm_dashboard_view', 'dashboard:view', 'dashboard', 'View main admin dashboard', 'read'),
  ('perm_dashboard_export', 'dashboard:export', 'dashboard', 'Export dashboard data', 'read'),

  -- Worker management permissions
  ('perm_workers_view', 'workers:view', 'workers', 'View worker configuration', 'read'),
  ('perm_workers_update', 'workers:update', 'workers', 'Update worker routes/bindings', 'update'),
  ('perm_workers_deploy', 'workers:deploy', 'workers', 'Deploy workers to production', 'execute'),
  ('perm_workers_rollback', 'workers:rollback', 'workers', 'Rollback worker deployments', 'execute'),

  -- Email management permissions
  ('perm_email_view', 'email:view', 'email', 'View email logs and templates', 'read'),
  ('perm_email_create', 'email:create', 'email', 'Create email templates', 'create'),
  ('perm_email_update', 'email:update', 'email', 'Update email templates', 'update'),
  ('perm_email_send', 'email:send', 'email', 'Send emails to users', 'execute'),
  ('perm_email_delete', 'email:delete', 'email', 'Delete email templates', 'delete'),

  -- User management permissions
  ('perm_users_view', 'users:view', 'users', 'View admin users and roles', 'read'),
  ('perm_users_create', 'users:create', 'users', 'Create new admin users', 'create'),
  ('perm_users_update', 'users:update', 'users', 'Update admin user roles', 'update'),
  ('perm_users_suspend', 'users:suspend', 'users', 'Suspend admin users', 'manage'),
  ('perm_users_restore', 'users:restore', 'users', 'Restore suspended admin users', 'manage'),
  ('perm_users_delete', 'users:delete', 'users', 'Delete admin users permanently', 'delete'),

  -- Secret management permissions
  ('perm_secrets_view', 'secrets:view', 'secrets', 'View secret metadata (not values)', 'read'),
  ('perm_secrets_create', 'secrets:create', 'secrets', 'Create new secrets', 'create'),
  ('perm_secrets_update', 'secrets:update', 'secrets', 'Update secret values', 'update'),
  ('perm_secrets_rotate', 'secrets:rotate', 'secrets', 'Rotate API keys and tokens', 'manage'),
  ('perm_secrets_delete', 'secrets:delete', 'secrets', 'Delete secrets permanently', 'delete'),

  -- Audit log permissions
  ('perm_audit_view', 'audit:view', 'audit', 'View audit logs', 'read'),
  ('perm_audit_export', 'audit:export', 'audit', 'Export audit logs to CSV/JSON', 'read'),
  ('perm_audit_search', 'audit:search', 'audit', 'Search audit logs by filters', 'read'),

  -- Admin role management
  ('perm_roles_view', 'roles:view', 'users', 'View role definitions', 'read'),
  ('perm_roles_create', 'roles:create', 'users', 'Create new roles', 'create'),
  ('perm_roles_update', 'roles:update', 'users', 'Update role permissions', 'update'),
  ('perm_roles_delete', 'roles:delete', 'users', 'Delete roles', 'delete')
ON CONFLICT DO NOTHING;

-- ── ROLE DEFAULTS ────────────────────────────────────────
INSERT INTO admin_roles (id, name, description, permissions, is_default)
VALUES
  (
    'role_superadmin',
    'superadmin',
    'Full access to all features and settings',
    '["perm_dashboard_view","perm_dashboard_export","perm_workers_view","perm_workers_update","perm_workers_deploy","perm_workers_rollback","perm_email_view","perm_email_create","perm_email_update","perm_email_send","perm_email_delete","perm_users_view","perm_users_create","perm_users_update","perm_users_suspend","perm_users_restore","perm_users_delete","perm_secrets_view","perm_secrets_create","perm_secrets_update","perm_secrets_rotate","perm_secrets_delete","perm_audit_view","perm_audit_export","perm_audit_search","perm_roles_view","perm_roles_create","perm_roles_update","perm_roles_delete"]',
    TRUE
  ),
  (
    'role_admin',
    'admin',
    'Most features except secrets and role management',
    '["perm_dashboard_view","perm_dashboard_export","perm_workers_view","perm_workers_update","perm_workers_deploy","perm_email_view","perm_email_create","perm_email_update","perm_email_send","perm_users_view","perm_users_create","perm_users_update","perm_users_suspend","perm_users_restore","perm_audit_view","perm_audit_export","perm_audit_search"]',
    TRUE
  ),
  (
    'role_operator',
    'operator',
    'Limited create/update access; view-only for sensitive operations',
    '["perm_dashboard_view","perm_workers_view","perm_email_view","perm_email_create","perm_email_update","perm_email_send","perm_users_view","perm_audit_view","perm_audit_search"]',
    TRUE
  ),
  (
    'role_viewer',
    'viewer',
    'Read-only access to dashboard and logs',
    '["perm_dashboard_view","perm_workers_view","perm_email_view","perm_users_view","perm_audit_view","perm_audit_search"]',
    TRUE
  ),
  (
    'role_auditor',
    'auditor',
    'Access to audit logs only for compliance verification',
    '["perm_audit_view","perm_audit_export","perm_audit_search"]',
    TRUE
  )
ON CONFLICT DO NOTHING;

-- ── INTEGRITY CHECKS ────────────────────────────────────────
-- Ensure all foreign keys are valid
PRAGMA foreign_keys = ON;

-- Verify no orphaned user records reference non-existent roles
-- (would be caught by constraint, but good for safety)
