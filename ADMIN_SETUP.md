# Admin Dashboard Setup Guide

This guide covers the complete setup for the GoldShore admin dashboard including authentication, secrets, and database configuration.

## Overview

The admin dashboard consists of:
- **Backend**: `/api/admin/*` routes in `apps/gs-api` (gs-api Worker)
- **Frontend**: `/admin/*` pages in `apps/gs-web` (gs-web Astro app)
- **Database**: D1 PLATFORM_DB with admin schema
- **Auth**: Cloudflare Access (JWT validation)

## Step 1: Cloudflare Access Configuration

Admin routes require Cloudflare Access JWT authentication. Ensure the following are set in Cloudflare dashboard:

### For `gs-api` Worker (api.goldshore.ai)

**Environment: prod**

Required environment variables (in Cloudflare dashboard):
```
CLOUDFLARE_TEAM_DOMAIN = "goldshore.cloudflareaccess.com"
CLOUDFLARE_ACCESS_AUDIENCE = "8510d42c31fc791e295427031ffeef7c7ebc0f1b62d8634fbb284bf82562f528"
CLOUDFLARE_ACCESS_APPLICATION = "api-production"
```

### For `gs-web` Worker (goldshore.ai)

**Environment: prod**

Required environment variables (in Cloudflare dashboard):
```
CLOUDFLARE_TEAM_DOMAIN = "goldshore.cloudflareaccess.com"
CLOUDFLARE_ACCESS_AUDIENCE = "c520a7647223b49b20fbe5be240772863eb684b97b57c08955b6104c58170db9"
CLOUDFLARE_ACCESS_APPLICATION = "admin-production"
```

## Step 2: Set Required Secrets

**Set these in Cloudflare dashboard → gs-api Worker → Settings → Secrets:**

### Required for All Operations

- **CLOUDFLARE_ACCOUNT_ID** - Your Cloudflare account ID (from dash.cloudflare.com)
  - Required for: Worker management, DNS operations, API access
  - Format: 32-character hex string
  - Example: `f77de112d2019e5456a3198a8bb50bd2`

- **CF_API_TOKEN** - Cloudflare API token with Worker/DNS/KV permissions
  - Required for: Admin dashboard Worker operations
  - Create at: https://dash.cloudflare.com/profile/api-tokens
  - Permissions needed:
    - Workers Scripts (Edit)
    - Worker Routes (Edit)
    - Workers KV Storage (Edit)
    - Zone Settings (Read)

- **GITHUB_API_TOKEN** - GitHub personal access token
  - Required for: Repository health checks, merge cockpit, framework search
  - Create at: https://github.com/settings/tokens
  - Permissions needed: `public_repo` scope minimum

### Optional for Specific Features

- **ANTHROPIC_API_KEY** - Anthropic Claude API key
  - Required for: Framework ranking, AI analysis
  - Get from: https://console.anthropic.com
  - Used in: `/admin/search` (framework search with Claude ranking)

- **GOOGLE_ADMIN_SERVICE_ACCOUNT** - Google Workspace service account JSON (if using RBAC)
  - Required for: Workspace RBAC sync
  - Only if `GOOGLE_WORKSPACE_SYNC_ENABLED = "true"` in vars
  - Currently disabled (set to `"false"`)

- **CONTROL_SYNC_TOKEN** - Internal token for control system sync
  - Required for: Cross-system synchronization
  - Generate with: `crypto.randomUUID()`

## Step 3: Database Setup

### Create D1 Database

Run in terminal:
```bash
wrangler d1 create gs_platform_db --database-id 9703574e-adb7-481e-8d98-96f8ce5f8a90
```

Or verify existing database exists with ID: `9703574e-adb7-481e-8d98-96f8ce5f8a90`

### Apply Migration

Execute the admin schema migration in Cloudflare D1 dashboard or via CLI:

```bash
wrangler d1 execute PLATFORM_DB --file ./src/migrations/0001_admin_schema.sql --remote
```

This creates all required tables:
- Admin roles & permissions
- Admin users
- Admin entries (leads/contacts)
- Email templates & logs
- Settings & secrets
- Audit logs
- Analytics tables
- Subscription tiers
- Data sync tracking

## Step 4: Deploy Workers

### Deploy gs-api (Backend)

```bash
cd apps/gs-api
wrangler deploy --env prod
```

Verify deployment:
```bash
curl https://api.goldshore.ai/health
```

### Deploy gs-web (Frontend)

```bash
cd apps/gs-web
wrangler deploy --env prod
```

Verify deployment:
```bash
curl https://goldshore.ai/admin/dashboard
```

