# Admin Dashboard Setup Checklist

Complete these steps to fully activate the admin dashboard.

## Phase 1: Secrets Configuration (15 min)

### Get Your Credentials

- [ ] **Cloudflare Account ID**
  - Go to: https://dash.cloudflare.com
  - Look for "Account ID" in the right sidebar
  - Copy the 32-character hex value
  - Store securely

- [ ] **Cloudflare API Token**
  - Go to: https://dash.cloudflare.com/profile/api-tokens
  - Click "Create Token"
  - Choose "Custom token"
  - Permissions needed:
    - ✅ Workers Scripts - Edit
    - ✅ Worker Routes - Edit  
    - ✅ Workers KV Storage - Edit
    - ✅ Zone Settings - Read
  - TTL: 1 year or custom
  - Copy token immediately (only shown once)

- [ ] **GitHub API Token**
  - Go to: https://github.com/settings/tokens
  - Click "Generate new token (classic)"
  - Scopes: `public_repo` (minimum)
  - Copy token immediately

### Set Secrets in Cloudflare Dashboard

1. Go to: https://dash.cloudflare.com → Workers → gs-api → Settings → Secrets
2. Add each secret (click "Add secret"):

| Secret Name | Value | Status |
|-------------|-------|--------|
| CLOUDFLARE_ACCOUNT_ID | (from step 1) | [ ] |
| CF_API_TOKEN | (from step 2) | [ ] |
| GITHUB_API_TOKEN | (from step 3) | [ ] |
| CONTROL_SYNC_TOKEN | `550e8400-e29b-41d4-a716-446655440000` (example UUID) | [ ] |

