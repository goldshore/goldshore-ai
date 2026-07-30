CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_hash TEXT NOT NULL UNIQUE,
  name TEXT,
  brand TEXT NOT NULL DEFAULT 'goldshore',
  list_name TEXT NOT NULL DEFAULT 'newsletter',
  source TEXT NOT NULL DEFAULT 'website',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'unsubscribed', 'suppressed', 'invalid')),
  consent_basis TEXT NOT NULL DEFAULT 'double_opt_in',
  confirmation_token_hash TEXT,
  manage_token_hash TEXT NOT NULL UNIQUE,
  subscribed_at TEXT NOT NULL,
  confirmed_at TEXT,
  unsubscribed_at TEXT,
  last_response_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS newsletter_subscribers_status_idx
  ON newsletter_subscribers(status, updated_at);
CREATE INDEX IF NOT EXISTS newsletter_subscribers_brand_list_idx
  ON newsletter_subscribers(brand, list_name, status);

