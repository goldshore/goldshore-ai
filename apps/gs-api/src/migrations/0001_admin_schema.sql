-- Goldshore Platform DB Schema Migration
-- Date: 2026-08-16
-- Purpose: Complete D1 schema for multi-tier processing, monetization, and governance
-- Phases: 1-4 support without breaking changes

-- ==============================================================================
-- TIER 0: CORE INFRASTRUCTURE (Multi-tenancy, Organization)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'internal' CHECK(type IN ('internal', 'partner', 'reseller', 'customer')),
  description TEXT,
  domain TEXT UNIQUE,
  api_base_url TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
  created_by_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_organizations_type ON organizations(type);
CREATE INDEX idx_organizations_status ON organizations(status);
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- ==============================================================================
-- TIER 0: RBAC (Role-Based Access Control)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS admin_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_roles_name ON admin_roles(name);

CREATE TABLE IF NOT EXISTS admin_permissions (
  id TEXT PRIMARY KEY,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(resource, action)
);

CREATE INDEX idx_admin_permissions_resource ON admin_permissions(resource);

CREATE TABLE IF NOT EXISTS admin_role_permissions (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(role_id) REFERENCES admin_roles(id) ON DELETE CASCADE,
  FOREIGN KEY(permission_id) REFERENCES admin_permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role ON admin_role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON admin_role_permissions(permission_id);

-- ==============================================================================
-- TIER 0: USERS & ACTORS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role_id TEXT NOT NULL,
  org_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended', 'invited')),
  mfa_enabled BOOLEAN DEFAULT 0,
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  invited_at DATETIME,
  invited_by_id TEXT,
  FOREIGN KEY(role_id) REFERENCES admin_roles(id),
  FOREIGN KEY(org_id) REFERENCES organizations(id),
  FOREIGN KEY(invited_by_id) REFERENCES admin_users(id)
);

CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_role ON admin_users(role_id);
CREATE INDEX idx_admin_users_org ON admin_users(org_id);
CREATE INDEX idx_admin_users_status ON admin_users(status);
CREATE INDEX idx_admin_users_created ON admin_users(created_at DESC);

CREATE TABLE IF NOT EXISTS contractors (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('developer', 'designer', 'marketer', 'sales', 'consultant', 'ai_agent')),
  org_id TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'archived')),
  work_assignment TEXT,
  hourly_rate REAL,
  contract_type TEXT CHECK(contract_type IN ('hourly', 'project', 'retainer', 'equity', 'ai_automated')),
  hired_at DATETIME,
  expires_at DATETIME,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(org_id) REFERENCES organizations(id)
);

CREATE INDEX idx_contractors_org ON contractors(org_id);
CREATE INDEX idx_contractors_status ON contractors(status);
CREATE INDEX idx_contractors_expires ON contractors(expires_at) WHERE status = 'active';
CREATE INDEX idx_contractors_email ON contractors(email);

-- ==============================================================================
-- PHASE 1: OPERATIONAL (Email, Entries, Settings, Secrets, Workers)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS admin_emails (
  id TEXT PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  template_id TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'processing', 'sent', 'failed', 'bounced', 'complained')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_code TEXT,
  error_message TEXT,
  message_id TEXT UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME,
  retry_at DATETIME,
  created_by_id TEXT,
  FOREIGN KEY(template_id) REFERENCES admin_email_templates(id),
  FOREIGN KEY(created_by_id) REFERENCES admin_users(id)
);

CREATE INDEX idx_admin_emails_recipient ON admin_emails(recipient_email);
CREATE INDEX idx_admin_emails_status ON admin_emails(status);
CREATE INDEX idx_admin_emails_created ON admin_emails(created_at DESC);
CREATE INDEX idx_admin_emails_retry ON admin_emails(retry_at) WHERE status = 'failed';
CREATE INDEX idx_admin_emails_message_id ON admin_emails(message_id);

CREATE TABLE IF NOT EXISTS admin_email_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  template_html TEXT NOT NULL,
  template_text TEXT,
  variables TEXT,
  created_by_id TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(created_by_id) REFERENCES admin_users(id)
);

CREATE INDEX idx_admin_email_templates_name ON admin_email_templates(name);
CREATE INDEX idx_admin_email_templates_active ON admin_email_templates(is_active);

