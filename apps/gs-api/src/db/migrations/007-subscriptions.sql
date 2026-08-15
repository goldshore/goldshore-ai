-- Subscription system: tiers, usage tracking, verification methods, and analytics

-- Main subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK(tier IN ('free', 'starter', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'cancelled', 'expired', 'suspended')),
  start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  end_date DATETIME,
  renewal_date DATETIME,
  billing_cycle TEXT DEFAULT 'monthly' CHECK(billing_cycle IN ('monthly', 'annual')),
  stripe_subscription_id TEXT,
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON subscriptions(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- Monthly usage tracking for rate limiting and analytics
CREATE TABLE IF NOT EXISTS subscription_usage (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  month TEXT NOT NULL, -- YYYY-MM format
  api_calls_used INTEGER DEFAULT 0,
  storage_used_gb REAL DEFAULT 0,
  projects_created INTEGER DEFAULT 0,
  users_invited INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
  UNIQUE(subscription_id, month)
);

CREATE INDEX IF NOT EXISTS idx_subscription_usage_month ON subscription_usage(month);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_subscription_id ON subscription_usage(subscription_id);

-- User verification methods: email, phone, OAuth providers
CREATE TABLE IF NOT EXISTS verification_methods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('email', 'phone', 'google_oauth', 'github_oauth')),
  value TEXT NOT NULL, -- email or phone number
  verified BOOLEAN DEFAULT 0,
  verification_code TEXT,
  verification_code_expiry DATETIME,
  verified_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, type, value)
);

CREATE INDEX IF NOT EXISTS idx_verification_methods_user_id ON verification_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_methods_type ON verification_methods(type);
CREATE INDEX IF NOT EXISTS idx_verification_methods_verified ON verification_methods(verified);
CREATE INDEX IF NOT EXISTS idx_verification_methods_code_expiry ON verification_methods(verification_code_expiry);

-- Subscription lifecycle and feature usage events for analytics
CREATE TABLE IF NOT EXISTS subscription_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subscription_id TEXT,
  event_type TEXT NOT NULL CHECK(event_type IN (
    'tier_upgrade', 'tier_downgrade', 'subscription_created', 'subscription_cancelled',
    'subscription_renewed', 'payment_failed', 'feature_accessed', 'limit_exceeded'
  )),
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_subscription_id ON subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at ON subscription_events(created_at DESC);

-- Tier feature access and usage limits cache
CREATE TABLE IF NOT EXISTS tier_feature_access (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'allowed' CHECK(access_level IN ('allowed', 'limit_reached', 'upgrade_required')),
  usage_count INTEGER DEFAULT 0,
  last_reset DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
  UNIQUE(subscription_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_tier_feature_access_subscription_id ON tier_feature_access(subscription_id);
CREATE INDEX IF NOT EXISTS idx_tier_feature_access_feature_key ON tier_feature_access(feature_key);
