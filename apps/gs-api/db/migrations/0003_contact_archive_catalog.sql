-- Metadata only. Raw imports and legacy files belong in private R2, never D1.
CREATE TABLE IF NOT EXISTS archive_captures (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('hostgator', 'google_drive', 'manual')),
  source_locator TEXT NOT NULL,
  brand TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  manifest_r2_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'captured' CHECK (status IN ('captured', 'scanned', 'reviewed', 'promoted', 'rejected')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS archive_assets (
  id TEXT PRIMARY KEY,
  capture_id TEXT NOT NULL REFERENCES archive_captures(id),
  sha256 TEXT NOT NULL,
  byte_length INTEGER NOT NULL CHECK (byte_length >= 0),
  media_type TEXT,
  original_name TEXT NOT NULL,
  raw_r2_key TEXT NOT NULL UNIQUE,
  curated_r2_key TEXT UNIQUE,
  review_state TEXT NOT NULL DEFAULT 'pending' CHECK (review_state IN ('pending', 'approved', 'rejected', 'quarantined')),
  rights_state TEXT NOT NULL DEFAULT 'unknown' CHECK (rights_state IN ('unknown', 'owned', 'licensed', 'restricted')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (capture_id, sha256)
);

CREATE INDEX IF NOT EXISTS archive_assets_sha256_idx ON archive_assets(sha256);
CREATE INDEX IF NOT EXISTS archive_assets_brand_review_idx ON archive_captures(brand, status);

CREATE TABLE IF NOT EXISTS contact_sources (
  id TEXT PRIMARY KEY,
  brand TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_locator TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  raw_r2_key TEXT,
  sha256 TEXT NOT NULL,
  consent_basis TEXT NOT NULL DEFAULT 'unknown',
  review_state TEXT NOT NULL DEFAULT 'pending' CHECK (review_state IN ('pending', 'approved', 'rejected')),
  imported_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  normalized_email TEXT NOT NULL UNIQUE,
  email_hash TEXT NOT NULL UNIQUE,
  display_name_ciphertext TEXT,
  status TEXT NOT NULL DEFAULT 'quarantined' CHECK (status IN ('quarantined', 'active', 'suppressed', 'invalid')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact_list_memberships (
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  source_id TEXT NOT NULL REFERENCES contact_sources(id),
  list_name TEXT NOT NULL,
  consent_state TEXT NOT NULL DEFAULT 'unknown' CHECK (consent_state IN ('unknown', 'explicit', 'transactional', 'withdrawn')),
  consent_recorded_at TEXT,
  PRIMARY KEY (contact_id, source_id, list_name)
);

CREATE TABLE IF NOT EXISTS contact_suppressions (
  email_hash TEXT PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'global',
  reason TEXT NOT NULL,
  source_id TEXT REFERENCES contact_sources(id),
  suppressed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact_import_audit (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES contact_sources(id),
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  counts_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