CREATE TABLE IF NOT EXISTS admin_entries (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  message TEXT,
  source TEXT NOT NULL DEFAULT 'contact-form',
  status TEXT DEFAULT 'new' CHECK(status IN ('new', 'contacted', 'converted', 'rejected', 'spam')),
  metadata TEXT,
  processed_by_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  contacted_at DATETIME,
  FOREIGN KEY(processed_by_id) REFERENCES admin_users(id)
);

CREATE INDEX idx_admin_entries_email ON admin_entries(email);
CREATE INDEX idx_admin_entries_status ON admin_entries(status);
CREATE INDEX idx_admin_entries_source ON admin_entries(source);
CREATE INDEX idx_admin_entries_created ON admin_entries(created_at DESC);

CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  type TEXT DEFAULT 'string' CHECK(type IN ('string', 'number', 'boolean', 'json')),
  description TEXT,
  is_secret BOOLEAN DEFAULT 0,
  updated_by_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(updated_by_id) REFERENCES admin_users(id)
);

CREATE INDEX idx_admin_settings_type ON admin_settings(type);

CREATE TABLE IF NOT EXISTS admin_secrets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('api_key', 'oauth_token', 'webhook_secret', 'encryption_key')),
  description TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'rotated', 'revoked')),
  created_by_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  last_used_at DATETIME,
  rotation_required BOOLEAN DEFAULT 0,
  rotation_policy TEXT,
  FOREIGN KEY(created_by_id) REFERENCES admin_users(id)
);

CREATE INDEX idx_admin_secrets_key_prefix ON admin_secrets(key_prefix);
CREATE INDEX idx_admin_secrets_status ON admin_secrets(status);
CREATE INDEX idx_admin_secrets_type ON admin_secrets(type);
CREATE INDEX idx_admin_secrets_expires ON admin_secrets(expires_at) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS admin_workers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  worker_type TEXT CHECK(worker_type IN ('mail', 'webhook', 'scheduled', 'custom')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'deploying', 'error')),
  cloudflare_worker_id TEXT UNIQUE,
  environment TEXT DEFAULT 'production',
  last_deployed_at DATETIME,
  last_deployed_by_id TEXT,
  deployment_sha TEXT,
  deployment_status TEXT,
  error_message TEXT,
  created_by_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(last_deployed_by_id) REFERENCES admin_users(id),
  FOREIGN KEY(created_by_id) REFERENCES admin_users(id)
);

CREATE INDEX idx_admin_workers_status ON admin_workers(status);
CREATE INDEX idx_admin_workers_type ON admin_workers(worker_type);
CREATE INDEX idx_admin_workers_created ON admin_workers(created_at DESC);

-- ==============================================================================
-- PHASE 1-3: WORKFLOWS & INTEGRATIONS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS admin_workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK(trigger_type IN ('manual', 'scheduled', 'webhook', 'event')),
  trigger_config TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'draft', 'archived')),
  created_by_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(created_by_id) REFERENCES admin_users(id)
);

CREATE INDEX idx_admin_workflows_status ON admin_workflows(status);
CREATE INDEX idx_admin_workflows_trigger ON admin_workflows(trigger_type);

CREATE TABLE IF NOT EXISTS admin_integrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('google_ads', 'meta_ads', 'github', 'stripe', 'custom')),
  status TEXT DEFAULT 'inactive' CHECK(status IN ('active', 'inactive', 'disabled', 'error')),
  auth_method TEXT CHECK(auth_method IN ('oauth', 'api_key', 'webhook')),
  created_by_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  error_message TEXT,
  FOREIGN KEY(created_by_id) REFERENCES admin_users(id)
);

CREATE INDEX idx_admin_integrations_type ON admin_integrations(type);
CREATE INDEX idx_admin_integrations_status ON admin_integrations(status);

-- ==============================================================================
-- AUDIT & SECURITY
-- ==============================================================================

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  changes TEXT,
  status TEXT CHECK(status IN ('success', 'failure')),
  error_message TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES admin_users(id)
);

CREATE INDEX idx_admin_audit_logs_user ON admin_audit_logs(user_id);
CREATE INDEX idx_admin_audit_logs_resource ON admin_audit_logs(resource_type, resource_id);
CREATE INDEX idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC);
CREATE INDEX idx_admin_audit_logs_action ON admin_audit_logs(action);

