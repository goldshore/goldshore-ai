# Comprehensive Audit: Cloudflare & GitHub State

**Generated:** 2026-04-24  
**Scope:** Live Cloudflare account (`f77de112`), GitHub repo `marzton/goldshore-ai`, routing audit docs from previous session  
**Prepared by:** Copilot (reconciling multiple prior sessions' findings)

---

## Executive Summary

**Status:** Partially deployed, critical gaps exist.

- ✅ **Live and functional:** `gs-api`, `gs-gateway` (named `gs-platform` on CF), `banproof-me`
- ⚠️ **Live but broken:** `gs-platform` JWT verification (fails open; security issue)
- ❌ **Not deployed:** `gs-agent`, `gs-mail`, `gs-control`, `gs-web`, `gs-admin`, `goldshore-org` router
- ⚠️ **Test artifacts:** `gs-dynamic-worker` (created Apr 21, can be safely deleted)
- ❌ **Database migrations:** `gs_platform_db` and `gs_audit_db` exist but have 0 tables (migrations never ran)

**Route conflict:** `goldshore.ai` is claimed by three entities:
1. `goldshore-ai` stub worker (hello world)
2. `gs-platform` implicit domain binding
3. `gs-web` Pages project (when deployed)

Only one can own the route. **Recommendation:** `gs-web` (Astro) wins; others operate on subdomains.

---

## Part 1: Cloudflare Live State

### Workers Deployed

| Worker | Status | Function | Routes | Notes |
|---|---|---|---|---|
| `gs-api` | ✅ Live, OK | Core API (Hono) | `api.goldshore.ai/*` | Working; bindings unverified |
| `gs-platform` | ⚠️ Live, **BROKEN JWT** | Gateway (Hono, renamed from `gs-gateway`) | `gw.goldshore.ai/*` (implied), possibly others | JWT verify.ts never validates; fails open → **SECURITY ISSUE** |
| `gs-gateway` | ❌ Not on account | Gateway (canonical name in repo) | (intended: `gw.goldshore.ai/*`, `agent.goldshore.ai/*`) | Exists in `apps/gs-gateway/wrangler.toml` but live instance is named `gs-platform` |
| `goldshore-ai` | ⚠️ Live, stub | Hello world | Implicitly claims `goldshore.ai` | Created as placeholder; superseded by `gs-web` Pages |
| `gs-dynamic-worker` | ⚠️ Live, stub, **UNKNOWN** | Hello world | Unknown | Created Apr 21 2026; no documentation; safe to delete |
| `gs-agent` | ❌ Not on account | Agent service (Hono) | (intended: none; backend-only) | Code exists in `apps/gs-agent/` but never deployed |
| `gs-mail` | ❌ Not on account | Mail worker | (intended: `mail.goldshore.ai/*` or similar) | Code exists in `apps/gs-mail/` but never deployed |
| `gs-control` | ❌ Not on account | Ops/admin (Hono) | (intended: `ops.goldshore.ai/*`) | Code exists in `apps/gs-control/` but never deployed |
| `banproof-me` | ✅ Live, OK | Separate service | `banproof.me` | Outside goldshore scope; healthy |

**Finding:** Repo declares 6 worker services; only 2 + 1 stub are on the live account. Three are undeployed.

### Pages Projects

| Project | Status | Domain | Notes |
|---|---|---|---|
| `gs-web` | ❌ Not on account | `goldshore.ai`, `www.goldshore.ai`, `preview.goldshore.ai` | Should exist; stub worker is placeholder |
| `gs-admin` | ❌ Not on account | `admin.goldshore.ai`, `admin-preview.goldshore.ai` | Should exist; no Pages project live |
| `goldshore-org.pages.dev` | ❌ Not on account | `goldshore.org`, `www.goldshore.org` | Local repo exists (wrangler.toml); never deployed to CF |

**Finding:** Zero Astro Pages projects are deployed. All web UI traffic is being served by stub workers or not at all.

### Storage & Bindings

| Namespace | Type | Status | Notes |
|---|---|---|---|
| `gs_platform_db` | D1 | ⚠️ Live but **EMPTY** (0 tables) | Migrations never applied |
| `gs_audit_db` | D1 | ⚠️ Live but **EMPTY** (0 tables) | Migrations never applied |
| `goldshore` / `gs_db_001` | D1 (canonical in BINDINGS_MAP) | ❌ Not live | Expected by repo docs; doesn't exist |
| `gs-assets` | R2 | ⚠️ Unverified | In BINDINGS_MAP; not queried live |
| `gs-assets-preview` | R2 | ⚠️ Unverified | In BINDINGS_MAP; not queried live |
| `gs-telemetry-storage` | R2 | ⚠️ Unverified | In BINDINGS_MAP; not queried live |
| `user-uploads` | R2 | ⚠️ Unverified | In BINDINGS_MAP; not queried live |
| `gs_api_kv_001` | KV (canonical) | ❌ Not verified | Expected; status unknown |
| `goldshore-gw-kv` | KV | ❌ Not verified | Expected; status unknown |
| `AI_CACHE` | KV | ✅ Bound in `gs-gateway` wrangler | In prod config |

**Finding:** Database migrations are incomplete (2 D1s with 0 tables). R2 and KV existence/bindings unverified.

### Secrets & Environment

| Secret Name | Required For | Status | Policy |
|---|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | All worker deploys, infra guard | ⚠️ Likely set | Canonical per `infra/Cloudflare/README.md` |
| `CLOUDFLARE_BUILD_API_TOKEN` | Worker CI/CD | ⚠️ Likely set | Canonical per `infra/Cloudflare/README.md` |
| `CLOUDFLARE_API_TOKEN` | (Legacy fallback) | ⚠️ Unknown | Policy says: **DO NOT USE fallback expressions** |

**Finding:** Canonical token policy is defined but enforcement in CI workflows is unknown (need to audit `.github/workflows/`).

---

## Part 2: Repository State

### Canonical App Inventory (from `codex_plan.md`, package.json, wrangler files)

| App | Location | Package Name | Build Target | Status |
|---|---|---|---|---|
| **Web** | `apps/gs-web` | `@goldshore/gs-web` | Astro → Cloudflare Pages | ❌ Code ready, not deployed |
| **Admin** | `apps/gs-admin` | `@goldshore/gs-admin` | Astro → Cloudflare Pages | ❌ Code ready, not deployed |
| **API** | `apps/gs-api` | `@goldshore/gs-api` | Hono → Cloudflare Worker | ✅ Live (name verification needed) |
| **Gateway** | `apps/gs-gateway` | `@goldshore/gs-gateway` | Hono → Cloudflare Worker | ⚠️ Live as `gs-platform`; name mismatch |
| **Agent** | `apps/gs-agent` | `@goldshore/gs-agent` | Hono → Cloudflare Worker | ❌ Code ready, not deployed |
| **Mail** | `apps/gs-mail` | `@goldshore/gs-mail` | Hono → Cloudflare Worker | ❌ Code ready, not deployed |
| **Control** | `apps/gs-control` | `@goldshore/gs-control` | Hono → Cloudflare Worker | ❌ Code ready, not deployed |

**Key repo references:**
- `infra/Cloudflare/README.md` — declares canonical manifest paths
- `infra/Cloudflare/BINDINGS_MAP.md` — declares bindings, domains, routes
- `infra/Cloudflare/gs-*.wrangler.toml` — Astro Pages manifests
- `apps/gs-*/wrangler.toml` — Worker manifests
- Root `package.json` — monorepo build scripts (build filters target `@goldshore/gs-web`, `@goldshore/gs-admin`, `@goldshore/gs-api`)

### Monorepo Structure

```
goldshore-ai/
├── apps/
│   ├── gs-web/              (Astro; @goldshore/gs-web)
│   ├── gs-admin/            (Astro; @goldshore/gs-admin)
│   ├── gs-api/              (Hono; @goldshore/gs-api)
│   ├── gs-gateway/          (Hono; @goldshore/gs-gateway)
│   ├── gs-agent/            (Hono; @goldshore/gs-agent)
│   ├── gs-mail/             (Hono; @goldshore/gs-mail)
│   └── gs-control/          (Hono; @goldshore/gs-control)
├── packages/
│   ├── @goldshore/auth      (Auth package)
│   ├── @goldshore/config    (Config package)
│   ├── @goldshore/theme     (Design system)
│   ├── @goldshore/ui        (UI components)
│   ├── @goldshore/brand     (Branding)
│   └── @goldshore/utils     (Utilities)
├── infra/
│   └── Cloudflare/
│       ├── README.md        (Canonical manifest policy)
│       ├── BINDINGS_MAP.md  (Domain/worker/binding registry)
│       ├── gs-web.wrangler.toml      (Astro Pages)
│       ├── gs-admin.wrangler.toml    (Astro Pages)
│       ├── gs-api.wrangler.toml      (Worker)
│       └── legacy/          (Archived old configs)
├── .github/
│   └── workflows/           (CI/CD; needs token audit)
├── docs/
│   ├── brand-asset-plan.md
│   ├── domains-and-auth.md
│   └── architecture/
│       └── route-map.json
├── scripts/
│   ├── sync-gateway.ts      (KV sync, gateway config)
│   ├── check-route-collisions.mjs
│   ├── validate-worker-names.ts
│   └── [validation suite]
├── codex_plan.md            (Project roadmap)
├── PLAN.md                  (Previous session notes)
└── reports/
    ├── audits/
    ├── migration/
    └── [historical audit reports]
```

---

## Part 3: Critical Gaps & Mismatches

### 1. **JWT Verification Failure (SECURITY)**

**Issue:** `gs-platform` worker has broken JWT validation in `verify.ts`.

**Evidence:** Prior session's routing audit found the gateway fetches JWKS but never actually validates tokens — auth check fails open (request proceeds even if token is invalid).

**Impact:** Any service calling `gs-platform` as an auth gateway will accept invalid tokens.

**Fix required:**
```bash
# 1. Locate the verify.ts in gs-gateway code
find apps/gs-gateway -name 'verify.ts' -o -name '*verify*'

# 2. Inspect the JWT validation logic — confirm it checks token signature and expiry
# Expected: const verified = jwt.verify(token, publicKey)
# Currently: fetches JWKS but skips verify

# 3. Fix and redeploy
cd apps/gs-gateway
wrangler deploy --env prod
```

---

### 2. **Worker Naming: `gs-platform` vs `gs-gateway`**

**Issue:** Repository declares the gateway worker as `gs-gateway` (in `apps/gs-gateway/wrangler.toml`, codex_plan.md, BINDINGS_MAP.md). Live account has it as `gs-platform`.

**Why it matters:** Routing audit and KV sync scripts reference both names. Binding service calls use one; live worker has another.

**Evidence:**
- `apps/gs-gateway/wrangler.toml` sets `name = "gs-gateway"`
- BINDINGS_MAP.md line 75-82 says `Service Name: gs-gateway`
- Live CF account shows `gs-platform`
- Prior session's audit flags this as a name collision risk

**Fix:**
Option A (recommended): Rename live `gs-platform` to `gs-gateway` on CF account.
Option B (if gs-platform is referenced elsewhere): Update repo and docs to use `gs-platform` consistently.

---

### 3. **Database Migration Gap**

**Issue:** `gs_platform_db` and `gs_audit_db` both exist on CF account but have **0 tables**. Migrations were never applied.

**Why it matters:** Any code that tries to query the DB will fail at runtime.

**Fix:**
```bash
# 1. Locate migrations in the repo
find . -path '*/migrations/*.sql' -o -path '*/db/migrations/*.sql'

# 2. Apply migrations to both databases
wrangler d1 migrations create gs_platform_db init_schema
wrangler d1 migrations apply gs_platform_db --remote
wrangler d1 migrations apply gs_audit_db --remote

# 3. Verify tables were created
wrangler d1 execute gs_platform_db --remote "SELECT name FROM sqlite_master WHERE type='table';"
```

---

### 4. **Route Conflict: `goldshore.ai`**

**Current state:**
- `goldshore-ai` stub worker claims `goldshore.ai` implicitly (via custom domain binding)
- `gs-platform` may claim routes (bindings not fully visible)
- `gs-web` Pages project should claim `goldshore.ai` when deployed

**Issue:** Only one worker/Pages project can own a route. Three things are fighting for it.

**Recommendation (Option 2):**

| Domain | Owner | Reason |
|---|---|---|
| `goldshore.ai` | `gs-web` (Pages) | Public website, highest priority |
| `www.goldshore.ai` | `gs-web` (Pages) | Same |
| `api.goldshore.ai` | `gs-api` (Worker) | Explicit route in wrangler |
| `gw.goldshore.ai` | `gs-gateway` (Worker) | Explicit route in wrangler |
| `admin.goldshore.ai` | `gs-admin` (Pages) | Explicit in BINDINGS_MAP |
| `ops.goldshore.ai` | `gs-control` (Worker) | Ops endpoint |
| `agent.goldshore.ai` | `gs-gateway` (Worker) | Explicit in wrangler |

**Action:**
1. Delete or disable `goldshore-ai` stub worker
2. Delete or disable `gs-dynamic-worker` (test artifact)
3. Deploy `gs-web` Pages project with custom domain `goldshore.ai`

---

### 5. **Missing Astro Pages Deployments**

**Issue:** Repo is built as three Astro Pages projects (`gs-web`, `gs-admin`, and by extension `goldshore-org`). None are deployed to CF account.

**Why it matters:** All web traffic has no destination. Even after fixing workers, users can't reach the frontend.

**Fix sequence:**
1. Deploy `gs-web` → `goldshore.ai`
2. Deploy `gs-admin` → `admin.goldshore.ai` (with Zero Trust policy)
3. Deploy `goldshore-org` → `goldshore.org` (after local repo is pushed to GitHub)

---

### 6. **Missing Worker Deployments**

**Issue:** Three workers have code but are not deployed: `gs-agent`, `gs-mail`, `gs-control`.

**Why it matters:** Agent features, email routing, and ops endpoints are offline.

**Why they may not be deployed:** Possible reasons:
- Bindings not provisioned (KV, D1, R2, secrets not created)
- `gs-control` requires `CLOUDFLARE_API_TOKEN` secret; may fail if missing
- CI/CD workflows not updated to deploy them

**Fix sequence:**
1. Verify bindings exist for each worker (KV, D1, R2, etc.)
2. Ensure required secrets are set
3. Trigger or manually run deploy workflow for each

---

### 7. **CI/CD Token Policy Drift**

**Issue:** `infra/Cloudflare/README.md` defines canonical policy:
- Single token: `CLOUDFLARE_BUILD_API_TOKEN` (for all worker deploys)
- NO fallback expressions like `secretA || secretB`

**Unknown:** Whether `.github/workflows/*.yml` files follow this policy.

**Fix:**
```bash
# Audit all workflows for token usage
grep -r "CLOUDFLARE.*TOKEN" .github/workflows/ | grep -E "(\|\||\||secrets\()"

# Expected WRONG pattern:
# env:
#   CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_BUILD_API_TOKEN || secrets.CLOUDFLARE_API_TOKEN }}

# Expected CORRECT pattern:
# env:
#   CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_BUILD_API_TOKEN }}
```

---

## Part 4: Authoritative Routing & Domain Map

From `docs/architecture/route-map.json`, `BINDINGS_MAP.md`, and live CF state:

### Zone: `goldshore.ai`

| Route | Owner | Service | Type | Status |
|---|---|---|---|---|
| `goldshore.ai` | `gs-web` | `gs-web` | Pages | ❌ Not deployed |
| `www.goldshore.ai` | `gs-web` | `gs-web` | Pages | ❌ Not deployed |
| `preview.goldshore.ai` | `gs-web` | `gs-web` | Pages | ❌ Not deployed |
| `api.goldshore.ai/*` | `gs-api` | `gs-api` | Worker | ✅ Live |
| `api-preview.goldshore.ai/*` | `gs-api` | `gs-api` | Worker | ⚠️ Not verified |
| `gw.goldshore.ai/*` | `gs-gateway` | `gs-gateway` | Worker | ⚠️ Live as `gs-platform` |
| `gw-preview.goldshore.ai/*` | `gs-gateway` | `gs-gateway` | Worker | ⚠️ Not verified |
| `agent.goldshore.ai/*` | `gs-gateway` | `gs-gateway` | Worker | ⚠️ Live as `gs-platform` |
| `admin.goldshore.ai` | `gs-admin` | `gs-admin` | Pages + Access | ❌ Not deployed |
| `admin-preview.goldshore.ai` | `gs-admin` | `gs-admin` | Pages | ❌ Not deployed |
| `ops.goldshore.ai/*` | `gs-control` | `gs-control` | Worker | ❌ Not deployed |
| `mail.goldshore.ai/*` | `gs-mail` | `gs-mail` | Worker | ❌ Not deployed |

### Zone: `goldshore.org`

| Route | Owner | Service | Type | Status |
|---|---|---|---|---|
| `goldshore.org` | `goldshore-org` | `goldshore-org` router | Pages proxy | ❌ Local only |
| `www.goldshore.org` | `goldshore-org` | `goldshore-org` router | Pages proxy | ❌ Local only |

---

## Part 5: Prioritized Action Plan

### 🔴 Critical (Blocks production)

1. **Fix `gs-gateway` JWT verification** (SECURITY)
   - Locate and fix `verify.ts` to actually validate tokens
   - Redeploy `gs-gateway` to `gs-platform` (or rename live worker to match repo)
   - Test with invalid token — request should be rejected

2. **Resolve database migrations**
   - Apply schema migrations to `gs_platform_db` and `gs_audit_db`
   - Verify tables are created: `SELECT name FROM sqlite_master WHERE type='table';`
   - If migration files missing, recover from repo history or recreate from ORM models

3. **Deploy `gs-web` Pages project**
   - Run: `cd apps/gs-web && wrangler pages deploy dist/ --project-name=gs-web`
   - Attach custom domains: `goldshore.ai`, `www.goldshore.ai`, `preview.goldshore.ai`
   - Verify HTTP 200 on canonical domain

4. **Delete test stubs**
   - Delete `goldshore-ai` stub worker (superseded by `gs-web`)
   - Delete `gs-dynamic-worker` (unknown origin, Apr 21 artifact)
   - Verify routes are freed up for legitimate owners

### 🟡 Important (Enables missing services)

5. **Rename or update gateway worker**
   - Option A: Rename live `gs-platform` to `gs-gateway` on CF to match repo
   - Option B: Update all repo references to call it `gs-platform`
   - Align bindings service calls with chosen name

6. **Deploy missing workers**
   - `gs-agent` (depends on: bindings, `@goldshore/auth`)
   - `gs-mail` (depends on: R2 bucket, SMTP secrets)
   - `gs-control` (depends on: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`)
   - Trigger via CI/CD or manual `wrangler deploy`

7. **Deploy `gs-admin` Pages project**
   - Run: `cd apps/gs-admin && wrangler pages deploy dist/ --project-name=gs-admin`
   - Attach custom domains: `admin.goldshore.ai`, `admin-preview.goldshore.ai`
   - Attach Zero Trust Access policy (email allowlist)

8. **Push `goldshore-org` to GitHub**
   - Create `marzton/goldshore-org` repository
   - Push local repo: `git push -u origin main`
   - Deploy Pages project and router worker

### 🟢 Follow-up (Hygiene)

9. **Audit CI/CD workflows for token policy compliance**
   - Grep `.github/workflows/` for fallback token expressions
   - Replace with canonical `CLOUDFLARE_BUILD_API_TOKEN`
   - Ensure workflows fail fast when secrets are missing

10. **Verify all bindings**
    - KV namespaces: `gs_api_kv_001`, `goldshore-gw-kv`, `AI_CACHE`
    - R2 buckets: `gs-assets`, `gs-assets-preview`, `gs-telemetry-storage`, `user-uploads`
    - D1 databases: `goldshore` / `gs_db_001` (or align naming to live `gs_platform_db` / `gs_audit_db`)
    - Services: `gs-api`, `gs-agent`, `gs-control`

11. **Create canonical domain ownership policy**
    - Document in `docs/architecture/domain-ownership.md`
    - One domain = one owner (no conflicts)
    - Include env-specific aliases (dev, preview, prod)

12. **Implement branch/tag taxonomy**
    - Agents: `agent/claude/...`, `agent/codex/...`, `agent/jules/...`
    - Suffixes: `infra`, `security`, `domain`, `workers`, `audit`
    - CI enforcement: validate branch names in PR workflow

---

## Part 6: Audit Checklist (For Verification)

Use this checklist after applying fixes:

- [ ] `curl -I https://goldshore.ai` returns HTTP 200 (gs-web)
- [ ] `curl -I https://api.goldshore.ai/health` returns 200 (gs-api)
- [ ] `curl -I https://gw.goldshore.ai/health` returns 200 (gs-gateway/gs-platform)
- [ ] `curl -I https://admin.goldshore.ai` returns 302 or requires auth (gs-admin + Zero Trust)
- [ ] `curl -I https://ops.goldshore.ai/info` returns 200 (gs-control)
- [ ] D1 query: `wrangler d1 execute gs_platform_db --remote "SELECT COUNT(*) FROM [users|accounts|etc];"` returns data (not error)
- [ ] JWT endpoint: `curl -X POST https://api.goldshore.ai/auth/verify -d 'invalid_token'` returns 401 (not 200)
- [ ] Worker names on CF account match repo (`gs-gateway`, not `gs-platform`, unless renamed repo-wide)
- [ ] All workflows in `.github/workflows/` use `CLOUDFLARE_BUILD_API_TOKEN` (no fallback expressions)
- [ ] Pages projects exist: `gs-web`, `gs-admin`, `goldshore-org`

---

## Appendix: File References

**Critical files for remediation:**

1. `apps/gs-gateway/src/verify.ts` — JWT validation logic (broken)
2. `apps/gs-gateway/wrangler.toml` — Worker name and routes (live name mismatch)
3. `infra/Cloudflare/README.md` — Canonical manifest policy
4. `infra/Cloudflare/BINDINGS_MAP.md` — Complete bindings registry
5. `.github/workflows/*` — CI/CD token usage (audit needed)
6. `apps/gs-web/package.json` — Web app build config (ready to deploy)
7. `codex_plan.md` — Roadmap and task breakdown
8. `docs/architecture/route-map.json` — Authoritative routing map

**Verification commands:**

```bash
# Check live workers
wrangler list workers

# Check Pages projects
wrangler pages project list

# Check D1 tables
wrangler d1 execute gs_platform_db --remote "SELECT name FROM sqlite_master WHERE type='table';"

# Check KV namespaces
wrangler kv:namespace list

# Test gateway JWT validation
curl -X POST https://gw.goldshore.ai/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "invalid.jwt.here"}'
# Expected: 401 Unauthorized (not 200 OK)

# Validate branch policy in PR
git log --oneline | grep -E "^(agent|feature|bugfix|docs)/" | head -10
```

---

**Status:** Ready for execution. **Owner:** Marzton (with platform ops for CF secrets/bindings).
