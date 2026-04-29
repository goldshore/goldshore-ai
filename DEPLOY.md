# gs-platform Deployment Guide

## What changed

### 1. packages/auth/verify.ts — CRITICAL FIX
- Was: fetching JWKS cert but never validating — returned `true` for any token
- Now: full `jose`-based JWT verification with issuer + audience checks
- Fails closed if `CLOUDFLARE_ACCESS_AUDIENCE` is not set

### 2. apps/gs-platform/src/index.ts
- Auth middleware now hard-fails (503) when audience env var is missing
- Was silently warning and passing requests through

### 3. apps/gs-platform/wrangler.toml
- Added D1 (`gs_platform_db`), KV (`GATEWAY_KV` + `GOLDSHORE_KV`), R2 (`gs-assets`) bindings
- Added routes for all 5 domains (goldshore.ai, www.goldshore.ai, admin.goldshore.ai, armsway.com, www.armsway.com)
- Service bindings for SECURITY, SIGNALS, MAIL, CORE hub → spoke architecture

---

## Steps to deploy

### Step 1 — Install dependencies
```bash
cd /path/to/monorepo
pnpm install
```

### Step 2 — Set secrets
```bash
wrangler secret put CLOUDFLARE_ACCESS_AUDIENCE --name gs-platform
# Enter: your CF Access audience tag (find in CF Zero Trust → Applications)

wrangler secret put CLOUDFLARE_ACCESS_TEAM_DOMAIN --name gs-platform
# Enter: goldshore.cloudflareaccess.com
```

### Step 3 — Deploy
```bash
cd apps/gs-platform
wrangler deploy --env prod
```

---

## Pages cleanup (do manually in CF dashboard)

These Pages projects are dead weight from the org account migration.
Delete them after clearing deployments:

| Project name         | Why delete |
|----------------------|------------|
| gs-admin-pages       | goldshore org repo — dead |
| goldshore-web-pages  | goldshore org repo — dead |
| gs-web-pages         | goldshore org repo — dead |
| gs-admin-page        | goldshore org repo — dead |
| goldshore-org-pages  | paused, goldshore org repo |
| archived-gs-pages    | paused, goldshore org repo |
| goldshore-api-pages  | paused, goldshore org repo |

## Worker cleanup (do in CF dashboard)

| Worker name         | Why delete |
|---------------------|------------|
| goldshore-gateway   | No routes, no repo — stub |

---

## Branch protection (apply after merge)

```bash
gh api repos/marzton/goldshore-ai/branches/main/protection \
  --method PUT \
  --input infra/branch-protection.json
```

This makes CI checks **required** — no PR merges to main unless
`Manifest integrity check` and `Cloudflare live state audit` both pass.

---

## Infrastructure source of truth

See `infra/INFRASTRUCTURE.md` for the canonical list of all Cloudflare
resources (workers, D1, KV, R2, routes) with real IDs.