**Note**: These secrets are NOT stored in git (see `wrangler.toml` comments - they're production-only).

## Phase 2: Database Setup (5 min)

### Verify D1 Database Exists

```bash
# Check if PLATFORM_DB exists
wrangler d1 list --remote

# Should show:
# Name: gs_platform_db
# ID: 9703574e-adb7-481e-8d98-96f8ce5f8a90
```

- [ ] D1 PLATFORM_DB exists with correct ID: `9703574e-adb7-481e-8d98-96f8ce5f8a90`

### Apply Migration

```bash
cd apps/gs-api

# Execute migration (creates all admin tables)
wrangler d1 execute PLATFORM_DB --file ./src/migrations/0001_admin_schema.sql --remote
```

- [ ] Migration executed successfully
- [ ] Check Cloudflare D1 dashboard - should see 30+ new tables

### Verify Schema

```bash
# List tables
wrangler d1 execute PLATFORM_DB --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" --remote

# Should include:
# - admin_roles
# - admin_users
# - admin_entries
# - admin_email_templates
# - admin_settings
# - admin_audit_logs
# - analytics_events
# - subscription_tiers
# ... and more
```

- [ ] All tables created successfully

## Phase 3: Deploy Workers (10 min)

### Deploy gs-api (Backend)

```bash
cd apps/gs-api

# Verify config
wrangler publish --dry-run

# Deploy to production
wrangler deploy --env prod
```

Wait for deployment to complete:
```bash
# Test API is running
curl https://api.goldshore.ai/health -i

# Should return 200 OK
```

- [ ] gs-api deployed successfully
- [ ] Health endpoint responds with 200 OK

### Deploy gs-web (Frontend)

```bash
cd apps/gs-web

# Build Astro SSR
pnpm run build

# Deploy to production
wrangler deploy --env prod
```

Wait for deployment to complete:
```bash
# Test website is running
curl https://goldshore.ai -i

# Should return 200 OK (redirects to /admin if not authenticated)
```

- [ ] gs-web deployed successfully
- [ ] Website responds with 200 OK

## Phase 4: Access Admin Dashboard (5 min)

### Login via Cloudflare Access

1. Open browser → https://goldshore.ai/admin/dashboard
2. You'll be redirected to Cloudflare Access login
3. Sign in with your email (must be authorized in CF Access policy)
4. Accept permission prompt
5. You'll receive a JWT token (cookie) valid for 24 hours

- [ ] Can log in to admin dashboard
- [ ] See "Welcome to Admin Dashboard" page
- [ ] Navigation menu appears (Email, Leads, Users, Settings)

### Test Each Admin Feature

#### Email Management
```
URL: https://goldshore.ai/admin/email
```
- [ ] Page loads (no "Failed to fetch" error)
- [ ] "Send Email" button is clickable
- [ ] Email list displays (if any emails exist)

#### Lead Entries
```
URL: https://goldshore.ai/admin/entries
```
- [ ] Page loads
- [ ] "New Entry" button is clickable
- [ ] Entries list displays (if any exist)

#### User Management
```
URL: https://goldshore.ai/admin/users
```
- [ ] Page loads
- [ ] "Add User" button is clickable
- [ ] Admin users list displays

#### Settings
```
URL: https://goldshore.ai/admin/settings
```
- [ ] Page loads
- [ ] Can view current platform settings
- [ ] "Save Settings" button is clickable

### Quick API Test

```bash
# Get JWT token from browser (save from cookie)
# Then test an API endpoint:

curl https://api.goldshore.ai/admin/email \
  -H "Cookie: CF_Authorization=<paste-jwt-token-here>" \
  -H "Content-Type: application/json" \
  -i

# Should return 200 with JSON response:
# {"data":[], "total":0}
```

- [ ] API endpoints respond with valid JSON
- [ ] No 401 Unauthorized errors
- [ ] No 503 Service Unavailable errors

## Phase 5: Troubleshooting (as needed)

### "Failed to fetch" Errors

**Cause**: Cloudflare Access not configured or JWT expired

**Fix**:
1. Verify CLOUDFLARE_ACCESS_AUDIENCE and CLOUDFLARE_ACCESS_APPLICATION are set in vars (wrangler.toml)
2. Sign out and log back in to get fresh JWT token
3. Check browser DevTools → Application → Cookies → CF_Authorization should exist
4. Try incognito/private window

- [ ] Verified env vars are set
- [ ] Re-authenticated to get fresh JWT

### Worker Deployment Failed

**Fix**:
```bash
# Check for errors
wrangler publish --dry-run

# Review logs
wrangler tail

# Check if secrets are set in dashboard
# (wrangler.toml only lists bindings, not secrets)
```

- [ ] Checked wrangler.toml syntax
- [ ] Verified all required secrets in Cloudflare dashboard
- [ ] Reviewed worker logs for errors

### Database Tables Missing

**Fix**:
```bash
# Check if migration executed
wrangler d1 execute PLATFORM_DB --command "SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table';" --remote

# Re-run migration if needed
wrangler d1 execute PLATFORM_DB --file ./src/migrations/0001_admin_schema.sql --remote
```

- [ ] Verified tables exist in D1
- [ ] Re-ran migration if needed

### Can't Access Cloudflare Access Login

**Cause**: Email not authorized in CF Access policy

**Fix**:
1. Go to: https://dash.cloudflare.com → Access → Applications → admin-production
2. Edit "admin-production" application
3. Add your email to allowed users/groups
4. Save and reload

- [ ] Email added to CF Access policy
- [ ] Reloaded and can see CF Access login page

## Phase 6: Post-Setup (Ongoing)

### Monthly Tasks

- [ ] Review admin_audit_logs in database
- [ ] Update admin users as needed
- [ ] Rotate secrets (generate new tokens every 90 days)
- [ ] Check analytics_events for usage patterns

### Monitoring

- [ ] Set up alerts for gs-api errors in Cloudflare Workers Analytics
- [ ] Monitor D1 database performance (Cloudflare dashboard → D1)
- [ ] Review CF Access login attempts (Security → Logs)

### Next Features to Build (Phase 2+)

- [ ] Worker management UI (create/edit/delete workers from admin)
- [ ] Secret rotation tool
- [ ] API key management
- [ ] Workflow builder (leads, email, data sync)
- [ ] Advanced analytics dashboard

## Done! ✅

Once you've completed all checkboxes above, the admin dashboard is fully operational.

**Need help?**
- Check: `/home/user/goldshore-ai/ADMIN_SETUP.md` for detailed info
- Review: `apps/gs-api/src/routes/admin/*` for backend implementation
- Review: `apps/gs-web/src/pages/admin/*` for frontend implementation
- Check worker logs: `wrangler tail` (from within app directory)
- Test endpoints: See "API Test" section in ADMIN_SETUP.md
