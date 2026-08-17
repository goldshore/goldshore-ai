-- ============================================================
-- Analytics & Monetization Tables (Phase 2-3)
-- Supports: real-time events, aggregations, revenue tracking
-- ============================================================

-- ── REAL-TIME DATA FEEDS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS market_data_feeds (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  price_cents INTEGER,
  volume INTEGER,
  timestamp DATETIME NOT NULL,
  source TEXT
);

CREATE INDEX IF NOT EXISTS idx_market_data_feeds_symbol ON market_data_feeds(symbol);
CREATE INDEX IF NOT EXISTS idx_market_data_feeds_timestamp ON market_data_feeds(timestamp DESC);

CREATE TABLE IF NOT EXISTS social_sentiment (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  mentions INTEGER,
  sentiment_score REAL,
  source TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_social_sentiment_topic ON social_sentiment(topic);
CREATE INDEX IF NOT EXISTS idx_social_sentiment_created ON social_sentiment(created_at DESC);

CREATE TABLE IF NOT EXISTS news_ingestion (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT UNIQUE,
  category TEXT,
  published_at DATETIME,
  ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_news_ingestion_category ON news_ingestion(category);
CREATE INDEX IF NOT EXISTS idx_news_ingestion_published ON news_ingestion(published_at DESC);

CREATE TABLE IF NOT EXISTS risk_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,
  flagged_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_risk_events_severity ON risk_events(severity);
CREATE INDEX IF NOT EXISTS idx_risk_events_flagged ON risk_events(flagged_at DESC);

-- ── ANALYTICS AGGREGATIONS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  user_id TEXT,
  event_type TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  action TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_org ON analytics_events(org_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC);

CREATE TABLE IF NOT EXISTS analytics_hourly (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  hour DATETIME NOT NULL,
  count INTEGER,
  unique_users INTEGER
);

CREATE INDEX IF NOT EXISTS idx_analytics_hourly_type ON analytics_hourly(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_hourly_hour ON analytics_hourly(hour DESC);

CREATE TABLE IF NOT EXISTS analytics_daily (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  day DATE NOT NULL,
  count INTEGER,
  unique_users INTEGER
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_type ON analytics_daily(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_day ON analytics_daily(day DESC);

CREATE TABLE IF NOT EXISTS analytics_monthly (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  month TEXT NOT NULL,
  count INTEGER,
  unique_users INTEGER
);

CREATE INDEX IF NOT EXISTS idx_analytics_monthly_type ON analytics_monthly(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_monthly_month ON analytics_monthly(month DESC);

-- ── SEO & SEARCH METRICS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_metrics (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  keyword TEXT,
  ranking_position INTEGER,
  volume INTEGER,
  difficulty INTEGER,
  traffic_potential REAL,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seo_metrics_domain ON seo_metrics(domain);
CREATE INDEX IF NOT EXISTS idx_seo_metrics_keyword ON seo_metrics(keyword);
CREATE INDEX IF NOT EXISTS idx_seo_metrics_ranking ON seo_metrics(ranking_position);

CREATE TABLE IF NOT EXISTS seo_products (
  id TEXT PRIMARY KEY,
  product_name TEXT NOT NULL,
  description TEXT,
  keywords TEXT,
  monthly_searches INTEGER,
  cpc_cents INTEGER,
  market_size TEXT,
  opportunity_score REAL
);

CREATE INDEX IF NOT EXISTS idx_seo_products_name ON seo_products(product_name);
CREATE INDEX IF NOT EXISTS idx_seo_products_score ON seo_products(opportunity_score DESC);

-- ── OPPORTUNITIES & ASSETS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'closed', 'archived')),
  value_cents INTEGER,
  probability_percent REAL,
  target_close_date DATE,
  assigned_to TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_opportunities_org ON opportunities(org_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_assigned ON opportunities(assigned_to);

-- ── MONETIZATION: SUBSCRIPTION TIERS ──────────────────────────
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  price_cents INTEGER NOT NULL,
  billing_period TEXT DEFAULT 'monthly' CHECK(billing_period IN ('monthly', 'annual', 'lifetime')),
  features TEXT,
  limits TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscription_tiers_name ON subscription_tiers(name);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tier_id TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'cancelled', 'pending')),
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  renews_at DATETIME,
  cancelled_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tier_id) REFERENCES subscription_tiers(id)
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tier ON user_subscriptions(tier_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_renews ON user_subscriptions(renews_at);

-- ── REVENUE TRACKING (Generic Ledger) ──────────────────────────
CREATE TABLE IF NOT EXISTS revenue_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  customer_id TEXT,
  user_id TEXT,
  asset_id TEXT,
  product_id TEXT,
  channel TEXT CHECK(channel IN ('direct', 'affiliate', 'reseller', 'advertising', 'api', 'marketplace')),
  revenue_type TEXT NOT NULL CHECK(revenue_type IN ('subscription', 'per_api_call', 'per_event', 'per_export', 'per_user', 'per_organization', 'per_seat', 'per_gb', 'per_compute_unit', 'per_report', 'per_lead', 'per_project', 'flat_fee', 'retainer', 'commission', 'affiliate', 'revenue_share', 'license', 'royalty', 'advertising')),
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT CHECK(status IN ('pending', 'charged', 'refunded', 'credited', 'disputed')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(org_id) REFERENCES organizations(id),
  FOREIGN KEY(user_id) REFERENCES admin_users(id)
);

CREATE INDEX IF NOT EXISTS idx_revenue_events_org ON revenue_events(org_id);
CREATE INDEX IF NOT EXISTS idx_revenue_events_type ON revenue_events(revenue_type);
CREATE INDEX IF NOT EXISTS idx_revenue_events_channel ON revenue_events(channel);
CREATE INDEX IF NOT EXISTS idx_revenue_events_created ON revenue_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_events_status ON revenue_events(status);

CREATE TABLE IF NOT EXISTS reseller_partners (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  partner_org_id TEXT NOT NULL,
  revenue_share_percent REAL,
  tier TEXT CHECK(tier IN ('silver', 'gold', 'platinum')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reseller_partners_org ON reseller_partners(org_id);
CREATE INDEX IF NOT EXISTS idx_reseller_partners_status ON reseller_partners(status);

-- ══════════════════════════════════════════════════════════════
-- Migration complete: Analytics, revenue, and monetization tables
-- ══════════════════════════════════════════════════════════════
