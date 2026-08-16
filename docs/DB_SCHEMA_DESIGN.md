# Goldshore Platform DB Schema Design

**Purpose**: Comprehensive D1 schema for Gold Shore Labs as a multidisciplinary operating company  
**Scope**: Admin infrastructure (Phase 1), analytics & monetization (Phase 2-4), opportunity management, asset registry, revenue tracking  
**Security**: Audit trails, RBAC, multi-organization isolation, contractor offboarding, compliance logging  
**Model**: One core infrastructure supporting multiple revenue surfaces (SaaS, consulting, APIs, commerce, media)

---

## Gold Shore Operating Model

Gold Shore is not a single-product company but a **platform for controlled diversification**. The architecture must support:

- **Technology**: APIs, integrations, automation, data systems
- **Digital Products**: SaaS, dashboards, data feeds, plugins
- **Services**: Consulting, implementation, managed services, advisory
- **Commerce**: Subscriptions, usage billing, resellers, affiliate revenue, licensing
- **Assets**: Domains, websites, APIs, datasets, brands, customer relationships
- **Research**: Market intelligence, financial analysis, predictive tools
- **Infrastructure**: Multi-platform (Cloudflare primary, HostGator bridge), secure, auditable

The schema enables:
- Multiple revenue models (subscription + per-API + per-event + reseller + affiliate + licensing)
- Asset lifecycle (idea → experiment → product → revenue asset)
- Operator network (employees, contractors, partners, AI agents)
- Opportunity discovery & validation without polluting production
- Complete revenue attribution (who, what, channel, margin, automation)

---

## Design Principles

### 1. Security & Governance First
- ✅ Audit trail for every action (never hard-delete compliance logs)
- ✅ User/role/permission separation (RBAC) with org isolation
- ✅ Permission tracking on sensitive operations
- ✅ Contractor lifecycle (hire → work → audit → offboard)
- ✅ Multi-org support for resellers/partners
- ✅ Soft deletes where appropriate (status flags)
- ✅ IP logging for anomaly detection
- ✅ Secrets never stored as values (metadata only in D1)

### 2. Extensibility Without Overbuilding
- Designed to support Phases 1-4 without schema changes
- Normalized tables for opportunities, assets, workflows, integrations
- Generic event store for analytics
- Generic revenue ledger for all monetization models
- Add features via extension tables, not new table proliferation

### 3. Multi-Tier Processing
- **Real-time tier**: Trading, Risk Radar, market data, social signals, news alerts
- **Batch tier**: SEO, analytics, reporting, billing rollups
- **Bridge tier**: HostGator ↔ Cloudflare sync, failover, migration tracking