CREATE TABLE IF NOT EXISTS admin_permission_changes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  changed_by_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  action TEXT CHECK(action IN ('grant', 'revoke')),
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES admin_users(id),
  FOREIGN KEY(changed_by_id) REFERENCES admin_users(id),
  FOREIGN KEY(role_id) REFERENCES admin_roles(id),
  FOREIGN KEY(permission_id) REFERENCES admin_permissions(id)
);

CREATE INDEX idx_permission_changes_user ON admin_permission_changes(user_id);
CREATE INDEX idx_permission_changes_changed_by ON admin_permission_changes(changed_by_id);
CREATE INDEX idx_permission_changes_created ON admin_permission_changes(created_at DESC);

-- ==============================================================================
-- PHASE 2: REAL-TIME EVENTS (Trading, Risk Radar, Market Data)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS realtime_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_realtime_events_type ON realtime_events(event_type);
CREATE INDEX idx_realtime_events_source ON realtime_events(source);
CREATE INDEX idx_realtime_events_created ON realtime_events(created_at DESC);

CREATE TABLE IF NOT EXISTS market_data_feeds (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  price_cents INTEGER,
  volume INTEGER,
  timestamp DATETIME NOT NULL,
  source TEXT
);

CREATE INDEX idx_market_data_feeds_symbol ON market_data_feeds(symbol);
CREATE INDEX idx_market_data_feeds_timestamp ON market_data_feeds(timestamp DESC);

CREATE TABLE IF NOT EXISTS social_sentiment (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  mentions INTEGER,
  sentiment_score REAL,
  source TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_social_sentiment_topic ON social_sentiment(topic);
CREATE INDEX idx_social_sentiment_created ON social_sentiment(created_at DESC);

CREATE TABLE IF NOT EXISTS news_ingestion (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT UNIQUE,
  category TEXT,
  published_at DATETIME,
  ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_news_ingestion_category ON news_ingestion(category);
CREATE INDEX idx_news_ingestion_published ON news_ingestion(published_at DESC);

CREATE TABLE IF NOT EXISTS risk_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,
  flagged_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_risk_events_severity ON risk_events(severity);
CREATE INDEX idx_risk_events_flagged ON risk_events(flagged_at DESC);

-- ==============================================================================
-- PHASE 2: ANALYTICS (Events, Aggregations, SEO, Data Sources)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  user_id TEXT,
  event_type TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  action TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(org_id) REFERENCES organizations(id),
  FOREIGN KEY(user_id) REFERENCES admin_users(id)
);

CREATE INDEX idx_analytics_events_org ON analytics_events(org_id);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_created ON analytics_events(created_at DESC);

CREATE TABLE IF NOT EXISTS analytics_hourly (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  hour DATETIME NOT NULL,
  count INTEGER,
  unique_users INTEGER
);

CREATE INDEX idx_analytics_hourly_type ON analytics_hourly(event_type);
CREATE INDEX idx_analytics_hourly_hour ON analytics_hourly(hour DESC);

CREATE TABLE IF NOT EXISTS analytics_daily (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  day DATE NOT NULL,
  count INTEGER,
  unique_users INTEGER
);

CREATE INDEX idx_analytics_daily_type ON analytics_daily(event_type);
CREATE INDEX idx_analytics_daily_day ON analytics_daily(day DESC);

CREATE TABLE IF NOT EXISTS analytics_monthly (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  month TEXT NOT NULL,
  count INTEGER,
  unique_users INTEGER
);

CREATE INDEX idx_analytics_monthly_type ON analytics_monthly(event_type);
CREATE INDEX idx_analytics_monthly_month ON analytics_monthly(month DESC);

CREATE TABLE IF NOT EXISTS seo_metrics (
  id TEXT PRIMARY KEY,
  keyword TEXT NOT NULL,
  position INTEGER,
  clicks INTEGER,
  impressions INTEGER,
  ctr REAL,
  volume INTEGER,
  difficulty INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_seo_metrics_keyword ON seo_metrics(keyword);
CREATE INDEX idx_seo_metrics_position ON seo_metrics(position);

CREATE TABLE IF NOT EXISTS seo_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  price_cents INTEGER,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'archived')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_seo_products_status ON seo_products(status);

CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  provider TEXT CHECK(provider IN ('google_analytics', 'google_search_console', 'meta_ads', 'google_ads', 'stripe', 'custom')),
  api_endpoint TEXT,
  status TEXT DEFAULT 'inactive' CHECK(status IN ('active', 'inactive', 'error')),
  last_sync DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_data_sources_provider ON data_sources(provider);
CREATE INDEX idx_data_sources_status ON data_sources(status);

CREATE TABLE IF NOT EXISTS analytics_exports (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  format TEXT CHECK(format IN ('csv', 'json', 'api', 'embedding')),
  price_cents INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analytics_exports_format ON analytics_exports(format);

-- ==============================================================================
-- PHASE 3: OPPORTUNITY & ASSET MANAGEMENT
-- ==============================================================================

CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK(category IN ('technology', 'service', 'product', 'revenue', 'market', 'research')),
  status TEXT DEFAULT 'discovered' CHECK(status IN ('discovered', 'researching', 'validating', 'experiment', 'building', 'active', 'monetizing', 'scaling', 'paused', 'rejected', 'sold', 'archived')),
  potential_revenue REAL,
  startup_cost REAL,
  recurring_cost REAL,
  time_requirement_hours INTEGER,
  automation_potential TEXT,
  legal_burden TEXT,
  regulatory_burden TEXT,
  technical_difficulty TEXT CHECK(technical_difficulty IN ('trivial', 'easy', 'moderate', 'hard', 'unknown')),
  defensibility TEXT CHECK(defensibility IN ('none', 'low', 'medium', 'high')),
  owner_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(owner_id) REFERENCES admin_users(id)
);

CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_category ON opportunities(category);
CREATE INDEX idx_opportunities_owner ON opportunities(owner_id);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('domain', 'website', 'application', 'api', 'dataset', 'software', 'brand', 'trademark', 'copyright', 'content_library', 'customer_list', 'license', 'contract', 'hardware')),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  org_id TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'archived', 'sold', 'retired')),
  acquisition_cost REAL,
  current_valuation REAL,
  revenue_ytd REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(org_id) REFERENCES organizations(id)
);

