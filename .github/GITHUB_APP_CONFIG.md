# Goldshore AI GitHub App Configuration

> App Name: Goldshore AI  
> App ID: 36743  
> Client ID: Iv1.2fd777cc3eb8c888  
> Owner: @marzton  
> Status: Repository webhooks active; application OAuth remains fail-closed until a dedicated client ID/secret is provisioned

---

## Overview

The **Goldshore AI** GitHub App enables:
- OAuth authentication for admin dashboard users
- Webhook-driven CI/CD triggers for deployments
- Automated issue/PR management and labeling
- Deployment status reporting to GitHub
- Audit logging and compliance tracking

---

## App Configuration

### Basic Information
```
Homepage URL:    https://mcp.goldshore.ai
Description:     Integrated AI platform for Goldshore infrastructure management
Private Key SHA: BTg580BS7Ygnl1KwKSlOIe3++74pBaQMmqv/L+Ie0ew=
```

### OAuth Configuration

**Callback URLs:**
```
Primary:  https://api.goldshore.ai/auth/github/callback
Setup:    https://mcp.goldshore.ai/setup
Redirect: https://dash.goldshore.ai/integrations/github
```

**Scopes:**
```
repo              (read/write repository contents, issues, PRs)
workflow          (read/write GitHub Actions workflows)
admin:repo_hook   (read/write repository webhooks)
admin:org_hook    (read/write organization webhooks)
user:email        (read user email)
```

### Webhook Configuration

**Webhook URLs:**
```
https://api.goldshore.ai/webhooks/github/push
https://api.goldshore.ai/webhooks/github/pull_request
https://api.goldshore.ai/webhooks/github/issues
https://api.goldshore.ai/webhooks/github/workflow_run
```

**Events Subscribed:**
- `push` — Code deployment triggers
- `pull_request` — PR lifecycle (opened, closed, synchronize)
- `pull_request_review` — Review events for approval workflows
- `issues` — Issue creation, closure, labeling
- `workflow_run` — GitHub Actions CI/CD status
- `release` — Release creation for prod deployments

**SSL Verification:** Enabled ✅

**Webhook Secret:** Stored as the `GS_GITHUB_WEBHOOK_SECRET` Worker secret and the same-named GitHub Actions repository secret

---

## Environment Variables & Secrets

### Required for Deployment

```bash
# GitHub App Credentials
GITHUB_APP_ID=36743
GITHUB_APP_CLIENT_ID=Iv1.2fd777cc3eb8c888
GITHUB_APP_CLIENT_SECRET=<stored-in-cloudflare-secrets>
GITHUB_APP_PRIVATE_KEY=<stored-in-cloudflare-secrets>
GS_GITHUB_WEBHOOK_SECRET=<stored-as-a-direct-worker-secret>

# OAuth Redirect
GITHUB_OAUTH_REDIRECT_URI=https://api.goldshore.ai/auth/github/callback

# Admin Dashboard
ADMIN_OAUTH_CALLBACK=https://dash.goldshore.ai/admin/auth/github/callback
```

### Storage Locations

- **Cloudflare Worker secrets** (`gs-api-prod`):
  - `GS_GITHUB_WEBHOOK_SECRET`
  - `GITHUB_CLIENT_SECRET` only after a dedicated OAuth client is approved

- **Repository Secrets** (GitHub Settings → Secrets → Actions):
  - `GITHUB_APP_ID`
  - `GITHUB_APP_CLIENT_ID`
  - `GITHUB_OAUTH_REDIRECT_URI`
  - `GS_GITHUB_WEBHOOK_SECRET`

- **Wrangler Environment** (apps/gs-api/wrangler.toml):
  - Secrets are direct Worker secrets; `INTEGRATION_MASTER_KEY` is not a Secrets Store object
  - Webhook signature verification reads `env.GS_GITHUB_WEBHOOK_SECRET`

---

## Routes implemented in gs-api

