# Goldshore AI GitHub App Configuration

> App Name: Goldshore AI  
> App ID: 36743  
> Client ID: Iv1.2fd777cc3eb8c888  
> Owner: @marzton  
> Status: Active (reintegrated 2026-08-09)

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
Primary:  https://goldshore.ai/oauth/github
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

**Webhook URL:** https://goldshore.ai/oauth/github

**Events Subscribed:**
- `push` — Code deployment triggers
- `pull_request` — PR lifecycle (opened, closed, synchronize)
- `pull_request_review` — Review events for approval workflows
- `issues` — Issue creation, closure, labeling
- `workflow_run` — GitHub Actions CI/CD status
- `release` — Release creation for prod deployments

**SSL Verification:** Enabled ✅

**Webhook Secret:** Stored in `GITHUB_APP_WEBHOOK_SECRET` environment variable

---

## Environment Variables & Secrets

### Required for Deployment

```bash
# GitHub App Credentials
GITHUB_APP_ID=36743
GITHUB_APP_CLIENT_ID=Iv1.2fd777cc3eb8c888
GITHUB_APP_CLIENT_SECRET=<stored-in-cloudflare-secrets>
GITHUB_APP_PRIVATE_KEY=<stored-in-cloudflare-secrets>
GITHUB_APP_WEBHOOK_SECRET=<stored-in-cloudflare-secrets>

# OAuth Redirect
GITHUB_OAUTH_REDIRECT_URI=https://goldshore.ai/oauth/github/callback

# Admin Dashboard
ADMIN_OAUTH_CALLBACK=https://dash.goldshore.ai/admin/auth/github/callback
```

### Storage Locations

- **Cloudflare Secrets Store** (`b9824d3280c54573a24137c7e7143b33`):
  - `GITHUB_APP_CLIENT_SECRET`
  - `GITHUB_APP_PRIVATE_KEY`
  - `GITHUB_APP_WEBHOOK_SECRET`

- **Repository Secrets** (GitHub Settings → Secrets → Actions):
  - `GITHUB_APP_ID`
  - `GITHUB_APP_CLIENT_ID`
  - `GITHUB_OAUTH_REDIRECT_URI`

- **Wrangler Environment** (apps/gs-api/wrangler.toml):
  - Bound to Secrets Store `b9824d3280c54573a24137c7e7143b33`
  - Access via `env.INTEGRATION_MASTER_KEY.get(key_name)`

---

## Routes to Implement in gs-api

### 1. OAuth Flow Routes

**GET /oauth/github**
- Initiates GitHub OAuth login flow
- Redirects user to GitHub authorization page with app scopes
- Query params: `redirect_to` (where to return after auth)

**GET /oauth/github/callback**
- GitHub OAuth callback handler
- Exchange authorization code for access token
- Store token in KV with user session
- Redirect to dashboard or original URL

**POST /oauth/github/logout**
- Clear GitHub token from session
- Revoke token from GitHub (optional)

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
1. `/admin/login` — GitHub App login button
2. `/admin/auth/github/callback` — OAuth callback handler
3. `/admin` — Protected admin dashboard (requires GitHub auth)

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
POST https://goldshore.ai/webhooks/github/<event_type>
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