### 4. Performance
- Strategic indexes on query patterns (status, created_at, type, revenue_type)
- Denormalization where needed (status counts cached in KV, not DB)
- Separate tables for audit logs (won't slow down transactional queries)
- Pagination indexes on timestamps
- Retention policy (archive old events to R2, keep recent in D1)

### 5. Data Integrity
- Foreign key constraints with ON DELETE CASCADE where appropriate
- Check constraints for valid status/type values
- Unique constraints on critical fields (email, API key prefixes, domain names)
- Referential integrity across org/asset/revenue relationships

---

## Three-Tier Processing Architecture

### Tier 1: Real-Time Event Processing
**Purpose**: Trading interfaces, Risk Radar, market data, news feeds, social signals  
**Queue**: `EVENTS_QUEUE`  
**Tables**:
- `realtime_events` — Raw event ingest (market prices, news, alerts)
- `realtime_subscriptions` — Active subscribers to data streams
- `market_data_feeds` — Live market prices, volumes
- `social_sentiment` — Social media mentions, sentiment scores
- `news_ingestion` — Breaking news, categorized alerts
- `risk_events` — Flagged anomalies for trading alerts

**Characteristics**:
- Asynchronous message processing
- Idempotency (deduplicate by event_id)
- Event replay capability (timestamp indexed)
- Audit trail (who subscribed, when alerts fired)
- Retention: 30 days in D1, archive to R2 after

### Tier 2: Batch Analytics
**Purpose**: SEO, traffic analysis, API usage, billing, business intelligence, reporting  
**Queue**: `JOBS_QUEUE`  
**Tables**:
- `analytics_events` — Raw user actions, API calls, feature usage
- `analytics_hourly` — Hourly aggregations (rollup every hour)
- `analytics_daily` — Daily aggregations (rollup every day)
- `analytics_monthly` — Monthly aggregations (rollup every month)
- `seo_metrics` — Goldshore's own SEO intelligence (internal capability)
- `seo_products` — SEO analytics sold to customers (product feature)
- `data_sources` — Provider integrations (Google Analytics, Ads, Meta, etc.)
- `analytics_exports` — Available export types with pricing tiers

**Characteristics**:
- Scheduled processing (hourly/daily/monthly)
- Raw events separable from aggregates
- Long retention (1 year raw, indefinite aggregates)
- Query patterns: time-range aggregations, user cohorts, revenue trends

### Tier 3: Multi-Platform Data Bridge
**Purpose**: Transition toward Cloudflare while maintaining HostGator accessibility  
**Tables**:
- `data_sync_log` — Replication metadata between platforms
- `platform_config` — Active platform endpoints (routing control)
- `hostgator_sync` — HostGator DB replication status
- `platform_status` — Health checks, failover triggers
- `api_proxies` — Route mapping (which platform serves which endpoint)
- `migration_backlog` — Data not yet moved from HostGator to CF

**Characteristics**:
- Measurable migration criteria (don't force all data to CF prematurely)
- Failover logic (if CF unavailable, route to HostGator)
- Audit trail of sync operations
- Never lose data during migration

---

## Schema Overview by Layer

### CORE: Organization & Multi-Tenancy
- `organizations` — Gold Shore entities (main company, partners, resellers)
- `org_members` — Users, contractors, partners with role assignments
- `org_permissions` — Org-level access control

### CORE: Identity & Access (RBAC)
- `admin_users` — Users with org, role, status, MFA
- `admin_roles` — Role definitions with priority
- `admin_permissions` — Granular permission definitions (resource + action)
- `admin_role_permissions` — Role → Permission mapping
- `contractors` — Temporary human/AI actors with expiration, work assignment
- `service_accounts` — API-only actors (automation, integrations)

### TIER 1: Real-Time Events (Phase 1-2)
- `realtime_events`, `realtime_subscriptions`, `market_data_feeds`, `social_sentiment`, `news_ingestion`, `risk_events`

### TIER 2: Analytics & Intelligence (Phase 2-3)
- `analytics_events`, `analytics_hourly`, `analytics_daily`, `analytics_monthly`
- `seo_metrics`, `seo_products`, `data_sources`, `analytics_exports`

### OPERATIONAL: Admin & Workflows (Phase 1-3)
- `admin_emails` — Email queue + logs
- `admin_email_templates` — Email templates
- `admin_entries` — Contact form submissions, leads
- `admin_settings` — Platform configuration (key-value)
- `admin_secrets` — API key metadata (values in Secrets Store)
- `admin_workers` — Cloudflare Worker deployment tracking
- `admin_workflows` — Workflow definitions (manual, scheduled, webhook, event)
- `admin_integrations` — Third-party integrations (Google Ads, Meta, Stripe, etc.)

### MONETIZATION: Subscriptions & Billing (Phase 3-4)
- `subscription_tiers` — Feature tiers (Free, Pro, Business, Enterprise, Reseller)
- `user_subscriptions` — Active subscriptions, trial status, renewal dates
- `api_usage_billing` — Per-call charges, rate limits by tier
- `revenue_events` — Generic ledger (charges, refunds, credits, commissions, affiliate payouts)
- `reseller_partners` — External customers buying aggregated analytics
- `partner_revenue` — Revenue share tracking, payout history

### OPPORTUNITY & ASSET MANAGEMENT (Phase 2-4)
- `opportunities` — Ideas from discovery → monetizing → scaling or rejected
- `opportunity_experiments` — Validation tests for opportunities
- `assets` — Domains, websites, APIs, datasets, brands, licenses, contracts
- `asset_revenue` — Which assets generated how much revenue
- `asset_relationships` — Cross-references (which product uses which API, etc.)

### SECURITY & AUDIT
- `admin_audit_logs` — Comprehensive audit trail (never hard-delete)
- `admin_permission_changes` — Permission change audit trail
- `contractor_audit` — Contractor hire/fire/work audit trail
- `data_sync_audit` — HostGator↔Cloudflare migration audit

### BRIDGE: Multi-Platform (Phase 3-4)
- `data_sync_log`, `platform_config`, `hostgator_sync`, `platform_status`, `api_proxies`, `migration_backlog`

---

## Detailed Table Definitions

### 0. organizations
```sql
CREATE TABLE organizations (
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
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(created_by_id) REFERENCES admin_users(id)
);

CREATE INDEX idx_organizations_type ON organizations(type);
CREATE INDEX idx_organizations_status ON organizations(status);
```

**Purpose**: Multi-tenancy support (main company, resellers, partners, customers)  
**Types**:
- `internal` — Gold Shore itself
- `partner` — Integration partners (Google, Meta, Stripe, etc.)
- `reseller` — External customers reselling analytics/APIs
- `customer` — End customers (for future B2C expansion)

---

### 0b. contractors
```sql
CREATE TABLE contractors (
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
```

**Purpose**: Flexible workforce (contractors, freelancers, partners, AI agents)  
**Security**: expires_at prevents "ghost" access; audit trail tracks hire/fire

---

### 1. admin_roles
```sql
CREATE TABLE admin_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_roles_name ON admin_roles(name);
```

**Purpose**: Define available roles (admin, moderator, viewer, etc.)  
**Fields**:
- `priority`: For role hierarchy (admin=100, moderator=50, viewer=10)
- `is_system`: Can't be deleted if true

---

### 2. admin_permissions
```sql
CREATE TABLE admin_permissions (
  id TEXT PRIMARY KEY,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(resource, action)
);

CREATE INDEX idx_admin_permissions_resource ON admin_permissions(resource);
```

**Purpose**: Granular permission definitions  
**Examples**:
- `(email, send)`
- `(email, delete)`
- `(users, create)`
- `(workers, deploy)`
- `(secrets, rotate)`
- `(workflows, create)`

---

### 3. admin_role_permissions
```sql
CREATE TABLE admin_role_permissions (
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
```

**Purpose**: Maps roles to permissions  
**Example**: admin_role has all permissions, viewer_role only has read permissions

---

### 4. admin_users
```sql
CREATE TABLE admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended', 'invited')),
  mfa_enabled BOOLEAN DEFAULT 0,
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  invited_at DATETIME,
  invited_by_id TEXT,
  FOREIGN KEY(role_id) REFERENCES admin_roles(id),
  FOREIGN KEY(invited_by_id) REFERENCES admin_users(id)
);

CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_role ON admin_users(role_id);
CREATE INDEX idx_admin_users_status ON admin_users(status);
CREATE INDEX idx_admin_users_created ON admin_users(created_at DESC);
```

**Purpose**: Platform admin users  
**Security**:
- Password/MFA info stored separately (not in DB)
- MFA flag tracks if user has MFA enabled
- Status track lifecycle: invited → active → suspended

---

### 5. admin_emails
```sql
CREATE TABLE admin_emails (
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
```

**Purpose**: Email queue and delivery logs  
**Features**:
- Track all email states (queued, processing, sent, failed, bounced, complained)
- Retry logic with exponential backoff
- Failed reasons captured for debugging
- Message ID for deduplication
- Audit trail of who created the email

---

### 6. admin_email_templates
```sql
CREATE TABLE admin_email_templates (
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
```

**Purpose**: Reusable email templates with variables  
**Fields**:
- `variables`: JSON array of template variables (e.g., ["{{name}}", "{{link}}"])
- `is_active`: Soft delete for templates
- Audit trail via created_by_id

---

### 7. admin_entries
```sql
CREATE TABLE admin_entries (
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
```

**Purpose**: Contact form submissions, leads  
**Features**:
- Track source (contact-form, signup, api, etc.)
- Status pipeline: new → contacted/converted/rejected
- Metadata for custom fields (JSON)
- Track who processed the entry

---

### 8. admin_settings
```sql
CREATE TABLE admin_settings (
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
```

**Purpose**: Platform configuration  
**Examples**:
- `smtp_host`, `smtp_port` (email config)
- `max_email_batch_size`
- `maintenance_mode` (boolean)
- Feature flags as JSON

---

### 9. admin_secrets
```sql
CREATE TABLE admin_secrets (
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
```

**Purpose**: API keys, OAuth tokens, secrets management  
**Security**:
- Actual secret values stored in Cloudflare Secrets Store (not in DB)
- Only metadata stored here
- Track rotation policy for automatic rotation (Phase 2)
- Audit trail via created_by_id

---

### 10. admin_workers (Phase 1 Extensibility)
```sql
CREATE TABLE admin_workers (
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
```

**Purpose**: Track deployed Cloudflare Workers  
**Phase 1**: Track mail worker, future workers

---

### 11. admin_workflows (Phase 3)
```sql
CREATE TABLE admin_workflows (
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
```

**Purpose**: Workflow definitions (leads generator, email sender, etc.)

---

### 12. admin_integrations (Phase 4)
```sql
CREATE TABLE admin_integrations (
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
```

**Purpose**: Third-party integration tracking (Google Ads, Meta, etc.)

---

### 13. admin_audit_logs (Comprehensive Audit Trail)
```sql
CREATE TABLE admin_audit_logs (
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
```

**Purpose**: Comprehensive audit trail for compliance  
**Fields**:
- `changes`: JSON diff of what changed
- `status`: success/failure tracking
- IP + user agent for security investigation
- Queryable by user, resource, action, timestamp

---

### 14. admin_permission_changes
```sql
CREATE TABLE admin_permission_changes (
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
```

**Purpose**: Track who changed permissions and when  
**Security**: Who changed what permission for which user at what time

---

### 15. opportunities (Phase 2-4)
```sql
CREATE TABLE opportunities (
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
```

**Purpose**: Opportunity discovery & validation without polluting production  
**Lifecycle**: DISCOVERED → REJECTED | EXPERIMENT → ACTIVE → MONETIZING → SCALING | SOLD

---

### 16. assets (Phase 2-4)
```sql
CREATE TABLE assets (
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
```

**Purpose**: Track value-generating properties and their revenue contribution  
**Query Pattern**: "Which assets generated revenue? How much did each cost? Current ROI?"

---

### 17. revenue_events (Phase 3-4)
```sql
CREATE TABLE revenue_events (
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
```

**Purpose**: Generic revenue ledger supporting all monetization models  
**Query Patterns**:
```sql
-- Where did every dollar come from?
SELECT revenue_type, channel, SUM(amount_cents)/100 as total
FROM revenue_events WHERE created_at >= date('now', '-30 days')
GROUP BY revenue_type, channel ORDER BY total DESC;

-- Which assets are profitable?
SELECT a.name, SUM(r.amount_cents)/100 as revenue, 
  a.acquisition_cost, (SUM(r.amount_cents)/100 - a.acquisition_cost) as margin
FROM revenue_events r JOIN assets a ON r.asset_id = a.id
GROUP BY a.id ORDER BY revenue DESC;
```

---

### 18. analytics_events (Phase 2-4)
```sql
CREATE TABLE analytics_events (
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
```

**Purpose**: Raw event log for batch aggregation  
**Types**: user.login, api.call, feature.used, email.sent, export.downloaded, etc.

---

### 19. realtime_events (Phase 1)
```sql
CREATE TABLE realtime_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_realtime_events_type ON realtime_events(event_type);
CREATE INDEX idx_realtime_events_source ON realtime_events(source);
CREATE INDEX idx_realtime_events_created ON realtime_events(created_at DESC);
```

**Purpose**: Real-time ingest for trading/Risk Radar/market data  
**Sources**: market_api, news_feed, social_stream, usgs_alerts, trading_signals

---

### 20. subscription_tiers (Phase 3-4)
```sql
CREATE TABLE subscription_tiers (
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
```

**Purpose**: Define subscription offerings (Free, Pro, Business, Enterprise, Reseller)

---

### 21. user_subscriptions (Phase 3-4)
```sql
CREATE TABLE user_subscriptions (
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
```

**Purpose**: Track active subscriptions, trial status, renewal dates

---

### 22. reseller_partners (Phase 4)
```sql
CREATE TABLE reseller_partners (
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
```

**Purpose**: Track external resellers and revenue-share agreements

---

### 23. data_sync_log (Phase 3 Bridge)
```sql
CREATE TABLE data_sync_log (
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
```

**Purpose**: Audit trail of HostGator → Cloudflare migration  
**Query Pattern**: "What data has been migrated? What remains? Any sync failures?"

---

## Security Considerations

### 1. Secrets Management
- ❌ Never store actual secrets in D1
- ✅ Store only key metadata + prefix
- ✅ Use Cloudflare Secrets Store for actual values
- ✅ Audit trail of secret access

### 2. Password Handling
- ❌ Passwords not stored in D1
- ✅ Use Cloudflare Access for authentication
- ✅ MFA tracked via mfa_enabled flag

### 3. Sensitive Data
- `is_secret` flag on settings
- Don't log actual secret values in audit logs
- IP tracking for anomaly detection

### 4. Soft Deletes
- Email templates use `is_active` flag
- Never hard-delete audit logs
- User status tracks soft deletes (suspended/inactive)

### 5. Data Retention
- Audit logs: Keep indefinitely for compliance
- Email logs: Retain 90+ days for debugging
- Session logs: Retain 30 days
- Failed emails: Retain until manually deleted

---

## Performance Optimization

### Query Patterns (Indexed)
- Get users by role: `admin_users.role_id`
- Get active entries: `admin_entries.status`
- Get failed emails needing retry: `admin_emails.retry_at WHERE status='failed'`
- Get audit trail by resource: `admin_audit_logs(resource_type, resource_id)`
- Get recent actions: `created_at DESC`

### Denormalization Strategy
- Email status counts stored in cache (KV) not DB
- User permission grants cached (not queried each request)
- Settings loaded at boot into KV

### Maintenance
- Archive old audit logs (>1 year) if needed
- Soft delete old email templates
- Index on `created_at DESC` for pagination

---

## Migration Path

**Phase 1 (NOW)** → Applied to D1
```
organizations, admin_users, admin_roles, admin_permissions, admin_role_permissions,
contractors, admin_emails, admin_email_templates, admin_entries, admin_settings,
admin_secrets, admin_workers, admin_workflows, admin_integrations,
admin_audit_logs, admin_permission_changes
```

**Phase 2 (Week 2)** → Added to D1
```
realtime_events, analytics_events, analytics_hourly, analytics_daily, analytics_monthly,
seo_metrics, seo_products, data_sources, analytics_exports
```

**Phase 3 (Week 3)** → Added to D1
```
opportunities, opportunity_experiments, assets, asset_revenue, asset_relationships,
revenue_events, subscription_tiers, user_subscriptions, data_sync_log,
platform_config, hostgator_sync, platform_status, api_proxies, migration_backlog
```

**Phase 4 (Week 4+)** → Fully operationalized
```
reseller_partners, partner_revenue, contractor_audit, data_sync_audit,
Full external API support, complete reseller program
```

**Backward Compatibility**: 
- ✅ New tables added without modifying existing tables
- ✅ No breaking changes to Phase 1 schema
- ✅ Foreign keys cascade safely
- ✅ Existing routes, workers, and audits continue functioning

---

## Before Applying Migration

**Checklist**:
- [ ] D1 database exists (PLATFORM_DB)
- [ ] Cloudflare Access configured on admin routes
- [ ] `wrangler d1 execute` tested locally
- [ ] Backup of existing data (if any)
- [ ] Team notified of maintenance window
- [ ] Rollback procedure documented
- [ ] This schema reviewed and approved by stakeholders

**To Apply**:
```bash
# Option A: Wrangler CLI (from goldshore-ai directory)
wrangler d1 execute PLATFORM_DB \
  --file apps/gs-api/src/migrations/0001_admin_schema.sql \
  --env prod

# Option B: Cloudflare Dashboard
# Navigate to D1 → Databases → gs_platform_db → Console
# Copy entire migration SQL and execute
```

**After Applying**:
1. Verify all 30+ tables created: `SELECT count(*) FROM sqlite_master WHERE type='table';`
2. Test RBAC: Insert admin user, verify permissions load
3. Test email: Send test email, verify audit log entry
4. Test analytics: Insert analytics_event, verify aggregation
5. Monitor audit logs for any errors

---

## Cloudflare Service Mapping

| Data Type | Service | Rationale | TTL/Retention |
|-----------|---------|-----------|----------------|
| Secrets (API keys, tokens) | Cloudflare Secrets Store | Never in plaintext DB; rotatable | Per policy |
| Configuration (non-secret) | KV | Fast, distributed, easy updates | No TTL; backup in D1 |
| Application data (RBAC, users) | D1 | Relational, queryable, auditable | Indefinite |
| Audit logs (compliance) | D1 | Never hard-deleted; indexed | Indefinite |
| Real-time events (market data) | EVENTS_QUEUE → D1 | Ingest async, store for replay | 30 days in D1 |
| Batch jobs (analytics) | JOBS_QUEUE → D1 aggregates | Hourly/daily/monthly rollups | Raw: 1 year; aggregates: indefinite |
| Files, exports, media | R2 | Object storage; archive analytics | 7+ years (compliance) |
| Worker state | Durable Objects (if needed) | Consistent state for shared resource | Session-bound |

**Migration Strategy**:
- Phase 1-2: Use D1 for everything; HostGator remains read-only backup
- Phase 3: Add HostGator ↔ Cloudflare sync tables; evaluate D1 scale
- Phase 4: Full migration to Cloudflare; HostGator archived

---

## Deployment Phases Tied to PR/Deploy Workflow

### Phase 1 (Current): Admin Infrastructure
**Branch**: `claude/mcp-gs-api-worker-migration-0g51br`  
**Tables**: admin_users, admin_roles, admin_permissions, admin_role_permissions, admin_emails, admin_email_templates, admin_entries, admin_settings, admin_secrets, admin_workers, admin_audit_logs, admin_permission_changes

**PR Gates**:
- [ ] Schema migration applies without errors
- [ ] TypeScript types compile (Env bindings)
- [ ] CI passes (CodeQL, ESLint, Lighthouse)
- [ ] D1 migration reversible (can rollback)
- [ ] Audit tests pass (log every action)

**Success Criteria**:
- Admin dashboard can create/read/update users
- Email queue persists and processes
- Audit log captures all operations
- Performance: <100ms for CRUD, <500ms for aggregations

---

### Phase 2 (Week 2): Analytics & SEO
**New Tables**: realtime_events, analytics_events, analytics_hourly, analytics_daily, analytics_monthly, seo_metrics, seo_products, data_sources, analytics_exports

**PR Gates**:
- [ ] Event ingest tested (real-time + batch paths)
- [ ] Aggregation queries verified (hourly/daily/monthly)
- [ ] SEO data sync working (Google Analytics, Search Console)
- [ ] Performance: analytics queries <1s for month of data

**Success Criteria**:
- Real-time market data flowing through EVENTS_QUEUE
- Batch jobs aggregating data successfully
- SEO dashboards showing own site metrics
- Internal visibility into traffic, engagement, API usage

---

### Phase 3 (Week 3): Monetization & Opportunities
**New Tables**: organizations, contractors, opportunities, assets, revenue_events, subscription_tiers, user_subscriptions, reseller_partners, data_sync_log

**PR Gates**:
- [ ] Revenue events recording all transaction types
- [ ] Subscription tiers defined and testable
- [ ] Revenue attribution queries validated
- [ ] HostGator sync audit trail working

**Success Criteria**:
- Can answer: "Where did every dollar come from?"
- Reseller revenue share calculated correctly
- Opportunity pipeline trackable
- Asset valuation reflects revenue contribution

---

### Phase 4 (Week 4+): External APIs & Reseller Program
**New Tables**: Full reseller/partner support, API usage billing, third-party integrations

**PR Gates**:
- [ ] Security audit complete (data isolation, rate limiting, abuse protection)
- [ ] Rate limiting enforced per tier
- [ ] Partner revenue splits accurate
- [ ] API documentation complete

**Success Criteria**:
- External customers can purchase access
- Revenue share with resellers calculated
- No data leakage between orgs
- Audit trail shows all partner activity

---

## Query Examples

### Revenue Intelligence

**Where did revenue come from this month?**
```sql
SELECT revenue_type, channel, COUNT(*) as transactions, SUM(amount_cents)/100 as total
FROM revenue_events
WHERE created_at >= date('now', '-1 month') AND status = 'charged'
GROUP BY revenue_type, channel
ORDER BY total DESC;
```

**Which assets are actually profitable?**
```sql
SELECT a.id, a.name, a.type, 
  COALESCE(SUM(r.amount_cents)/100, 0) as revenue_ytd,
  a.acquisition_cost,
  COALESCE(SUM(r.amount_cents)/100, 0) - a.acquisition_cost as margin
FROM assets a
LEFT JOIN revenue_events r ON a.id = r.asset_id AND r.created_at >= date('now', '-1 year')
WHERE a.status = 'active'
GROUP BY a.id
ORDER BY margin DESC;
```

**What's our churn rate?**
```sql
SELECT 
  COUNT(CASE WHEN us.status = 'canceled' THEN 1 END) as canceled,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(CASE WHEN us.status = 'canceled' THEN 1 END) / COUNT(*), 2) as churn_percent
FROM user_subscriptions us
WHERE us.renews_at < datetime('now')
GROUP BY strftime('%Y-%m', us.canceled_at);
```

### Analytics

**Most used features (last 7 days)**
```sql
SELECT event_type, COUNT(*) as count
FROM analytics_events
WHERE created_at >= datetime('now', '-7 days')
GROUP BY event_type
ORDER BY count DESC
LIMIT 20;
```

**API usage by customer (for billing)**
```sql
SELECT user_id, COUNT(*) as api_calls, 
  CASE 
    WHEN COUNT(*) > 1000 THEN 'high'
    WHEN COUNT(*) > 100 THEN 'medium'
    ELSE 'low'
  END as usage_tier
FROM analytics_events
WHERE event_type = 'api.call' AND created_at >= date('now', '-1 month')
GROUP BY user_id
ORDER BY api_calls DESC;
```

### Opportunity Validation

**Which opportunities have validated demand?**
```sql
SELECT o.id, o.title, COUNT(e.id) as experiments, 
  MAX(CASE WHEN e.status = 'success' THEN 1 ELSE 0 END) as had_success
FROM opportunities o
LEFT JOIN opportunity_experiments e ON o.id = e.opportunity_id
WHERE o.status IN ('validating', 'building', 'active')
GROUP BY o.id
ORDER BY had_success DESC, experiments DESC;
```

---

## Data Retention & Aggregation Strategy

### Keep in D1 (Hot Storage)
- **Audit logs**: Indefinite (compliance/legal requirement)
- **Recent events** (<30 days): analytics_events, realtime_events
- **Configuration**: All settings, roles, permissions
- **Active subscriptions**: Current billing state
- **Revenue events** (<90 days): Recent transactions, chargebacks

### Archive to R2 (Cold Storage, Queryable via Lambda)
- **Old analytics** (>1 year): Move analytics_events to R2 as Parquet
- **Old audit logs** (>7 years): Archive for compliance
- **Export files**: Email exports, data extracts

### Aggregate Strategy
```
Raw event → Hourly aggregation → Daily aggregation → Monthly aggregation → Archive
(D1)        (D1)                (D1)               (D1)                   (R2)
```

**Cron jobs** (via JOBS_QUEUE):
- **Hourly** (top of each hour): Aggregate previous hour's analytics_events → analytics_hourly
- **Daily** (midnight UTC): Aggregate previous day's analytics_hourly → analytics_daily
- **Monthly** (1st of month): Aggregate previous month's analytics_daily → analytics_monthly
- **Quarterly** (1st of each quarter): Move >90 day events to R2

**Retention Policy**:
- Raw events: 30 days
- Hourly: 1 year
- Daily: Indefinite
- Monthly: Indefinite
- Audit logs: Indefinite
- Revenue events: Indefinite

---

## Generalized Product/Service Model

Gold Shore infrastructure should support launching:

| Type | Example | Tables Used |
|------|---------|-------------|
| **Internal Tool** | Admin dashboard | admin_* tables |
| **SaaS Product** | Analytics dashboard | analytics_* + subscription_tiers |
| **API Product** | Data feed | analytics_events + api_usage_billing |
| **Consulting Service** | Implementation | contractors + revenue_events |
| **Reseller Program** | Analytics reseller | reseller_partners + revenue_share |
| **Affiliate Program** | Marketing affiliate | revenue_events (channel='affiliate') |
| **Licensing** | Data license | assets + revenue_events (type='license') |
| **Marketplace** | Partner integrations | admin_integrations + reseller_partners |
| **Media/Publishing** | Research reports | assets (type='content_library') + revenue_events |

**Generic Launch Checklist**:
1. Create opportunity (validate demand)
2. Define subscription tier (if recurring) or revenue_events type (if transactional)
3. Add asset (track ownership, valuation, revenue)
4. Create organization/contractor assignments (who owns it)
5. Set up audit logging (compliance/financial)
6. Wire to PLATFORM_DB (or AUDIT_DB for isolated products)
7. Enable revenue tracking (measure ROI)

---

## Implementation Notes

### For Application Code
```typescript
// Query patterns for common operations
const user = await db
  .prepare('SELECT u.*, r.name as role_name FROM admin_users u JOIN admin_roles r ON u.role_id = r.id WHERE u.email = ?')
  .bind(email)
  .first();

const userPermissions = await db
  .prepare(`
    SELECT DISTINCT p.resource, p.action FROM admin_role_permissions rp
    JOIN admin_permissions p ON rp.permission_id = p.id
    WHERE rp.role_id = ?
  `)
  .bind(roleId)
  .all();

const canUser = (permissions: Permission[], action: string): boolean =>
  permissions.some(p => p.action === action);
```

### For Audit Logging
Every state change should log:
```typescript
await db.prepare(`
  INSERT INTO admin_audit_logs (id, user_id, action, resource_type, resource_id, changes, status)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).bind(
  id,
  userId,
  'email.resend',
  'email',
  emailId,
  JSON.stringify({ from: 'failed', to: 'queued' }),
  'success'
).run();
```

---

## Summary: What This Schema Enables

✅ **One Core, Many Revenue Surfaces**  
Shared infrastructure (identity, operations, analytics) supporting SaaS, consulting, APIs, resellers, affiliates, licensing

✅ **Controlled Diversification**  
Opportunity registry allows exploration without schema bloat; opportunities graduate from discovery → monetization

✅ **Complete Revenue Attribution**  
Generic revenue ledger supports all payment models; every dollar traceable to source, channel, asset, margin

✅ **Multi-Tenancy & Governance**  
Organizations, contractors, service accounts, RBAC, permission tracking, audit trails for compliance

✅ **Three-Tier Processing**  
Real-time (trading/Risk Radar), batch (analytics/reporting), multi-platform bridge (HostGator↔Cloudflare)

✅ **Extensible Without Overbuilding**  
New features added via extension tables; Phase 1 tables remain unchanged through Phase 4

✅ **Security by Default**  
Secrets never in plaintext, audit logs never hard-deleted, IP logging, contractor lifecycle, role-based access

✅ **Measurable Migration Path**  
HostGator remains accessible until Cloudflare proven sufficient; sync audit trail tracks every row moved

---

## Next Steps

**Before Release**:
1. [ ] **Review** this schema design — approve or request changes
2. [ ] **Create** the SQL migration file (0001_admin_schema.sql) with all table definitions
3. [ ] **Test** locally: `wrangler d1 execute PLATFORM_DB --file migration.sql --local`
4. [ ] **Deploy** to production via GitHub Actions PR gate
5. [ ] **Verify** all tables created and indexes built
6. [ ] **Document** in CLAUDE.md: active tables by phase, retention policies

**After Release (Phase 1)**:
- Apply D1 migration to production PLATFORM_DB
- Create test admin user and verify RBAC
- Monitor email queue and audit logs
- Run admin dashboard tests from ADMIN_ENDPOINT_TEST_PLAN.md

**Phase 2 Prep** (parallel):
- Design real-time event ingestion
- Set up analytics aggregation cron jobs (JOBS_QUEUE)
- Wire SEO data sources (Google Analytics, Search Console)

**Sign-Off**:
- Schema approved by: [_______________]
- Date: [_______________]
- Notes: [_______________]
