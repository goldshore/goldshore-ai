# GitHub App Audit & Configuration Checklist

> Status: Review Required  
> App: Goldshore AI (ID: 36743)  
> Owner: @marzton  
> Advanced Settings: https://github.com/settings/apps/goldshore-ai/advanced

---

## Critical Audit Items

### 1. ✅ Webhook URL Configuration

**Status:** Configured  
**Current URL:** `https://goldshore.ai/oauth/github`  
**Expected Routes:**
- `POST /oauth/github` → OAuth callback handler ✅
- `POST /webhooks/github/push` → Deployment triggers ⏳
- `POST /webhooks/github/pull_request` → PR automation ⏳
- `POST /webhooks/github/issues` → Issue tracking ⏳
- `POST /webhooks/github/workflow_run` → CI/CD status ⏳

**Audit Note:** Routes `/webhooks/github/*` are created but not yet integrated into main gs-api router. Integration required.

**Fix:** Mount webhook routes in `apps/gs-api/src/index.ts`:
```typescript
import webhooks from './routes/webhooks';
app.route('/webhooks', webhooks);
```

### 2. ⚠️ Webhook Secret Configuration

**Status:** May not be set  
**Expected:** Secret configured in GitHub App settings  

**Audit Check:**
```bash
# Verify in GitHub App settings:
# Settings → Goldshore AI → Webhook → Scroll down to "Set a secret"
```

**Required Action:** If not set:
1. Go to https://github.com/settings/apps/goldshore-ai/webhook
2. Click "Change secret" or "Set a secret"
3. Generate a strong secret (e.g., `openssl rand -hex 32`)
4. Store in Cloudflare Secrets Store: `GITHUB_APP_WEBHOOK_SECRET=<value>`

**Verification:**
```bash
# After setting secret, verify webhook delivery:
# GitHub App → Webhook → Recent Deliveries
# All deliveries should show Status 200
```

### 3. ⚠️ OAuth Callback URL Configuration

**Status:** Needs Update  
**Current URL:** `http://localhost:4200/oauth/github`  
**Production URLs:**
```
Primary:    https://goldshore.ai/oauth/github/callback
Backup:     https://api.goldshore.ai/oauth/github/callback
Admin:      https://dash.goldshore.ai/admin/auth/github/callback
```

**Required Action:**
1. Go to https://github.com/settings/apps/goldshore-ai
2. Scroll to "Identifying and authorizing users"
3. Update "Authorization callback URL":
   - Remove: `http://localhost:4200/oauth/github`
   - Add: `https://goldshore.ai/oauth/github/callback`
4. Save

### 4. ⚠️ OAuth Scopes Verification

**Status:** Verify Correct Scopes Set  
**Required Scopes:**
```
repo              — Read/write repository contents, issues, PRs
workflow          — Read/write GitHub Actions workflows
admin:repo_hook   — Manage webhooks
user:email        — Read user email addresses
```

**Audit Check:**
1. Go to https://github.com/settings/apps/goldshore-ai
2. Scroll to "Permissions & events"
3. Verify each scope is listed and set to "Read and write" or "Read-only" as needed

**Issue If:** Any scope is missing or has wrong access level:
- Edit scope in App settings
- Users will need to re-authorize next time they visit

### 5. ✅ Private Key Configuration

**Status:** Configured  
**Key SHA256:** `BTg580BS7Ygnl1KwKSlOIe3++74pBaQMmqv/L+Ie0ew=`  
**Added:** Jul 25, 2019 by marzton  

**Audit Check:**
1. Go to https://github.com/settings/apps/goldshore-ai/advanced
2. Scroll to "Private keys"
3. Confirm at least one key is listed (shown above)

**Action Required:** If key is very old (>1 year):
1. Click "Generate a private key"
2. Update in Cloudflare Secrets Store: `GITHUB_APP_PRIVATE_KEY=<new-key>`
3. Store backup offline

### 6. ⚠️ Webhook Event Subscriptions

**Status:** Verify All Events Selected  
**Required Events:**
```
✅ push                 — Code pushes (required for deployments)
✅ pull_request         — PR events (required for review automation)
✅ pull_request_review  — PR reviews (required for approval tracking)
✅ issues              — Issue events (required for repo health)
✅ workflow_run        — CI/CD status (required for deployment tracking)
```