CREATE INDEX idx_assets_type ON assets(type);
CREATE INDEX idx_assets_org ON assets(org_id);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_name ON assets(name);

-- ==============================================================================
-- PHASE 3: MONETIZATION (Subscriptions, Revenue Tracking, Partners)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS subscription_tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  price_cents INTEGER,
  billing_cycle TEXT CHECK(billing_cycle IN ('monthly', 'yearly')),
  features TEXT,
  api_rate_limit INTEGER,
  storage_gb INTEGER,
  seats INTEGER,
  support_level TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscription_tiers_price ON subscription_tiers(price_cents);
CREATE INDEX idx_subscription_tiers_slug ON subscription_tiers(slug);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tier_id TEXT NOT NULL,
  org_id TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'canceled', 'expired', 'trial')),
  trial_ends_at DATETIME,
  renews_at DATETIME,
  canceled_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES admin_users(id),
  FOREIGN KEY(tier_id) REFERENCES subscription_tiers(id),
  FOREIGN KEY(org_id) REFERENCES organizations(id)
);

CREATE INDEX idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_tier ON user_subscriptions(tier_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_renews ON user_subscriptions(renews_at);

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
  FOREIGN KEY(user_id) REFERENCES admin_users(id),
  FOREIGN KEY(asset_id) REFERENCES assets(id)
);

CREATE INDEX idx_revenue_events_org ON revenue_events(org_id);
CREATE INDEX idx_revenue_events_type ON revenue_events(revenue_type);
CREATE INDEX idx_revenue_events_channel ON revenue_events(channel);
CREATE INDEX idx_revenue_events_created ON revenue_events(created_at DESC);
CREATE INDEX idx_revenue_events_status ON revenue_events(status);

