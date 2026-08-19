-- Promote the two bootstrap operators to the durable owner role. The original
-- access_application_roles constraint predated the canonical owner role and
-- only accepted admin/editor/viewer, so rebuild the table before updating it.
PRAGMA defer_foreign_keys = true;

CREATE TABLE access_application_roles_v2 (
  user_id TEXT NOT NULL REFERENCES access_users(id) ON DELETE CASCADE,
  application TEXT NOT NULL CHECK (application IN ('admin-production', 'admin-preview', 'api-production', 'api-preview', 'service-production')),
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  PRIMARY KEY (user_id, application)
);

INSERT INTO access_application_roles_v2 (user_id, application, role)
SELECT
  ar.user_id,
  ar.application,
  CASE
    WHEN lower(u.email) IN ('marstonr6@gmail.com', 'admin@goldshore.org') THEN 'owner'
    ELSE ar.role
  END
FROM access_application_roles ar
JOIN access_users u ON u.id = ar.user_id;

DROP TABLE access_application_roles;
ALTER TABLE access_application_roles_v2 RENAME TO access_application_roles;

INSERT INTO access_users (id, email, status) VALUES
  ('owner-marstonr6', 'marstonr6@gmail.com', 'active'),
  ('owner-admin-goldshore', 'admin@goldshore.org', 'active')
ON CONFLICT(email) DO UPDATE SET status = 'active', updated_at = CURRENT_TIMESTAMP;

INSERT INTO access_application_roles (user_id, application, role)
SELECT id, application, 'owner'
FROM access_users
CROSS JOIN (
  SELECT 'admin-production' AS application UNION ALL
  SELECT 'admin-preview' UNION ALL
  SELECT 'api-production' UNION ALL
  SELECT 'api-preview'
)
WHERE lower(email) IN ('marstonr6@gmail.com', 'admin@goldshore.org')
ON CONFLICT(user_id, application) DO UPDATE SET role = excluded.role;

INSERT INTO users (id, email, display_name, status) VALUES
  ('owner-marstonr6', 'marstonr6@gmail.com', 'Robert Marston', 'active'),
  ('owner-admin-goldshore', 'admin@goldshore.org', 'Gold Shore Admin', 'active')
ON CONFLICT(email) DO UPDATE SET
  status = 'active',
  deleted_at = NULL,
  disabled_at = NULL,
  updated_at = datetime('now');

INSERT INTO role_assignments (id, user_id, role_id, assigned_by)
SELECT
  'assignment-' || u.id || '-owner',
  u.id,
  'role_owner',
  u.id
FROM users u
WHERE lower(u.email) IN ('marstonr6@gmail.com', 'admin@goldshore.org')
ON CONFLICT(user_id, role_id) DO UPDATE SET
  revoked_at = NULL,
  assigned_by = excluded.assigned_by;