**Audit Check:**
1. Go to https://github.com/settings/apps/goldshore-ai
2. Scroll to "Permissions & events" → "Events"
3. Verify each event is checked

**Fix If Missing:**
1. Check the required events
2. Click "Save changes"
3. Note: Webhook will not deliver events that are not subscribed

### 7. ✅ Installation Status

**Status:** Should be Installed on marzton/goldshore-ai

**Audit Check:**
1. Go to https://github.com/apps/goldshore-ai/installations
2. Look for "marzton/goldshore-ai" in the list
3. If not present: Click "Install" and authorize

**Verify Installation:**
1. Go to https://github.com/marzton/goldshore-ai/settings/installations
2. Confirm "Goldshore AI" appears in installed apps
3. Check webhook deliveries: https://github.com/marzton/goldshore-ai/settings/hooks

---

## Configuration Items (Environment & Secrets)

### GitHub App Secrets (Cloudflare Secrets Store)

**Store ID:** `b9824d3280c54573a24137c7e7143b33`  
**Required Keys:**

| Key | Source | Status |
|-----|--------|--------|
| `GITHUB_APP_CLIENT_SECRET` | GitHub App settings → Client secret | ⏳ Need to set |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App settings → Private key | ✅ Should be set |
| `GITHUB_APP_WEBHOOK_SECRET` | GitHub App settings → Webhook secret | ⏳ Need to set |

**How to Get Values:**