CREATE TABLE IF NOT EXISTS reseller_partners (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  partner_org_id TEXT NOT NULL,
  revenue_share_percent REAL,
  tier TEXT CHECK(tier IN ('silver', 'gold', 'platinum')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(org_id) REFERENCES organizations(id),
  FOREIGN KEY(partner_org_id) REFERENCES organizations(id)
);

CREATE INDEX idx_reseller_partners_org ON reseller_partners(org_id);
CREATE INDEX idx_reseller_partners_status ON reseller_partners(status);

-- ==============================================================================
-- PHASE 3: MULTI-PLATFORM BRIDGE (HostGator ↔ Cloudflare Migration)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS data_sync_log (
  id TEXT PRIMARY KEY,
  source_platform TEXT CHECK(source_platform IN ('hostgator', 'cloudflare')),
  dest_platform TEXT CHECK(dest_platform IN ('hostgator', 'cloudflare')),
  table_name TEXT,
  rows_synced INTEGER,
  sync_status TEXT CHECK(sync_status IN ('pending', 'in_progress', 'success', 'failed', 'partial')),
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_data_sync_log_status ON data_sync_log(sync_status);
CREATE INDEX idx_data_sync_log_created ON data_sync_log(created_at DESC);

CREATE TABLE IF NOT EXISTS platform_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  platform TEXT CHECK(platform IN ('cloudflare', 'hostgator', 'hybrid')),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_status (
  id TEXT PRIMARY KEY,
  platform TEXT CHECK(platform IN ('cloudflare', 'hostgator')),
  status TEXT CHECK(status IN ('healthy', 'degraded', 'down')),
  last_check DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_platform_status_platform ON platform_status(platform);

-- ==============================================================================
-- INITIALIZATION: Insert Default Roles & Permissions
-- ==============================================================================

-- Default roles
INSERT OR IGNORE INTO admin_roles (id, name, description, priority, is_system)
VALUES
  ('role-admin', 'Admin', 'Full platform access', 100, 1),
  ('role-moderator', 'Moderator', 'Content and user management', 50, 1),
  ('role-viewer', 'Viewer', 'Read-only access', 10, 1);

-- Default permissions
INSERT OR IGNORE INTO admin_permissions (id, resource, action, description)
VALUES
  ('perm-email-send', 'email', 'send', 'Send emails'),
  ('perm-email-delete', 'email', 'delete', 'Delete emails'),
  ('perm-email-template-create', 'email', 'template.create', 'Create email templates'),
  ('perm-users-create', 'users', 'create', 'Create users'),
  ('perm-users-delete', 'users', 'delete', 'Delete users'),
  ('perm-users-update', 'users', 'update', 'Update user roles'),
  ('perm-workers-deploy', 'workers', 'deploy', 'Deploy workers'),
  ('perm-secrets-rotate', 'secrets', 'rotate', 'Rotate secrets'),
  ('perm-settings-update', 'settings', 'update', 'Update settings'),
  ('perm-audit-read', 'audit', 'read', 'View audit logs'),
  ('perm-workflows-create', 'workflows', 'create', 'Create workflows'),
  ('perm-integrations-manage', 'integrations', 'manage', 'Manage integrations');

-- Map admin role to all permissions
INSERT OR IGNORE INTO admin_role_permissions (id, role_id, permission_id)
SELECT
  'rolep-' || hex(randomblob(8)),
  'role-admin',
  id
FROM admin_permissions;

-- Map moderator to read/limited permissions
INSERT OR IGNORE INTO admin_role_permissions (id, role_id, permission_id)
SELECT
  'rolep-' || hex(randomblob(8)),
  'role-moderator',
  id
FROM admin_permissions
WHERE action LIKE '%.create' OR action = 'read';

-- Map viewer to read-only
INSERT OR IGNORE INTO admin_role_permissions (id, role_id, permission_id)
SELECT
  'rolep-' || hex(randomblob(8)),
  'role-viewer',
  id
FROM admin_permissions
WHERE action = 'read' OR resource = 'audit';

-- ==============================================================================
-- SCHEMA COMPLETE
-- ==============================================================================
-- Created 30+ tables supporting:
-- - Phase 1: Admin infrastructure, RBAC, email, entries
-- - Phase 2: Real-time events, analytics, aggregations
-- - Phase 3: Opportunities, assets, monetization, multi-platform bridge
-- - Phase 4: Resellers, partners, external APIs (schema ready)
--
-- All tables include proper indexes, constraints, and audit trail.
-- Never hard-delete audit logs or compliance records.
-- Secrets stored only as metadata (values in Cloudflare Secrets Store).
-- ==============================================================================
