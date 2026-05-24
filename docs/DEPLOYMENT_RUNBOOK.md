# GoldShore Labs — Deployment Runbook

**Purpose:** Step-by-step guide to fix critical issues and achieve full deployment  
**Time estimate:** 30–45 minutes (mostly waiting for builds and migrations)  
**Authority:** `gs-control` service (via `CLOUDFLARE_BUILD_API_TOKEN`)  
**Prerequisites:** Cloudflare account owner access, GitHub Actions secrets configured

---

> Handoff: See `AGENT_HANDOFF.md` at repo root for cross-agent status, missing work, and D1 DoD checklist.

## Phase 1: Security Fixes (CRITICAL)

### Step 1.1: Deploy corrected `packages/auth/verify.ts`

**Issue:** Current code has JWT bypass — tokens are never validated.

**File:** `packages/auth/verify.ts` (already in repo but broken)

**Fix:** The current code appears to have the structure but there's an issue in the exception handling. Verify the `jwtVerify()` result is properly checked:

```bash
# 1. Verify current state
grep -A 20 "try {" packages/auth/verify.ts | head -30

# 2. Test the auth package
pnpm -F @goldshore/auth test

# 3. If tests fail, check the import — jose must be installed
pnpm -F @goldshore/auth add jose
```

**Verification:**
```bash
# Commit the verified verify.ts
git add packages/auth/verify.ts
git commit -m "[security] Verify JWT validation is not bypassed"

# Deploy will happen in Step 3.2 when gs-platform redeploys
```

**Time:** 5 minutes

---

### Step 1.2: Set `CLOUDFLARE_ACCESS_AUDIENCE` secret on `gs-platform`

**Issue:** Audience validation is skipped, allowing token reuse across CF Access apps.

**Action:** In Cloudflare dashboard:

```
Workers → gs-platform → Settings → Environment Variables
→ "Add variable"
  Name: CLOUDFLARE_ACCESS_AUDIENCE
  Value: gs-platform  (or your CF Access app UUID from the dashboard)
→ Save and deploy
```

Or via `wrangler` (if you have local `wrangler.toml`):

```bash
wrangler secret put CLOUDFLARE_ACCESS_AUDIENCE
# (Paste the audience value when prompted)
wrangler deploy --name gs-platform
```

**Time:** 5 minutes

---

### Step 1.3: Apply D1 Migrations

**Issue:** Both D1 databases exist but have 0 tables.

**Action:**

```bash
# Verify current state
wrangler d1 info gs_platform_db
# Expected: "Tables: 0"

# Apply migrations
wrangler d1 migrations list gs_platform_db
# This will show pending migrations from schemas/d1/

wrangler d1 migrations apply gs_platform_db --remote
# Confirm when prompted
```

**Expected output:**
```
Applying migration M0001__init.sql...
Applying migration M0002__sentiment_signals.sql...
✓ Migrations applied (X tables created)
```

**Verify tables exist:**
```bash
wrangler d1 execute gs_platform_db --remote ".tables"
# Should list: worker_registry, sentiment_signals, media_assets, content_jobs, etc.
```

**Time:** 10 minutes

---

## Phase 2: Cleanup and Routing

### Step 2.1: Delete test/stub workers

**Workers to delete:**
- `goldshore-ai` (stub "Hello world" on goldshore.ai domain)
- `gs-dynamic-worker` (test artifact created 2026-04-21)

**Action:** In Cloudflare dashboard:

```
Workers → <worker-name> → Delete
→ Confirm
```

Or via `wrangler`:

```bash
wrangler delete --name goldshore-ai
wrangler delete --name gs-dynamic-worker
# Confirm deletions
```

**Time:** 5 minutes

---

### Step 2.2: Verify `gs-web` Pages project

**Action:** Check if Pages project exists and is healthy:

```bash
# List Pages projects
curl -X GET https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/pages/projects \
  -H "Authorization: Bearer {CLOUDFLARE_BUILD_API_TOKEN}" \
  | jq '.result[] | {name, production_branch, domains}'
```

**Expected:** `gs-web` project should list `goldshore.ai`, `www.goldshore.ai`, `preview.goldshore.ai`

**If missing:**
```bash
# Create Pages project (via dashboard is easier)
# Or via wrangler (experimental)
wrangler pages project create gs-web \
  --production-branch=main \
  --build-command="pnpm build" \
  --build-output-directory="dist"
```

