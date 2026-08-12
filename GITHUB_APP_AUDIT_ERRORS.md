# GitHub App Audit Errors - Resolution Guide

> Reference: https://github.com/settings/apps/goldshore-ai/advanced  
> User: @marzton  
> Date: 2026-08-09

---

## Summary of Audit Errors

The GitHub App "Goldshore AI" (ID: 36743) has configuration gaps that prevent proper integration with the repository. These errors appear in GitHub App settings → Advanced tab.

### Error Categories

1. **Webhook Configuration Issues** — URL, Secret, Event subscriptions
2. **OAuth Configuration Issues** — Callback URL, Scopes
3. **Permission Issues** — Missing required scopes or API tokens
4. **Installation Issues** — App not installed on target repository

---

## Specific Errors & Fixes

### Error #1: Webhook URL Unverified

**Status:** ⚠️ Critical  
**Location:** GitHub App settings → Webhook → Webhook URL  
**Current Setting:** `https://goldshore.ai/oauth/github`

**Problem:**
- URL is reachable but routes `/webhooks/github/*` are not yet implemented
- GitHub cannot deliver webhook events to non-existent endpoints

**Root Cause:**
- OAuth route implemented: `/oauth/github` ✅
- Webhook routes created but not mounted in gs-api main router ❌

**Fix Required:**

1. **Update gs-api main router** (`apps/gs-api/src/index.ts`):

```typescript
import oauth from './routes/oauth';
import webhooks from './routes/webhooks';

// In main Hono app initialization:
app.route('/oauth', oauth);
app.route('/webhooks', webhooks);
```

2. **Verify routes are accessible:**

```bash
curl -X POST https://goldshore.ai/webhooks/github/push \
  -H "X-GitHub-Event: push" \
  -H "X-Hub-Signature-256: sha256=abc123"

# Expected: 401 Unauthorized (missing valid signature)
# This confirms the route exists and signature validation is running
```

3. **Deploy** `wrangler deploy --env prod`

---

### Error #2: Webhook Secret Not Set

**Status:** ⚠️ Critical  
**Location:** GitHub App settings → Webhook → "Set a secret"  
**Current Setting:** None (or outdated)

**Problem:**
- Without a secret, webhook signatures cannot be verified
- Makes webhooks vulnerable to spoofing
- Routes will reject all webhook deliveries

**Root Cause:**
- Webhook secret not generated and stored in Cloudflare Secrets Store
- Route handlers cannot verify `X-Hub-Signature-256` header

**Fix Required:**

1. **Generate a strong secret:**

```bash
# On any system with openssl
openssl rand -hex 32
# Output: abc123def456... (64-character hex string)

# Or use this Node.js one-liner:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

2. **Store in Cloudflare Secrets Store:**

```bash
# Login to Cloudflare dashboard or use wrangler
wrangler secret put GITHUB_APP_WEBHOOK_SECRET --env prod

# Paste the generated secret when prompted
```

3. **Update GitHub App settings:**
   - Go to: https://github.com/settings/apps/goldshore-ai/webhook
   - Scroll to "Set a secret" section
   - Click "Change secret" (if exists) or "Set a secret"
   - Paste the same secret you stored in Cloudflare
   - Click "Save webhook"

4. **Verify in webhook logs:**
   - Make a test push to the repository
   - Go to: https://github.com/marzton/goldshore-ai/settings/hooks
   - Check "Recent Deliveries"
   - Should show status 200 OK (not 401)

---

### Error #3: OAuth Callback URL Configuration

**Status:** ⚠️ High  
**Location:** GitHub App settings → "Authorization callback URL"  
**Current URL:** `http://localhost:4200/oauth/github` (incorrect)

**Problem:**
- Development URL in production app configuration
- OAuth flows will redirect users to non-existent localhost
- Causes "Redirect URL mismatch" errors during user login

**Root Cause:**
- Old development configuration not updated for production

**Fix Required:**

1. **Update GitHub App settings:**
   - Go to: https://github.com/settings/apps/goldshore-ai
   - Find "Identifying and authorizing users" section
   - Update "Authorization callback URL":
     - **Remove:** `http://localhost:4200/oauth/github`
     - **Add:** `https://goldshore.ai/oauth/github/callback`
   - Click "Save"

