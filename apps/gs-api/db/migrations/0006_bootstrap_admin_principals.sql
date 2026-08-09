-- Bootstrap the two named administrators and align durable Access roles with
-- the application RBAC model. This migration is safe after 0005 migrations.
PRAGMA foreign_keys = OFF;

CREATE TABLE access_application_roles_v2 (
  user_id TEXT NOT NULL REFERENCES access_users(id) ON DELETE CASCADE,
  application TEXT NOT NULL CHECK(application IN ('admin-production','admin-preview','api-production','api-preview','service-production')),
  role TEXT NOT NULL CHECK(role IN ('owner','admin','editor','viewer')),
  PRIMARY KEY(user_id, application)
);

INSERT OR IGNORE INTO access_application_roles_v2(user_id, application, role)
SELECT user_id, application, role FROM access_application_roles;
DROP TABLE access_application_roles;
ALTER TABLE access_application_roles_v2 RENAME TO access_application_roles;

PRAGMA foreign_keys = ON;

INSERT INTO access_users(id,email,status) VALUES
  ('access-owner-marstonr6','marstonr6@gmail.com','active'),
  ('access-admin-goldshore','admin@goldshore.org','active')
ON CONFLICT(email) DO UPDATE SET status='active',updated_at=CURRENT_TIMESTAMP;

INSERT INTO access_application_roles(user_id,application,role)
SELECT u.id,a.application,
       CASE WHEN lower(u.email)='marstonr6@gmail.com' THEN 'owner' ELSE 'admin' END
FROM access_users u
CROSS JOIN (
  SELECT 'admin-production' application UNION ALL SELECT 'admin-preview'
  UNION ALL SELECT 'api-production' UNION ALL SELECT 'api-preview'
) a
WHERE lower(u.email) IN ('marstonr6@gmail.com','admin@goldshore.org')
ON CONFLICT(user_id,application) DO UPDATE SET role=excluded.role;

INSERT INTO users(id,email,display_name,status) VALUES
  ('user-owner-marstonr6','marstonr6@gmail.com','Robert Marston','active'),
  ('user-admin-goldshore','admin@goldshore.org','GoldShore Administrator','active')
ON CONFLICT(email) DO UPDATE SET status='active',deleted_at=NULL,disabled_at=NULL,updated_at=datetime('now');

INSERT INTO role_permissions(role_id,permission_id)
SELECT 'role_owner',id FROM permissions
WHERE 1=1
ON CONFLICT(role_id,permission_id) DO NOTHING;

INSERT INTO role_permissions(role_id,permission_id)
SELECT 'role_admin',id FROM permissions
WHERE NOT (
  (resource='users' AND action='delete') OR
  (resource='roles' AND action='manage') OR
  (resource='secret_metadata' AND action='rotate') OR
  (resource='deployments' AND action='promote') OR
  (resource='approvals' AND action='execute')
)
ON CONFLICT(role_id,permission_id) DO NOTHING;

INSERT INTO role_permissions(role_id,permission_id)
SELECT 'role_viewer',id FROM permissions WHERE action='read'
ON CONFLICT(role_id,permission_id) DO NOTHING;

INSERT INTO role_permissions(role_id,permission_id)
SELECT 'role_editor',id FROM permissions
WHERE action='read' OR
      (resource IN ('cms','forms','email_subscribers') AND action IN ('create','update','publish'))
ON CONFLICT(role_id,permission_id) DO NOTHING;

INSERT INTO role_assignments(id,user_id,role_id)
SELECT CASE WHEN lower(u.email)='marstonr6@gmail.com' THEN 'assignment-owner-marstonr6' ELSE 'assignment-admin-goldshore' END,
       u.id,
       CASE WHEN lower(u.email)='marstonr6@gmail.com' THEN 'role_owner' ELSE 'role_admin' END
FROM users u
WHERE lower(u.email) IN ('marstonr6@gmail.com','admin@goldshore.org')
ON CONFLICT(user_id,role_id) DO UPDATE SET revoked_at=NULL,created_at=datetime('now');

INSERT INTO audit_events(id,actor,action,status,target_type,target_id,metadata_json) VALUES
  ('bootstrap-admin-principals','migration:0006','admin.identity.bootstrap','success','identity','goldshore-admins','{"owner":"marstonr6@gmail.com","admin":"admin@goldshore.org"}')
ON CONFLICT(id) DO NOTHING;
