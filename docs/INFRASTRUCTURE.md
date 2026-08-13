# Gold Shore Infrastructure Guide

Complete documentation of all websites, deployment infrastructure, DNS/email configuration, and operational runbooks.

**Last Updated:** July 1, 2026  
**Version:** 2.0 (Post-Phase-2-Audit)  
**Status:** ✅ Fully documented

---

## Table of Contents

1. [Domain Registry](#domain-registry)
2. [Deployment Architecture](#deployment-architecture)
3. [Email Infrastructure](#email-infrastructure)
4. [Cloudflare Configuration](#cloudflare-configuration)
5. [Secrets & Credentials](#secrets--credentials)
6. [Monitoring & Health Checks](#monitoring--health-checks)
7. [Runbooks](#runbooks)

---

## Domain Registry

### 20 Domains, 7 Repositories, 11+ Cloudflare Workers

| Domain | Repo | Runtime | Status | Owner/Notes |
|--------|------|---------|--------|-------------|
| **goldshore.ai** | goldshore-ai/apps/gs-web | CF Worker | ✅ Live | Parent lab brand |
| **www.goldshore.ai** | (redirect) | CF Redirect | ✅ Live | Alias |
| **api.goldshore.ai** | goldshore-ai/apps/gs-api | CF Worker | ✅ Live | First-party API |
| **gw.goldshore.ai** | goldshore-ai/apps/gs-gateway | CF Worker | ✅ Live | API gateway + auth |
| **agent.goldshore.ai** | goldshore-ai/apps/gs-gateway | CF Worker | ✅ Live | Agent endpoint (via binding) |
| **admin.goldshore.ai** | goldshore-ai/apps/gs-web | CF Worker | ✅ Live | Admin dashboard at `/app/dashboard` (CF Access protected) |
| **ops.goldshore.ai** | goldshore-ai/apps/gs-control | CF Worker | ✅ Live | Control plane (CF Access protected) |
| **mail.goldshore.ai** | goldshore-ai/apps/gs-mail | CF Worker | ✅ Live | Email routing & handlers |
| **radar.goldshore.ai** | goldshore-ai/apps/gs-web | CF Pages | ✅ Live | Risk Radar product |
| **goldshore.org** | goldshore-ai/apps/gs-web | CF Worker | ✅ Live | Business/org hub |
| **www.goldshore.org** | (redirect) | CF Redirect | ✅ Live | Alias |
| **banproof.me** | goldshore-ai/apps/banproof-me | CF Worker | ✅ Live | Security/ban-checking layer |
| **www.banproof.me** | (redirect) | CF Redirect | ✅ Live | Alias |
| **preview.banproof.me** | goldshore-ai/apps/banproof-me | CF Worker | 🔧 Preview | Staging environment |
| **armsway.com** | armsway-com (hybrid) | CF Worker | ✅ Live | Independent site |
| **www.armsway.com** | (redirect) | CF Redirect | ✅ Live | Alias |
| **rmarston.com** | rmarston-com (hybrid) | CF Worker | ✅ Live | Personal profile |
| **www.rmarston.com** | (redirect) | CF Redirect | ✅ Live | Alias |
| **partners-in-pools.com** | partners-in-pools (hybrid) | CF Worker | ✅ Live | Independent site |
| **www.partners-in-pools.com** | (redirect) | CF Redirect | ✅ Live | Alias |

### Planned (Not yet deployed)
- **gearswipe.com** - To be created (marzton/gearswipe)
- **veritasmatch.com** - Vite SPA, needs deployment config

### Archived
- **sundown-golf.com** - Empty repo, deprecated

---

## Deployment Architecture

### Hub-and-Spoke Model with Hybrid Pattern

```
┌─────────────────────────────────────────────────────────┐
│         goldshore-ai Monorepo (Central Hub)             │
│                                                         │
│  apps/gs-web        → frontend, public pages, admin UI │
│  apps/gs-api        → API, auth, queues, integrations  │
│                                                         │
│  .github/workflows/deploy-gs-web.yml                   │
│  .github/workflows/deploy-gs-api.yml                   │
│  .github/workflows/preview-gs-api.yml                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
        ↓                           ↓
   ┌────────────┐         ┌──────────────────┐
   │ Satellite  │         │ Independent      │
   │ Repos      │         │ Hybrid Deploy    │
   │ (Legacy)   │         │                  │
   ├────────────┤         ├──────────────────┤
   │ banproof-  │         │ armsway-com      │
   │ me         │         │ rmarston-com     │
   │ (now in    │         │ partners-in-     │
   │ monorepo)  │         │ pools            │
   │            │         │ (own CF tokens)  │
   │ goldshore- │         │                  │
   │ web        │         │ OR repository_   │
   │ (disabled) │         │ dispatch pattern │
   └────────────┘         └──────────────────┘
```

### CI/CD Pipeline

**Trigger:** Push to `main` branch  
**Target:** Cloudflare Workers + Pages  
**Duration:** ~3-5 minutes  
**Concurrency:** Serialized (one deploy at a time per branch)

#### Deploy Steps
1. Checkout code
2. Install dependencies (pnpm)
3. Run linting & tests
4. Build artifacts
5. Deploy to Cloudflare
6. **NEW:** Health check validation (retry 5x)
7. Mark success/failure

#### Deployment Options
- **Auto-deploy:** Push to main → automatic deployment
- **Manual:** `workflow_dispatch` input to select target (all/specific worker)
- **Environment:** `prod` (default) or `preview` selectable

---

## Email Infrastructure

### Setup: Cloudflare Email Routing + Zoho Mail

#### Primary Email Destination
**Gmail account:** `goldshorelabs@gmail.com`  
All email aliases forward to this account. Configure Gmail filters to organize by sender/label.

#### Cloudflare Email Routing (Free Tier)

**Limits:** 200 routing rules max (free tier)  
**Current usage:** ~182 rules (optimized with catch-alls)

##### Core Email Aliases (Deployed on 10 domains)
- `hello@` - General inquiries
- `contact@` - Contact form submissions
- `support@` - Support requests
- `admin@` - Administrator
- `ops@` - Operations
- `api@` - API issues
- `dev@` - Developer support
- `security@` - Security reports
- `alerts@` - System alerts
- `status@` - Status page
- `noreply@` - No-reply address (no forward)
- `billing@` - Billing inquiries
- `legal@` - Legal matters
- `careers@` - Recruitment
- `partners@` - Partnership inquiries
- `media@` - Media requests

##### Domain Alias Allocation

| Domain | Email Aliases | Rules Count | Strategy |
|--------|---------------|-------------|----------|
| goldshore.ai | All 16 core | ~16 | Individual rules |
| goldshore.org | All 16 core | ~16 | Individual rules |
| banproof.me | All 16 core (⚠️ see note) | ~16 | Individual rules |
| armsway.com | Catch-all only | 1 | Optimization |
| rmarston.com | Catch-all only | 1 | Optimization |
| partners-in-pools.com | Catch-all only | 1 | Optimization |
| gearswipe.com | Catch-all only | 1 | To be configured |
| veritasmatch.com | Catch-all only | 1 | To be configured |
| sundown-golf.com | (Archived) | — | Not configured |
| wayward-traveler.com | Catch-all only | 1 | To be configured |

**⚠️ CRITICAL:** `access@banproof.me` MUST exist (referenced in goldshore-org contact form)

##### DNS Records Per Domain

**MX Records (Priority):**
```
3    route1.mx.cloudflare.net
14   route2.mx.cloudflare.net
57   route3.mx.cloudflare.net
```

**SPF Record:**
```
v=spf1 include:_spf.mx.cloudflare.net ~all
```

**For goldshore.org (with Zoho outbound):**
```
v=spf1 include:_spf.mx.cloudflare.net include:zoho.com ~all
```

**DMARC Record:**
```
v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@goldshore.org; pct=100
```

**For goldshore.org (strict mode):**
```
v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc-reports@goldshore.org; pct=100
```

#### Zoho Mail (Free Tier for goldshore.org)

**Purpose:** Outbound SMTP for goldshore.org branded emails  
**Setup:** 1 Gmail forwarding address → Zoho Mail free account  
**DKIM:** CNAME record from Zoho setup wizard (to be populated in DNS)

**Outbound Email Config:**
- Host: smtp.zoho.com
- Port: 465 (TLS) or 587 (STARTTLS)
- Auth: goldshore.org Zoho account credentials
- From: noreply@goldshore.org, hello@goldshore.org, etc.

---

## Cloudflare Configuration

### Accounts

| Account Name | Account ID | Purpose | Projects |
|--------------|-----------|---------|----------|
| **Gold Shore Labs** | `f77de112d2019e5456a3198a8bb50bd2` | PRIMARY | All goldshore.* + banproof.me + armsway.com |
| **Marstonr6@gmail.com** | `d86cd71f0d1c8b8e08928a32e0c95ae3` | Legacy | (To be consolidated) |

**Action:** Consolidate to single account (Gold Shore Labs)

### Shared Resources

#### D1 Databases
| Name | ID | Used By | Purpose |
|------|----|---------|---------| 
| `gs_audit_db` | `1ae71d76-188f-481b-91d9-db2d39013f68` | banproof-me, gs-api | Audit logs, compliance |
| `gs_platform_db` | `9703574e-adb7-481e-8d98-96f8ce5f8a90` | banproof-me, gs-api | User reputation, ban records |
| `gs_signals_db` | `76af4653-7f44-417b-b46e-250143d906fd` | banproof-me, gs-gateway | Trading signal association |

#### R2 Buckets
| Name | Used By | Purpose |
|------|---------|---------|
| `gs-assets` | All workers | Shared media / static assets |
| `gs-telemetry-storage` | banproof-me, gs-control | Compliance / transaction logs |

#### KV Namespaces
| Name | ID | Used By | Purpose |
|------|----|---------|---------| 
| `GOLDSHORE_KV` | `5f13370575784c9dacff522121104cb3` | Multiple | Feature flags, config |
| `BANPROOF_CONFIG` | `714ee6be6df54291a4a4ade053e9f9ae` | banproof-me | Ban cache (fast lookups) |

### Cloudflare Access (Zero Trust)

#### Protected Routes
- `admin.goldshore.ai` → Email domain `@goldshore.ai` OR `marstonr6@gmail.com`
- `admin.goldshore.org` → Same auth policy
- `ops.goldshore.ai` → Same auth policy
- `gw.goldshore.ai:/admin/*`, `/internal/*`, `/system/*` → Same, with public bypasses

#### Public Bypasses (Health Checks)
- `/health` → Always accessible (no auth)
- `/status` → Always accessible
- `/version` → Always accessible

---

## Secrets & Credentials

### GitHub Secrets (All Repositories)

#### In goldshore-ai
```
CLOUDFLARE_ACCOUNT_ID = f77de112d2019e5456a3198a8bb50bd2
CLOUDFLARE_BUILD_API_TOKEN = [CF API token with worker deploy scope]
CLOUDFLARE_ZONE_ID = [Zone ID for DNS operations]
```

#### In Independent Repos (armsway-com, rmarston-com, partners-in-pools, etc.)
```
CLOUDFLARE_API_TOKEN = [Own CF API token]
CLOUDFLARE_ACCOUNT_ID = [Own or shared account]
HEALTH_CHECK_URL = https://[domain]/health (optional, for post-deploy validation)
```

#### Rotation Schedule
- **CF API Tokens:** Every 90 days
- **GitHub PATs (GS_DISPATCH_TOKEN):** Every 6 months
- **Cloudflare API Tokens:** Monitor expiration via CF Dashboard

**⚠️ TODO:** Create automated token rotation workflow

---

## Monitoring & Health Checks

### Post-Deployment Health Checks

**Implemented:** `.github/workflows/deploy-gs-api.yml`, `.github/workflows/deploy-gs-web.yml`, and `.github/workflows/preview-gs-api.yml`
**Endpoints:** `/health` on the canonical API worker and Pages deployment checks for `gs-web`
**Failure:** Halts the active two-app deployment path

### Uptime Monitoring (To Be Implemented)

**Plan:** Create `gs-monitor` worker in goldshore-ai  
**Frequency:** Every 5 minutes  
**Check:** HTTP GET to all 20 domains  
**Log:** D1 table `monitored_sites`  
**Alert:** Email on 3+ consecutive failures

### Deployment Alerts (To Be Implemented)

**Trigger:** Workflow failure, health check failure, secret expiration  
**Channels:** Slack webhook + email to marstonr6@gmail.com  
**Config:** Environment variables per repo

---

## Runbooks

### Runbook: Deploy banproof-me

**Context:** banproof-me is now in the monorepo (Phase 2 consolidation)

**To deploy banproof-me:**
```bash
# Option 1: Auto-deploy on push
cd goldshore-ai/apps/banproof-me
# Make changes
git add -A
git commit -m "..."
git push origin main
# Deployment triggers automatically only through canonical workflows when routed
# through apps/gs-api or apps/gs-web.

# Option 2: Manual deploy
# Go to: https://github.com/marzton/goldshore-ai/actions/workflows/deploy-gs-api.yml
# or: https://github.com/marzton/goldshore-ai/actions/workflows/deploy-gs-web.yml
# Click "Run workflow"
# Select target: "banproof-me"
# Select environment: "prod" or "preview"
# Click "Run workflow"
```

**Verify:**
```bash
curl -I https://banproof.me/
# Expected: HTTP 200
```

**If health check fails:**
1. Check deployment logs: GitHub Actions → deploy-gs-api.yml or deploy-gs-web.yml
2. Check worker logs: Cloudflare Dashboard → Workers → banproof-me → Real-time logs
3. Verify database bindings: `apps/banproof-me/wrangler.toml`
4. Check service bindings: gs-api, gs-control availability

---

### Runbook: Verify Nameservers

**Purpose:** Ensure domains point to Cloudflare (not HostGator or other registrars)

**For each domain:**
```bash
nslookup -type=NS goldshore.ai
nslookup -type=NS banproof.me
nslookup -type=NS armsway.com
# ... etc

# Expected output:
# NS nameserver1.ns.cloudflare.com
# NS nameserver2.ns.cloudflare.com
# ...

# If NOT Cloudflare:
# 1. Log into domain registrar
# 2. Change nameservers to Cloudflare
# 3. Wait 24-48 hours for propagation
# 4. Re-verify with nslookup
```

---

### Runbook: Rotate CF API Token

**Frequency:** Every 90 days

**Steps:**
1. Log into Cloudflare Dashboard → Account Settings → API Tokens
2. View existing token (`CLOUDFLARE_BUILD_API_TOKEN`)
3. Create new token:
   - Token name: `goldshore-ai-deploy-[date]`
   - Permissions: Account:Cloudflare Workers Scripts: Edit
   - Scope: Account: Gold Shore Labs
4. Update GitHub secret in goldshore-ai repo:
   - Settings → Secrets and variables → Actions
   - Update: `CLOUDFLARE_BUILD_API_TOKEN`
5. Test deployment:
   - Trigger `deploy-gs-api.yml` and `deploy-gs-web.yml`
   - Verify success
6. Delete old token from CF Dashboard

---

### Runbook: Setup New Domain

**When adding a new domain (e.g., gearswipe.com):**

1. **Create repository**
   ```bash
   gh repo create marzton/gearswipe --description "..." --public
   ```

2. **Copy template from armsway-com**
   ```bash
   git clone https://github.com/marzton/armsway-com gearswipe
   cd gearswipe
   # Update wrangler.toml:
   #   name = "gearswipe"
   #   domain = "gearswipe.com"
   ```

3. **Update deployment workflow** (`.github/workflows/deploy.yml`)
   - Use repository_dispatch pattern, OR
   - Add to goldshore-ai monorepo (recommended)

4. **Point nameservers to Cloudflare**
   - Update domain registrar
   - Wait 24-48 hours

5. **Setup email** (via Cloudflare Email Routing)
   - Add MX records (route1/2/3.mx.cloudflare.net)
   - Add SPF, DMARC records
   - Create catch-all alias (or core 16 aliases)

6. **Add to domain registry**
   - Update this file
   - Update desired-state.yaml
   - Commit to goldshore-ai

7. **First deployment**
   - Push code to repo (or merge PR)
   - Verify workflow triggers
   - Check health endpoint
   - Smoke test: curl https://gearswipe.com/

---

### Runbook: Troubleshoot Email Not Arriving

**Symptoms:** Emails sent to @goldshore.ai, @banproof.me, etc. not arriving

**Steps:**
1. Verify MX records:
   ```bash
   nslookup -type=MX goldshore.ai
   # Should show: route1/2/3.mx.cloudflare.net
   ```

2. Check Cloudflare Email Routing rules:
   - Dashboard → Websites → goldshore.ai → Email → Email Routing
   - Verify routing rules exist for the email alias
   - Verify destination is goldshorelabs@gmail.com

3. Check Gmail:
   - May be in Spam folder
   - Check Gmail filters (Settings → Filters and Blocked Addresses)
   - Whitelist sender if needed

4. Check SPF/DKIM/DMARC:
   ```bash
   dig goldshore.ai TXT
   # Should include SPF, DMARC records
   ```

5. Send test email:
   - From external account → hello@goldshore.ai
   - Monitor Cloudflare Email Routing logs (if available)
   - Check Gmail inbox

6. If still not working:
   - Verify no typo in CF Email Routing destination email
   - Check CF Email Routing is enabled on zone
   - Contact Cloudflare Support

---

## Additional Resources

- **Domain Ownership Policy:** [domain-ownership.md](./architecture/domain-ownership.md)
- **Cloudflare Desired State:** [desired-state.yaml](../infra/Cloudflare/desired-state.yaml)
- **Service Bindings Map:** [BINDINGS_MAP.md](../infra/Cloudflare/BINDINGS_MAP.md)
- **Email Setup Guide:** [email-infrastructure.md](./email/email-infrastructure.md)
- **DNS Records Reference:** [dns-records-all-domains.md](./dns/dns-records-all-domains.md)
- **Deployment Guide:** [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

---

**Last Updated:** July 1, 2026  
**Maintained By:** GoldShore Labs Infrastructure Team  
**Next Review:** January 1, 2027 (6-month cycle)