### 1. OAuth Flow Routes

**GET /auth/github/login**
- Initiates GitHub OAuth login flow
- Redirects user to GitHub authorization page with app scopes
- Query params: `redirect_to` (where to return after auth)

**GET /auth/github/callback**
- GitHub OAuth callback handler
- Exchange authorization code for access token
- Store token in KV with user session
- Redirect to dashboard or original URL

### 2. Webhook Handlers

**POST /webhooks/github/push**
- Triggered on code push to any branch
- Parse commit info, branch, author
- Log to D1 audit_logs
- Trigger deployment workflow if on main/preview

**POST /webhooks/github/pull_request**
- Triggered on PR events (open, close, sync)
- Auto-label by file changes (api, web, infra)
- Check branch protection rules
- Request review from CODEOWNERS

**POST /webhooks/github/issues**
- Triggered on issue lifecycle events
- Auto-label by severity/component
- Update D1 admin_cache with issue metadata
- Trigger repo health recalculation if [audit] label

**POST /webhooks/github/workflow_run**
- Triggered on GitHub Actions completion
- Log CI results to D1
- Post deployment status to issue/PR
- Notify admins of failures

---

## Admin Dashboard Integration

### OAuth Login Flow (gs-web)

**Pages/Routes:**
1. `admin.goldshore.ai/app/dashboard` — protected by the GoldShore Admin Cloudflare Access application
2. Cloudflare Access — primary Google/GitHub SSO and explicit-email admission policy
3. `/auth/github/*` — optional application OAuth; fails closed until dedicated credentials are configured

**Session Storage:**
- GitHub token stored in Cloudflare KV with TTL
- User profile cached in session cookie
- Permission checks via GitHub App installation on repo

### Deployment Status Page

**GET /admin/deployment-status**
- Queries GitHub App API for:
  - Recent workflow runs (CI/CD)
  - Deployment environments (prod/preview)
  - Branch protection rule status
  - Secret and environment variable summary

**Display Components:**
- Last 5 deployments with status badges
- Workflow run results (pass/fail)
- Environment secrets summary (not actual values)
- Branch protection enforcement status

---

## GitHub App Permissions Matrix

| Permission | Scope | Usage | Grant |
|-----------|-------|-------|-------|
| Repository Contents | `repo` | Read/write code, issues, PRs | ✅ Required |
| Actions | `workflow` | Trigger/view CI/CD pipelines | ✅ Required |
| Webhooks | `admin:repo_hook` | Receive deployment events | ✅ Required |
| User Email | `user:email` | Identify admin users | ✅ Required |
| Organization Hooks | `admin:org_hook` | Org-wide webhooks | ⏳ Optional |

---

## Installation on Repository

The GitHub App must be installed on the repository for webhooks to work:

1. Go to: https://github.com/apps/goldshore-ai/installations
2. Click "Install" on marzton/goldshore-ai
3. Grant permissions (repo, workflow, admin:repo_hook)
4. Confirm webhook delivery in GitHub App settings

**Verify Installation:**
1. Go to: https://github.com/marzton/goldshore-ai/settings/installations
2. Confirm "Goldshore AI" is listed as installed
3. Check webhook deliveries: https://github.com/marzton/goldshore-ai/settings/hooks

---

## Webhook Event Flow

```
GitHub Event (push/PR/issue)
    ↓
POST https://api.goldshore.ai/webhooks/github/<event_type>
    ↓
Verify Webhook Signature (X-Hub-Signature-256)
    ↓
Parse Event Payload
    ↓
Route to Handler (push → deployment, PR → review, etc.)
    ↓
Log to D1 audit_logs
    ↓
Update KV cache (deployment status, issue metadata)
    ↓
Post GitHub Status (commit status, PR comment, issue label)
```

---

## Deployment Workflow

### Code Push to Main