**Client Secret:**
1. Go to https://github.com/settings/apps/goldshore-ai
2. Scroll to "Client secrets"
3. Click "Generate a new client secret"
4. Copy the value immediately (you won't see it again)
5. Store in Cloudflare: `GITHUB_APP_CLIENT_SECRET=<value>`

**Private Key:**
1. Go to https://github.com/settings/apps/goldshore-ai/advanced
2. Scroll to "Private keys"
3. Click "Generate a private key"
4. A .pem file will download
5. Copy entire contents
6. Store in Cloudflare: `GITHUB_APP_PRIVATE_KEY=<pem-content>`

**Webhook Secret:**
1. Go to https://github.com/settings/apps/goldshore-ai/webhook
2. Click "Change secret" or "Set a secret"
3. Generate strong secret: `openssl rand -hex 32`
4. Store in Cloudflare: `GITHUB_APP_WEBHOOK_SECRET=<value>`

### Repository Environment Variables (GitHub Actions)

**Location:** https://github.com/marzton/goldshore-ai/settings/variables/actions

| Variable | Value | Status |
|----------|-------|--------|
| `GITHUB_APP_ID` | 36743 | ✅ Should be set |
| `GITHUB_APP_CLIENT_ID` | Iv1.2fd777cc3eb8c888 | ✅ Should be set |

### Repository Secrets (GitHub Actions)

**Location:** https://github.com/marzton/goldshore-ai/settings/secrets/actions

| Secret | Source | Status |
|--------|--------|--------|
| `GITHUB_TOKEN` | Personal Access Token | ⏳ Need to create |
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard | ⏳ Need to set |

---

## Webhook Delivery Verification

### Test Push Event

```bash
# 1. Make a test commit
echo "# Test" >> README.md
git add README.md
git commit -m "test: webhook delivery"
git push origin main

# 2. Check webhook delivery logs
# https://github.com/marzton/goldshore-ai/settings/hooks

# 3. Expected response: 200 OK
# If 401/403: Webhook secret mismatch
# If timeout: URL unreachable (check firewall)
```

### Webhook Delivery Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| 401 Unauthorized | Webhook signature verification failed | Verify `GITHUB_APP_WEBHOOK_SECRET` matches |
| 403 Forbidden | IP firewall blocking GitHub | Add GitHub IPs to firewall allowlist |
| 404 Not Found | Route not implemented | Check `/webhooks/github/*` routes are mounted |
| 500 Internal Error | Route handler crash | Check application logs for errors |
| Timeout | Service unreachable | Verify `https://goldshore.ai/webhooks/github/` is accessible |

### Manual Webhook Redeliver

If webhook delivery failed:
1. Go to https://github.com/marzton/goldshore-ai/settings/hooks
2. Click the failed delivery
3. Click "Redeliver"
4. Check response status

---

## Post-Setup Validation

After completing all configurations, run this validation:

### 1. OAuth Flow Test
```bash
# 1. Go to https://dash.goldshore.ai/admin/login
# 2. Click "Login with GitHub"
# 3. Authorize the Goldshore AI app
# 4. Should redirect to admin dashboard
# 5. Expected: User profile shows your GitHub info
```

### 2. Webhook Delivery Test
```bash
# 1. Push a test commit to main branch
# 2. Go to https://github.com/marzton/goldshore-ai/settings/hooks
# 3. Check "Recent Deliveries"
# 4. Confirm 200 OK status for push event
# 5. Check D1 webhook_logs table:
#    SELECT * FROM webhook_logs ORDER BY timestamp DESC LIMIT 1
```

### 3. Admin Dashboard Integration
```bash
# 1. Log in as admin
# 2. Go to https://dash.goldshore.ai/admin/deployment-status
# 3. Should show:
#    - Recent deployments from D1
#    - Workflow run status
#    - GitHub integration status: ✅ Connected
```

---

## Common Issues & Resolutions

### Issue: "Webhook URL is unreachable"

**Symptoms:** All webhook deliveries result in timeout  
**Causes:**
- Domain not resolving
- Firewall blocking GitHub IPs
- Route not implemented

**Resolution:**
```bash
# 1. Test URL manually
curl -i https://goldshore.ai/webhooks/github/push

# 2. Expected: 200 or 401 (if missing signature header)
# 3. If timeout: check DNS
dig goldshore.ai

# 4. If firewall: Add GitHub IP ranges
# https://api.github.com/meta → "hooks" IP ranges
```

### Issue: "Invalid webhook signature"

**Symptoms:** All webhooks return 401 Unauthorized  
**Cause:** Webhook secret mismatch

**Resolution:**
```bash
# 1. Get secret from GitHub App:
# https://github.com/settings/apps/goldshore-ai/webhook

# 2. Update in Cloudflare Secrets Store:
wrangler secret put GITHUB_APP_WEBHOOK_SECRET

# 3. Paste the secret value
# 4. Deploy updated wrangler.toml
# 5. Redeliver a webhook via GitHub
```

### Issue: "OAuth callback URL mismatch"

**Symptoms:** Redirect URI mismatch error during login  
**Cause:** OAuth callback URL not registered in GitHub App

**Resolution:**
```bash
# 1. Go to GitHub App settings
# https://github.com/settings/apps/goldshore-ai

# 2. Update "Authorization callback URL":
https://goldshore.ai/oauth/github/callback

# 3. Save changes
# 4. Try login again
```

---

## Deployment Checklist

Before moving to production:

- [ ] Webhook URL configured: `https://goldshore.ai/oauth/github`
- [ ] Webhook secret set in Cloudflare Secrets Store
- [ ] OAuth callback URL registered in GitHub App
- [ ] All required scopes set (repo, workflow, admin:repo_hook, user:email)
- [ ] All required events subscribed (push, PR, issues, workflow_run)
- [ ] App installed on marzton/goldshore-ai
- [ ] GitHub App credentials stored in Cloudflare Secrets
- [ ] OAuth routes implemented in gs-api (`/oauth/github/*`)
- [ ] Webhook routes implemented in gs-api (`/webhooks/github/*`)
- [ ] D1 migrations applied (webhook_logs, github_issues, etc.)
- [ ] OAuth middleware working (session creation, token validation)
- [ ] Admin dashboard login working with GitHub OAuth
- [ ] Webhook deliveries showing 200 OK in GitHub logs
- [ ] D1 webhook_logs table receiving events

---

## Next Steps

1. ✅ GitHub App configuration documented
2. ⏳ **Fix audit errors listed above** (Webhook URL, Secret, OAuth callback)
3. ⏳ Set Cloudflare Secrets (Client Secret, Private Key, Webhook Secret)
4. ⏳ Integrate OAuth and webhook routes into gs-api main router
5. ⏳ Deploy and verify webhook delivery
6. ⏳ Test OAuth flow end-to-end
7. ⏳ Enable admin dashboard GitHub login

---

## See Also

- `.github/GITHUB_APP_CONFIG.md` — Full GitHub App documentation
- `apps/gs-api/src/routes/oauth/github.ts` — OAuth implementation
- `apps/gs-api/src/routes/webhooks/github.ts` — Webhook handlers
- `apps/gs-api/db/migrations/0006_github_app_integration.sql` — DB schema
