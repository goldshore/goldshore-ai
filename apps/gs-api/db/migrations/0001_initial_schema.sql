-- Migration: 0001_initial_schema
-- Applies the core content schema to the goldshore D1 database.
-- Run: wrangler d1 migrations apply goldshore --env prod

-- ---- media -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media (
  id          TEXT PRIMARY KEY,
  site_id     TEXT NOT NULL,
  filename    TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL DEFAULT 0,
  r2_key      TEXT NOT NULL,
  alt_text    TEXT,
  caption     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_media_site_id ON media (site_id);

-- ---- pages -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pages (
  id          TEXT PRIMARY KEY,
  site_id     TEXT NOT NULL,
  slug        TEXT NOT NULL,
  title       TEXT NOT NULL,
  content     TEXT,
  meta_json   TEXT,
  status      TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pages_site_slug ON pages (site_id, slug);
CREATE INDEX IF NOT EXISTS idx_pages_status ON pages (status);

-- ---- sync_runs -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_runs (
  id          TEXT PRIMARY KEY,
  service     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  summary     TEXT,
  error       TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_service ON sync_runs (service);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status  ON sync_runs (status);