1. **Webhook Event:** `push` to `refs/heads/main`
2. **Handler:** `/webhooks/github/push`
3. **Actions:**
   - Parse commit SHA, message, author
   - Trigger GitHub Actions workflow (wrangler deploy)
   - Monitor workflow run via API
   - On success: Update deployment timestamp in D1
   - On failure: Post comment to related PR with error

### PR Review & Merge

1. **Webhook Event:** `pull_request` (opened)
2. **Handler:** `/webhooks/github/pull_request`
3. **Actions:**
   - Auto-label based on file changes
   - Request review from CODEOWNERS
   - Check branch protection (tests must pass)

4. **Webhook Event:** `workflow_run` (on CI completion)
5. **Actions:**
   - Post status to PR
   - Block merge if tests fail
   - Auto-merge if approved & all checks pass (optional)

### Release & Production Deploy

1. **Webhook Event:** `push` to `refs/heads/main` (post-merge)
2. **Handler:** Triggers GitHub Actions
3. **Workflow Steps:**
   - Run `wrangler deploy --env prod`
   - Post deployment status via GitHub API
   - Create GitHub Release
   - Notify admins in dashboard

---

## Testing Webhook Delivery

### Local Development (wrangler dev)

```bash
# 1. Get webhook URL from ngrok/cloudflared tunnel
ngrok http 8787
# → https://1234-5678.ngrok.io

# 2. Update GitHub App settings with local URL
# Settings → Webhook URL: https://1234-5678.ngrok.io/webhooks/github/push

# 3. Push to repo or create test PR
git push origin feature-branch

# 4. Check webhook delivery logs
# GitHub App → Webhook → Recent Deliveries
```

### Production Testing

```bash
# Check recent webhook deliveries
https://github.com/marzton/goldshore-ai/settings/hooks

# Redeliver failed webhooks
# Click webhook → Recent Deliveries → Redeliver
```

---

## Security Considerations

### Webhook Signature Verification

All webhooks must verify the `X-Hub-Signature-256` header:

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return `sha256=${hash}` === signature;
}
```

### Token Security

- GitHub App private key: Stored in Cloudflare Secrets Store, never committed
- User OAuth tokens: Stored in KV with short TTL (1 hour)
- Webhook secret: Rotated quarterly
- All secrets logged to audit_logs with hash only (never plaintext)

### Rate Limiting

- GitHub API: 5,000 requests/hour per token
- Webhook delivery: Rate limit to 100 req/min to prevent DDoS
- KV rate limit: 600 reads/min, 60 writes/min (per binding)

---

## Troubleshooting

### "Invalid OAuth Code"
- Verify `GITHUB_APP_CLIENT_SECRET` is set in Cloudflare Secrets Store
- Check redirect URI matches GitHub App settings exactly

### "Webhook Signature Invalid"
- Verify `GITHUB_APP_WEBHOOK_SECRET` is set correctly
- Check webhook is coming from GitHub IP ranges

### "GitHub App Not Installed"
- Go to https://github.com/apps/goldshore-ai/installations
- Confirm installation on marzton/goldshore-ai
- Check installation permissions

### "Deployment Workflow Not Triggered"
- Verify webhook delivery in GitHub App logs
- Check branch name matches trigger condition (main/preview)
- Confirm `.github/workflows/deploy.yml` exists and is valid

---

## Next Steps

1. ✅ GitHub App configuration documented
2. ⏳ Implement OAuth routes in gs-api (/oauth/github)
3. ⏳ Implement webhook handlers in gs-api (/webhooks/github/*)
4. ⏳ Add session management for GitHub auth in gs-web
5. ⏳ Create admin login UI in gs-web
6. ⏳ Set up GitHub Actions deployment workflow

---

## See Also

- `infra/GITHUB_MCP_SETUP.md` — MCP servers configuration
- `.github/workflows/` — Existing GitHub Actions workflows
- `apps/gs-api/wrangler.toml` — Cloudflare Secrets Store binding
- `apps/gs-web/src/pages/admin/` — Admin dashboard pages