2. **Verify updated callback in route:**

```typescript
// In apps/gs-api/src/routes/oauth/github.ts
// Callback handler must match exactly:
github.get('/callback', async (c) => {
  // Route is at: /oauth/github/callback
  // Full URL: https://goldshore.ai/oauth/github/callback
  // ...
});
```

3. **Test OAuth flow:**

```bash
# 1. Go to https://dash.goldshore.ai/admin/login
# 2. Click "Login with GitHub"
# 3. Authorize the Goldshore AI app
# 4. Should redirect to /admin dashboard (not show error)
```

---

### Error #4: Missing or Incorrect Scopes

**Status:** ⚠️ Medium  
**Location:** GitHub App settings → Permissions & events

**Problem:**
- App may not have enough permissions to perform required actions
- Some webhook events may not be subscribed to
- Users may see permission prompts during login

**Required Scopes:**

| Scope | Why | Level |
|-------|-----|-------|
| `repo` | Read/write code, issues, PRs | Read & Write |
| `workflow` | Trigger/view GitHub Actions | Read & Write |
| `admin:repo_hook` | Receive webhooks | Read & Write |
| `user:email` | Get user email for admin login | Read-only |

**Fix Required:**

1. **Verify scopes in GitHub App:**
   - Go to: https://github.com/settings/apps/goldshore-ai
   - Scroll to "Permissions & events" → "Repository permissions"
   - Check each scope is set:

   - **Actions:** Read and write
   - **Administration:** Read-only (or Read & Write for branch protection)
   - **Contents:** Read and write
   - **Issues:** Read and write
   - **Metadata:** Read-only (required)
   - **Webhooks:** Read and write

   - Check "User permissions":
   - **Email addresses:** Read-only

2. **Subscribe to required events:**
   - Still under "Permissions & events" → "Subscribe to events"
   - Check these events:
     - ✅ Push
     - ✅ Pull request
     - ✅ Pull request review
     - ✅ Issues
     - ✅ Workflow run

3. **Save changes** and reinstall app if prompted

---

### Error #5: App Not Installed on Repository

**Status:** ⏳ Check Required  
**Location:** https://github.com/apps/goldshore-ai/installations

**Problem:**
- App must be installed on the specific repository
- Without installation, webhooks won't deliver to that repo
- OAuth tokens won't have access to repo

**Verification Steps:**

1. **Check if installed:**
   - Go to: https://github.com/marzton/goldshore-ai/settings/installations
   - Look for "Goldshore AI" in the list
   - If present: ✅ Already installed
   - If not present: ⏳ Need to install

2. **If not installed, install it:**
   - Go to: https://github.com/apps/goldshore-ai
   - Click "Install"
   - Select "marzton" account
   - Select "goldshore-ai" repository
   - Authorize requested permissions
   - Click "Install"

3. **Verify webhook configuration:**
   - Go to: https://github.com/marzton/goldshore-ai/settings/hooks
   - Should see "Goldshore AI" webhook listed
   - Click it to see recent deliveries

---

## Validation Checklist

After applying all fixes above, verify:

- [ ] Webhook URL configured: `https://goldshore.ai/oauth/github`
- [ ] Webhook routes mounted in gs-api: `/webhooks/github/*`
- [ ] Webhook secret set in GitHub App settings
- [ ] Webhook secret stored in Cloudflare Secrets Store
- [ ] All required scopes set in GitHub App
- [ ] All required events subscribed in GitHub App
- [ ] OAuth callback URL: `https://goldshore.ai/oauth/github/callback`
- [ ] OAuth route implemented in gs-api: `/oauth/github/callback`
- [ ] App installed on marzton/goldshore-ai
- [ ] Webhook deliveries showing 200 OK in GitHub logs
- [ ] OAuth flow working end-to-end

---

## Testing GitHub App Integration

### Test 1: Webhook Delivery

