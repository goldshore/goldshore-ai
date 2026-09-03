ALTER TABLE newsletter_subscribers ADD COLUMN verification_code_hash TEXT;
ALTER TABLE newsletter_subscribers ADD COLUMN verification_code_expires_at TEXT;
ALTER TABLE newsletter_subscribers ADD COLUMN preferences_json TEXT NOT NULL DEFAULT '{}';
