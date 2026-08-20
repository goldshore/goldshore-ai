CREATE TABLE IF NOT EXISTS ad_accounts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK(provider IN ('google_ads','meta_ads')),
  external_account_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  credential_secret_id TEXT,
  status TEXT NOT NULL DEFAULT 'setup_required' CHECK(status IN ('setup_required','ready','disabled','error')),
  read_only INTEGER NOT NULL DEFAULT 1 CHECK(read_only = 1),
  last_sync_at TEXT,
  last_error TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider, external_account_id)
);

CREATE TABLE IF NOT EXISTS ad_campaign_snapshots (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES ad_accounts(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions REAL NOT NULL DEFAULT 0,
  cost_micros INTEGER NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0,
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_ad_accounts_updated ON ad_accounts(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_account_cost ON ad_campaign_snapshots(account_id, cost_micros DESC);