```bash
# 1. Make a test commit
echo "test" >> README.md
git add README.md
git commit -m "test: webhook delivery verification"
git push origin main

# 2. Check webhook delivery in GitHub:
# https://github.com/marzton/goldshore-ai/settings/hooks
# Click "Goldshore AI" → "Recent Deliveries"
# Should show POST with Status 200 for "push" event

# 3. Verify in application logs:
# Check gs-api logs for webhook processing
# Expected: "Webhook received: push event, branch: main"
```

### Test 2: OAuth Flow

```bash
# 1. Open browser to admin login page
# https://dash.goldshore.ai/admin/login

# 2. Click "Login with GitHub"

# 3. You should be redirected to GitHub OAuth page:
# https://github.com/login/oauth/authorize?client_id=...

# 4. After authorizing, you should be redirected back to:
# https://goldshore.ai/oauth/github/callback

# 5. Session should be created in KV
# Expected: Logged in as your GitHub user in admin dashboard
```

### Test 3: Webhook Event Processing

```bash
# 1. Create a test issue
# https://github.com/marzton/goldshore-ai/issues/new
# Title: "[audit] Test issue for webhook"
# Labels: Add "audit" label

# 2. Watch webhook delivery:
# https://github.com/marzton/goldshore-ai/settings/hooks
# Recent Deliveries should show "issues" event with Status 200

# 3. Verify in database:
# SELECT * FROM webhook_logs WHERE event_type = 'issues' ORDER BY timestamp DESC LIMIT 1
# Should show the test event was received and logged
```

---

## Troubleshooting

### Webhook Returns 401 Unauthorized

**Cause:** Webhook secret mismatch  
**Solution:**
1. Verify secret in GitHub App matches Cloudflare Secrets Store
2. Check route handler verifies signature correctly
3. Redeliver webhook from GitHub to test

### Webhook Returns 404 Not Found

**Cause:** Routes not mounted in gs-api  
**Solution:**
1. Check `/webhooks/github/*` routes are registered
2. Verify `app.route('/webhooks', webhooks)` in main router
3. Deploy and test again

### OAuth Redirect URL Mismatch Error

**Cause:** Callback URL in GitHub App doesn't match route  
**Solution:**
1. Check GitHub App OAuth callback URL
2. Verify it matches route in `github.ts` exactly
3. Both must be: `https://goldshore.ai/oauth/github/callback`

### GitHub App Not Listed in Repository

**Cause:** App not installed on repo  
**Solution:**
1. Go to https://github.com/apps/goldshore-ai
2. Click "Install"
3. Select marzton/goldshore-ai
4. Authorize and confirm

---

## Deployment Sequence

When deploying fixes:

1. **Update gs-api code:**
   ```bash
   # Apply route integrations and D1 migrations
   git push origin claude/admin-dashboard-worker-route-t9vh7j
   ```

2. **Set Cloudflare Secrets:**
   ```bash
   wrangler secret put GITHUB_APP_CLIENT_SECRET --env prod
   wrangler secret put GITHUB_APP_WEBHOOK_SECRET --env prod
   # (Paste values when prompted)
   ```

3. **Deploy gs-api:**
   ```bash
   wrangler deploy --env prod
   ```

4. **Update GitHub App Settings:**
   - Callback URL: https://goldshore.ai/oauth/github/callback
   - Webhook Secret: Set to same value as GITHUB_APP_WEBHOOK_SECRET
   - Verify all scopes and events are checked

5. **Test end-to-end:**
   - Webhook delivery
   - OAuth login
   - D1 logging

---

## Success Criteria

After all fixes applied, verify:

- ✅ No errors in GitHub App Advanced settings
- ✅ Webhook deliveries showing 200 OK
- ✅ OAuth flow logs users in successfully
- ✅ D1 webhook_logs table contains recent events
- ✅ Admin dashboard accessible via GitHub login
- ✅ Deployment status page shows GitHub integration: Connected

---

## See Also

- `.github/GITHUB_APP_CONFIG.md` — Complete GitHub App documentation
- `infra/GITHUB_APP_AUDIT_CHECKLIST.md` — Detailed configuration checklist
- `apps/gs-api/src/routes/oauth/github.ts` — OAuth implementation
- `apps/gs-api/src/routes/webhooks/github.ts` — Webhook handlers
- GitHub App Dashboard: https://github.com/settings/apps/goldshore-ai