**Time:** 5 minutes

---

## Phase 3: Deploy Missing Workers (In Dependency Order)

### Step 3.1: Deploy `gs-control` (Ops/Control Plane)

**Why first:** Other workers depend on `gs-control` being available for CI/CD token management.

**Action:**

```bash
# 1. Verify the app exists
ls -la apps/gs-control/

# 2. Check wrangler.toml
cat apps/gs-control/wrangler.toml
# Must have: [env.prod] with routes = [{ pattern = "ops.goldshore.ai/*" }]

# 3. Build and deploy
pnpm -F @goldshore/gs-control build
cd apps/gs-control
wrangler deploy --env prod
```

**Expected output:**
```
✓ Uploaded gs-control
✓ Deployed to ops.goldshore.ai
```

**Verify:**
```bash
curl https://ops.goldshore.ai/health
# Should return {status: "ok", service: "gs-control"}
```

**Time:** 10 minutes

---

### Step 3.2: Deploy `gs-api` (with corrected bindings)

**Action:**

```bash
# 1. Update infra/Cloudflare/gs-api.wrangler.toml with bindings
# Check that it has (uncomment if commented out):
# [[d1_databases]]
# binding = "DB"
# database_name = "goldshore"
# database_id = "gs_db_001"

cat infra/Cloudflare/gs-api.wrangler.toml | grep -A 3 "d1_databases"

# 2. Build
pnpm build:api

# 3. Deploy from infra manifest
cd apps/gs-api
wrangler deploy --config ../../infra/Cloudflare/gs-api.wrangler.toml --env prod
```

**Verify:**
```bash
curl https://api.goldshore.ai/health
# Should return {status: "ok", service: "gs-api"}
```

**Time:** 10 minutes

---

### Step 3.3: Deploy `gs-gateway` → rename to `gs-platform` or fix naming

**Issue:** Code in `apps/gs-gateway/` is deployed as `gs-platform` on account.

**Action:** Option A (recommended):

```bash
# Rename wrangler.toml to match CF account name
cd apps/gs-gateway
cp wrangler.toml wrangler.platform.toml
# Edit wrangler.platform.toml, change name = "gs-platform"
cat > wrangler.platform.toml <<'EOF'
name = "gs-platform"
main = "src/index.ts"
compatibility_date = "2026-04-18"
compatibility_flags = ["nodejs_compat"]

workers_dev = false

[env.prod]
routes = [
  { pattern = "gw.goldshore.ai/*", zone_name = "goldshore.ai" },
  { pattern = "agent.goldshore.ai/*", zone_name = "goldshore.ai" }
]

[env.prod.vars]
ENV = "production"
CLOUDFLARE_TEAM_DOMAIN = "goldshore.cloudflareaccess.com"

[[env.prod.kv_namespaces]]
binding = "AI_CACHE"
id = "gs-ai-cache"

[[env.prod.services]]
binding = "API_SERVICE"
service = "gs-api"
environment = "prod"
EOF

# Deploy with corrected name
wrangler deploy --config wrangler.platform.toml --env prod
```

**Verify:**
```bash
curl https://gw.goldshore.ai/health
# Should return {status: "ok", service: "gs-platform"}
```

**Time:** 10 minutes

---

### Step 3.4: Deploy `gs-mail` (Email/Queue Service)

**Action:**

```bash
cd apps/gs-mail
wrangler deploy --env prod
```

**Expected:** Worker deploys but has no public routes (backend service).

**Time:** 5 minutes

---

### Step 3.5: Deploy `gs-agent` (Agent Runtime)

**Action:**

```bash
cd apps/gs-agent
wrangler deploy --env prod
```

**Verify:** Agent is now reachable via `gs-platform` gateway at `agent.goldshore.ai/*`

**Time:** 5 minutes

---

## Phase 4: Frontend Deployment

### Step 4.1: Build and Deploy `gs-web` (Astro)

**Action:**

```bash
# Build
pnpm -F @goldshore/gs-web build

# Verify Pages project exists
wrangler pages project list | grep gs-web

# Deploy (if using GitHub integration)
# Commit to main and GitHub Actions will deploy

# Or deploy directly
cd apps/gs-web
wrangler pages deploy dist
```

**Verify:**
```bash
curl https://goldshore.ai/
# Should serve Astro HTML, not "Hello world"
```

**Time:** 10 minutes

---

