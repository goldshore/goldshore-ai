-- Durable authorization is intentionally stricter than the Cloudflare Access
-- edge policy. Admission at Access does not grant an internal application role.
CREATE TABLE IF NOT EXISTS access_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS access_application_roles (
  user_id TEXT NOT NULL REFERENCES access_users(id) ON DELETE CASCADE,
  application TEXT NOT NULL CHECK (application IN ('admin-production', 'admin-preview', 'api-production', 'api-preview', 'service-production')),
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  PRIMARY KEY (user_id, application)
);

CREATE TABLE IF NOT EXISTS access_service_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  application TEXT NOT NULL CHECK (application = 'service-production'),
  role TEXT NOT NULL CHECK (role = 'service')
);

INSERT INTO access_service_roles (id, name, status, application, role) VALUES
  ('service-goldshore-production', 'goldshore-agents', 'active', 'service-production', 'service')
ON CONFLICT(id) DO UPDATE SET name = excluded.name, status = 'active', application = excluded.application, role = excluded.role;

INSERT INTO access_users (id, email, status) VALUES
  ('owner-marstonr6', 'marstonr6@gmail.com', 'active'),
  ('owner-admin-goldshore', 'admin@goldshore.org', 'active')
ON CONFLICT(email) DO UPDATE SET status = 'active', updated_at = CURRENT_TIMESTAMP;

INSERT INTO access_application_roles (user_id, application, role)
SELECT id, application, 'admin'
FROM access_users
CROSS JOIN (
  SELECT 'admin-production' AS application UNION ALL
  SELECT 'admin-preview' UNION ALL
  SELECT 'api-production' UNION ALL
  SELECT 'api-preview'
)
WHERE email IN ('marstonr6@gmail.com', 'admin@goldshore.org')
ON CONFLICT(user_id, application) DO UPDATE SET role = excluded.role;
