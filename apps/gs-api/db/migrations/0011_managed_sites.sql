CREATE TABLE IF NOT EXISTS managed_sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  framework TEXT NOT NULL CHECK (framework IN ('astro', 'static', 'wordpress-import')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'archived')),
  repository TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_managed_sites_status_created ON managed_sites(status, created_at DESC);

CREATE TABLE IF NOT EXISTS managed_site_pages (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES managed_sites(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  body_html TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_managed_site_pages_site ON managed_site_pages(site_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS managed_site_plugins (
  site_id TEXT NOT NULL REFERENCES managed_sites(id) ON DELETE CASCADE,
  plugin_id TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  installed_by TEXT NOT NULL,
  installed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(site_id, plugin_id)
);

CREATE TABLE IF NOT EXISTS managed_site_builds (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES managed_sites(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('planned', 'cancelled')),
  plan_json TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_managed_site_builds_site ON managed_site_builds(site_id, created_at DESC);