### Step 4.2: Build and Deploy `gs-admin` (Admin Cockpit)

**Action:**

```bash
cd apps/gs-admin
pnpm build
wrangler pages deploy dist
```

**Verify:**
```bash
curl -I https://admin.goldshore.ai/
# Should be protected by CF Access (403 or redirect to login)
```

**Time:** 10 minutes

---

## Phase 5: Monorepo Integration

### Step 5.1: Integrate `banproof-me` into monorepo

**Currently:** Deployed from local machine (`../.npm/_npx/...`)

**Goal:** Move to `apps/banproof-me/` and deploy via CI/CD

**Action:**

```bash
# 1. Create app structure
mkdir -p apps/banproof-me/src

# 2. Move banproof code if available locally, or create new
# Assuming you have local copy:
cp -r /path/to/local/banproof-me/* apps/banproof-me/

# 3. Create wrangler.toml
cat > apps/banproof-me/wrangler.toml <<'EOF'
name = "banproof-me"
main = "src/index.ts"
compatibility_date = "2026-04-18"
compatibility_flags = ["nodejs_compat"]

workers_dev = false

[env.prod]
routes = [
  { pattern = "banproof.me/*", zone_name = "banproof.me" },
  { pattern = "www.banproof.me/*", zone_name = "banproof.me" }
]

[[env.prod.d1_databases]]
binding = "PLATFORM_DB"
database_name = "banproof_platform"
database_id = "<existing_id>"

[[env.prod.r2_buckets]]
binding = "ASSETS"
bucket_name = "gs-assets"
EOF

# 4. Add to package.json scripts
cat >> apps/banproof-me/package.json <<'EOF'
  "scripts": {
    "dev": "wrangler dev src/index.ts --bundle",
    "deploy": "wrangler deploy --env prod --bundle",
    "build": "wrangler deploy --env prod --dry-run --outdir=dist --bundle"
  }
EOF

# 5. Commit
git add apps/banproof-me/
git commit -m "[infra] Integrate banproof-me into monorepo CI/CD"

# 6. Deploy
cd apps/banproof-me
wrangler deploy --env prod
```

**Time:** 15 minutes

---

### Step 5.2: Add `goldshore-org` router to monorepo

**Currently:** Exists locally, wrangler.toml is placeholder

**Goal:** Integrate into monorepo, push mirror to GitHub, deploy via CI

**Action:**

```bash
# 1. Create directory
mkdir -p apps/goldshore-org

# 2. Add corrected wrangler.toml (from this runbook's config/)
cat > apps/goldshore-org/wrangler.toml <<'EOF'
name = "goldshore-org"
main = "src/router.ts"
compatibility_date = "2024-12-18"
compatibility_flags = ["nodejs_compat"]

workers_dev = false

[env.production]
routes = [
  { pattern = "goldshore.org/*", zone_name = "goldshore.org" },
  { pattern = "www.goldshore.org/*", zone_name = "goldshore.org" }
]

[env.production.vars]
ASSETS_ORIGIN = "https://goldshore-org.pages.dev"
GPT_ALLOWED_ORIGINS = "https://chat.openai.com,https://goldshore.org,https://www.goldshore.org,https://goldshore.ai,https://www.goldshore.ai"
CONTROL_SERVICE = "gs-control"

[[env.production.services]]
binding = "API"
service = "gs-api"
environment = "prod"
EOF

# 3. Copy src/router.ts if available
cp /path/to/local/goldshore-org/src/router.ts apps/goldshore-org/src/

# 4. Create package.json
cat > apps/goldshore-org/package.json <<'EOF'
{
  "name": "@goldshore/goldshore-org",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev src/router.ts --bundle",
    "deploy": "wrangler deploy --env production",
    "build": "wrangler deploy --env production --dry-run --outdir=dist"
  },
  "dependencies": {
    "hono": "^4.10.2"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20260421.1",
    "typescript": "^5.4.0",
    "wrangler": "^4.83.0"
  }
}
EOF

# 5. Commit to monorepo
git add apps/goldshore-org/
git commit -m "[infra] Add goldshore-org router to monorepo"

# 6. Deploy
cd apps/goldshore-org
wrangler deploy --env production
```

**Verify:**
```bash
curl https://goldshore.org/health
# Should return router status
```

**Push mirror to GitHub (optional but recommended):**

