# Admin API Endpoint Test Plan

**Status**: Infrastructure deployed ✅ | Schema migration pending ⏳  
**Deployment**: gs-api commit 22279aa3 ✅ | gs-web commit 22279aa3 ✅

---

## Pre-Deployment Verification (COMPLETE)

### Health Check
```bash
curl -s https://api.goldshore.ai/health | jq .
```
**Result**: ✅ `200 OK`
```json
{
  "status": "ok",
  "service": "gs-api",
  "timestamp": "2026-08-16T04:59:26.927Z",
  "version": "v1"
}
```

### CF Access Authentication Gateway
```bash
curl -i https://api.goldshore.ai/admin/email/status
```
**Result**: ✅ `302 Found` (redirects to CF Access login)
- Proves auth middleware is active
- Proves route matching is working
- Proves Cloudflare Access integration is active

---

## Post-Migration Test Plan

### Step 1: Apply D1 Schema Migration

```bash
# Option A: Via Wrangler CLI (from goldshore-ai directory)
wrangler d1 execute PLATFORM_DB \
  --file apps/gs-api/src/migrations/0001_admin_schema.sql \
  --env prod

# Option B: Via Cloudflare Dashboard
# 1. Go to D1 → Databases → gs_platform_db
# 2. Click "Console"
# 3. Copy-paste entire 0001_admin_schema.sql
# 4. Execute
```

**Expected**: Tables created with 0 errors

### Step 2: Create Test Admin User

```bash
# Query D1 to insert test data
wrangler d1 execute PLATFORM_DB --command "
INSERT INTO admin_users (id, email, name, role, status)
VALUES (
  'user-' || hex(randomblob(8)),
  'admin@goldshore.ai',
  'Test Admin',
  'admin',
  'active'
)" --env prod
```

**Expected**: 1 row inserted

### Step 3: Test Protected Endpoints

#### 3a. List Email Queue Status
```bash
# Need valid CF Access JWT in header
curl -X GET https://api.goldshore.ai/admin/email/status \
  -H "CF-Access-Jwt-Assertion: <valid-jwt>" \
  -H "Content-Type: application/json"
```

**Expected Response** (200 OK):
```json
{
  "queued": 0,
  "sent": 0,
  "failed": 0,
  "total": 0
}
```

#### 3b. List Users
```bash
curl -X GET https://api.goldshore.ai/admin/users \
  -H "CF-Access-Jwt-Assertion: <valid-jwt>"
```

**Expected Response** (200 OK):
```json
{
  "items": [
    {
      "id": "user-...",
      "email": "admin@goldshore.ai",
      "name": "Test Admin",
      "role": "admin",
      "status": "active",
      "created_at": "2026-08-16T04:59:00Z"
    }
  ],
  "total": 1,
  "offset": 0,
  "limit": 50,
  "page": 1
}
```

#### 3c. Create New Admin User
```bash
curl -X POST https://api.goldshore.ai/admin/users \
  -H "CF-Access-Jwt-Assertion: <valid-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Admin",
    "email": "newadmin@goldshore.ai",
    "role": "moderator"
  }'
```

**Expected Response** (201 Created):
```json
{
  "success": true,
  "message": "User created",
  "user": {
    "id": "user-...",
    "email": "newadmin@goldshore.ai",
    "name": "New Admin",
    "role": "moderator",
    "status": "active"
  }
}
```

#### 3d. Email Management
```bash
# Get email logs
curl -X GET https://api.goldshore.ai/admin/email/logs \
  -H "CF-Access-Jwt-Assertion: <valid-jwt>"

# Get email templates
curl -X GET https://api.goldshore.ai/admin/email/templates \
  -H "CF-Access-Jwt-Assertion: <valid-jwt>"

# Create email template
curl -X POST https://api.goldshore.ai/admin/email/templates \
  -H "CF-Access-Jwt-Assertion: <valid-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome Email",
    "subject": "Welcome to Goldshore",
    "template": "<h1>Welcome!</h1>"
  }'
```

---

## Error Scenarios (Before Migration)

### Current State (Schema Not Yet Migrated)

**Request**:
```bash
curl -X GET https://api.goldshore.api/admin/users \
  -H "CF-Access-Jwt-Assertion: <valid-jwt>"
```

**Expected Error** (500 Internal Server Error):
```json
{
  "error": "Internal server error",
  "message": "Failed to get admin users: table admin_users does not exist"
}
```

**Why**: D1 tables haven't been created yet. The Worker code is correct, but the database schema is missing.

---

## Queue Integration Test

### Test Email Resend via Queue

**Scenario**: Manually insert email, then test resend endpoint

```bash
# 1. Insert test email into admin_emails
wrangler d1 execute PLATFORM_DB --command "
INSERT INTO admin_emails (
  id, email_to, subject, template, status
) VALUES (
  'email-' || hex(randomblob(8)),
  'test@goldshore.ai',
  'Test Email',
  '<p>Test content</p>',
  'failed'
)" --env prod

# 2. Get email ID from query
EMAIL_ID=$(wrangler d1 execute PLATFORM_DB --command "
  SELECT id FROM admin_emails LIMIT 1" --env prod)

# 3. Trigger resend
curl -X POST https://api.goldshore.ai/admin/email/logs/$EMAIL_ID/resend \
  -H "CF-Access-Jwt-Assertion: <valid-jwt>"

# 4. Check queue was processed
# (Look at Cloudflare Worker logs for queue consumer activity)
```

**Expected Flow**:
1. Email marked as `queued`
2. Message sent to `MAIL_JOBS_QUEUE`
3. Queue consumer picks up message
4. Email status updated based on send result

---

## Deployment Verification Checklist

- [x] Worker deploys successfully (commit 22279aa3)
- [x] Health endpoint returns 200 OK
- [x] CF Access gate active (302 redirect without JWT)
- [ ] D1 schema migration applied
- [ ] Create test admin user
- [ ] Test email status endpoint (GET)
- [ ] Test users list endpoint (GET)
- [ ] Test create user endpoint (POST)
- [ ] Test email templates endpoint (GET/POST)
- [ ] Test email resend endpoint (POST + queue integration)
- [ ] Test audit logs appear in admin_audit_logs table
- [ ] Test pagination (offset/limit parameters)
- [ ] Test error handling (invalid IDs, missing fields)

---

## How to Get CF Access JWT for Testing

### Option 1: Cloudflare Dashboard
1. Go to Access → Applications → api-production
2. Click "Settings"
3. Copy "Access Token" from JWT preview (if available)

### Option 2: Browser Console
1. Visit https://api.goldshore.ai/admin/dashboard
2. After logging in with CF Access, check cookies
3. Extract `CF_AppSession` token

### Option 3: Service Token (For Automation)
1. Go to Access → Service Tokens
2. Create new service token for api.goldshore.ai
3. Use returned Client ID and Secret in Authorization header:
```bash
curl -X GET https://api.goldshore.ai/admin/users \
  -H "CF-Access-Client-Id: <client-id>" \
  -H "CF-Access-Client-Secret: <client-secret>"
```

---

## Performance Baselines

After full deployment, expected response times:

| Endpoint | Method | Expected Time | Notes |
|----------|--------|---------------|-------|
| `/admin/users` | GET | <100ms | 50 users per page |
| `/admin/email/logs` | GET | <150ms | Indexed by created_at |
| `/admin/entries` | GET | <100ms | Indexed by status |
| `/admin/users` | POST | <50ms | Insert + audit log |
| `/admin/email/logs/:id/resend` | POST | <50ms | Queue operation async |

---

**Next Action**: Apply D1 schema migration and repeat tests with valid JWT