## Step 5: Access Admin Dashboard

### Via Cloudflare Access Login

1. Navigate to: https://goldshore.ai/admin/dashboard
2. You'll be redirected to Cloudflare Access login
3. Sign in with your credentials
4. You'll receive a JWT token valid for 24 hours
5. This JWT is automatically sent with all API requests

### Test Authentication

```bash
# Get JWT token (login via browser first)
# Then test API endpoint:
curl https://api.goldshore.ai/admin/email \
  -H "Cookie: CF_Authorization=<your-jwt-token>"
```

## Step 6: Verify Admin Features

### Email Management
```
GET /api/admin/email - List all emails
POST /api/admin/email/send - Send new email
```
Frontend: https://goldshore.ai/admin/email

### Lead Entries
```
GET /api/admin/entries - List all contact form submissions
POST /api/admin/entries - Create new entry
```
Frontend: https://goldshore.ai/admin/entries

### User Management
```
GET /api/admin/users - List admin users by role
POST /api/admin/users - Add new admin user
```
Frontend: https://goldshore.ai/admin/users

### Settings
```
GET /api/admin/settings - Get platform settings
PUT /api/admin/settings - Update settings
```
Frontend: https://goldshore.ai/admin/settings

## Troubleshooting

### "Failed to fetch" Errors

**Cause 1: Missing Cloudflare Access configuration**
- Solution: Verify CLOUDFLARE_ACCESS_AUDIENCE and CLOUDFLARE_ACCESS_APPLICATION are set in both apps

**Cause 2: Missing secrets in Cloudflare**
- Solution: Add CLOUDFLARE_ACCOUNT_ID, CF_API_TOKEN, GITHUB_API_TOKEN to gs-api secrets

**Cause 3: D1 database not initialized**
- Solution: Verify PLATFORM_DB binding exists and run migration

**Cause 4: JWT expired**
- Solution: Revisit goldshore.ai/admin/* to get fresh JWT token (valid 24 hrs)

### Database Connection Issues

```bash
# Test database directly
wrangler d1 execute PLATFORM_DB --command "SELECT * FROM admin_roles;" --remote
```

### Worker Deployment Issues

```bash
# Validate wrangler config
wrangler publish --dry-run

# Check worker logs
wrangler tail
```

## Configuration Files Reference

### apps/gs-api/wrangler.toml
- Defines PLATFORM_DB, AUDIT_DB, SIGNALS_DB, JOBS_DB bindings
- Defines KV, R2, Queues bindings
- Lists required secrets (see Step 2)
- Routes: api.goldshore.ai, agent.goldshore.ai, mail.goldshore.ai, etc.

### apps/gs-web/wrangler.toml
- Defines SESSION KV binding
- No database or secrets (all data access via gs-api)
- Routes: goldshore.ai, admin.goldshore.ai, www.goldshore.ai, etc.

## Database Schema

The admin schema includes:

### Authentication & Authorization
- `admin_roles` - Role definitions (Admin, Moderator, Viewer)
- `admin_permissions` - Permission definitions
- `admin_role_permissions` - RBAC mapping
- `admin_users` - Admin user accounts

### Core Operations
- `admin_entries` - Contact form submissions / leads
- `admin_email_templates` - Email templates
- `admin_settings` - Platform configuration
- `admin_secrets` - Encrypted configuration values

### Monitoring & Audit
- `admin_audit_logs` - Audit trail of all admin actions
- `admin_permission_changes` - Track permission modifications

### Analytics & Data
- `analytics_events` - Real-time event stream
- `analytics_hourly` - Hourly aggregations
- `analytics_daily` - Daily aggregations
- `analytics_monthly` - Monthly aggregations

### Business Features
- `subscription_tiers` - Subscription plan definitions
- `user_subscriptions` - User subscription assignments
- `revenue_events` - Monetization tracking

See `src/migrations/0001_admin_schema.sql` for complete schema.

## Next Steps

1. ✅ Complete Steps 1-6 above
2. 🔄 Test all admin features from the dashboard
3. 📊 Monitor admin_audit_logs for activity
4. 🔑 Rotate secrets quarterly
5. 📈 Phase 2: Add Worker management UI
6. 📋 Phase 3: Add workflow builders (leads, email, data sync)

## Support

For issues:
1. Check Cloudflare Worker logs: `wrangler tail`
2. Review D1 database status: Cloudflare dashboard → D1
3. Verify Cloudflare Access configuration: Dashboard → Access → Applications
4. Check browser DevTools Network tab for auth headers