```bash
# Create marzton/goldshore-org repo on GitHub first
cd /tmp
git clone https://github.com/marzton/goldshore-org.git
cd goldshore-org

# Copy only the goldshore-org app
cp -r /path/to/marzton/goldshore-ai/apps/goldshore-org/* .

git add .
git commit -m "Mirror: goldshore-org router from monorepo"
git push origin main
```

**Time:** 15 minutes

---

## Phase 6: Verification and Cleanup

### Step 6.1: Health Check All Routes

```bash
# API
curl https://api.goldshore.ai/health

# Gateway/Platform
curl https://gw.goldshore.ai/health

# Web
curl https://goldshore.ai/ | head -20

# Admin (will show CF Access login)
curl -I https://admin.goldshore.ai/

# Banproof
curl https://banproof.me/health

# GoldShore Org
curl https://goldshore.org/

# Operations/Control
curl https://ops.goldshore.ai/health
```

**Expected:** All return 200 or expected status (CF Access shows 403)

**Time:** 5 minutes

---

### Step 6.2: Verify Database Persistence

```bash
# Check worker_registry table
wrangler d1 execute gs_platform_db --remote \
  "SELECT script_name, status FROM worker_registry LIMIT 5"

# Should return 8 rows (pre-populated in migration)
```

**Time:** 2 minutes

---

### Step 6.3: Normalize CI Workflows

**Action:** Search `.github/workflows/` for fallback token expressions:

```bash
# Find fallback expressions
scripts/check-cloudflare-token-policy.sh

# Replace with canonical token only
# Example: change from
#   env:
# Migration behavior
# - Do NOT use workflow fallback expressions.
# - If compatibility is needed, mirror legacy secret values in secret management temporarily.
# Canonical
#   env:
#     CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_BUILD_API_TOKEN }}

# Commit
git add .github/workflows/
git commit -m "[ci] Normalize to single canonical CLOUDFLARE_BUILD_API_TOKEN"
```

**Time:** 10 minutes

---

## Validation Checklist

- [ ] `CLOUDFLARE_ACCESS_AUDIENCE` set on `gs-platform`
- [ ] D1 migrations applied — `worker_registry` table exists and has 8 rows
- [ ] Stub workers deleted (`goldshore-ai`, `gs-dynamic-worker`)
- [ ] `gs-control` deployed and reachable at `ops.goldshore.ai`
- [ ] `gs-api` deployed and reachable at `api.goldshore.ai`
- [ ] `gs-platform` (renamed from `gs-gateway`) deployed and reachable at `gw.goldshore.ai`
- [ ] `gs-mail` deployed (backend service, no public route)
- [ ] `gs-agent` deployed and reachable via `agent.goldshore.ai`
- [ ] `gs-web` Astro Pages deployed and reachable at `goldshore.ai`
- [ ] `gs-admin` Astro Pages deployed and protected at `admin.goldshore.ai`
- [ ] `banproof-me` in monorepo and deployed from CI
- [ ] `goldshore-org` router in monorepo and deployed
- [ ] All health endpoints return 200
- [ ] No fallback token expressions in workflows

---

## Rollback Plan

If a step fails:

1. **Worker deployment fails:** Roll back to previous version in CF dashboard → Worker → Deployments → Rollback
2. **Pages deployment fails:** Revert Git commit and push — GitHub Actions will redeploy
3. **Database migration fails:** Contact Cloudflare support or restore from backup (if available)

---

## Post-Deployment

### Phase 7: Documentation Update

Once all workers are deployed, update docs:

```bash
# Update DEPLOYMENT_SOURCE_OF_TRUTH.md
echo "Last deployment: $(date)" >> docs/infra/DEPLOYMENT_SOURCE_OF_TRUTH.md

# Confirm all expected routes are live
pnpm run check:routes  # If this script exists
```

### Phase 8: Security Audit

```bash
# Verify all workers are validating JWT
wrangler tail gs-platform --format pretty | grep -i "token verification"

# Verify secrets are not in logs
wrangler tail gs-control --format pretty | grep -v SECRET
```

---

## Estimated Total Time

- Phase 1 (Security): 20 minutes
- Phase 2 (Cleanup): 10 minutes
- Phase 3 (Workers): 50 minutes
- Phase 4 (Frontend): 20 minutes
- Phase 5 (Integration): 30 minutes
- Phase 6 (Verification): 25 minutes
- **Total: ~2.5 hours**

Most of this is waiting for builds and deployments to complete.
