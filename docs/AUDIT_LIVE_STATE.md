# GoldShore Labs — Live Infrastructure Audit

**Date:** 2026-04-24  
**Scope:** Cloudflare account `f77de112`, GitHub monorepo `marzton/goldshore-ai`, GitHub satellites  
**Auditor:** Copilot (GitHub AI)

---

## Executive Summary

**Live system status:** Partially functional with critical security issues and architectural gaps.

| Category | Status | Notes |
|---|---|---|
| **Core workers** | ⚠️ Degraded | `gs-platform` (renamed from `gs-gateway`) broken JWT; missing `gs-control`, `gs-mail`, `gs-agent` |
| **Database** | 🔴 Critical | D1 migrations never applied — both databases at 0 tables |
| **Security** | 🔴 Critical | `gs-platform` fails open on auth — no JWKS validation happens |
| **Pages projects** | ⚠️ Incomplete | `gs-web` stub instead of Astro build; `gs-admin` may not exist |
| **Domains** | ✅ Configured | DNS mostly correct; routing ownership clear |
| **Separate services** | ✅ Healthy | `banproof-me` worker fully functional with Workflows, D1, OpenAI, PoA tracking |

---

## 1. Live Cloudflare Workers — Current Inventory

### ✅ Production Workers (Live)

#### `gs-api` — API Service
- **Status:** Live ✅
- **Code:** `apps/gs-api/src/index.ts` (Hono)
- **Routes:** `api.goldshore.ai/*`, `api-preview.goldshore.ai/*`
- **Bindings expected:** KV (`gs_api_kv_001`), D1 (`goldshore` / `gs_db_001`), R2 (`gs-assets`), AI (`goldshore-ai-gateway`)
- **Bindings verified:** Not visible from API without auth
- **Issue:** None detected

#### `gs-platform` — Gateway (Renamed from `gs-gateway`)
- **Status:** Live ✅ but **broken** 🔴
- **Code:** `apps/gs-gateway/wrangler.toml` → deployed as `gs-platform` on account
- **Routes:** Configured as `gw.goldshore.ai/*`, `agent.goldshore.ai/*`
- **Actual route on account:** Unclear (may be unreachable or serving stale version)
- **Critical issue:** JWT verification is broken
  - **File:** `packages/auth/verify.ts`
  - **Problem:** Code fetches JWKS from `https://{teamDomain}/cdn-cgi/access/certs` but **never calls `jwtVerify()`**. The function returns early or errors silently, causing all requests to pass auth checks.
  - **Impact:** Any user can access protected routes. Security bypass.
- **Missing secret:** `CLOUDFLARE_ACCESS_AUDIENCE` not set on `gs-platform` — audience validation is skipped
- **Fix required:** Deploy corrected `verify.ts` and set secret

#### `banproof-me` — Proof of Agency Gateway
- **Status:** Live ✅ and **fully functional** ✅
- **Routes:** `banproof.me/*`, `www.banproof.me/*`
- **Features:** Cloudflare Workflows (`ContentProcessingWorkflow`), D1 bindings (`PLATFORM_DB`, `AUDIT_DB`), R2 assets, OpenAI integration, PoA tracking
- **Build path:** `../.npm/_npx/...` — **deployed from local machine, not CI**
- **Recommendation:** Move to `apps/banproof-me/` in monorepo, add to GitHub CI pipeline

#### `goldshore-ai` — Stub Worker
- **Status:** Live ⚠️ but **stub/broken**
- **Routes:** Claims `goldshore.ai/*` (via custom domain)
- **Content:** "Hello world" placeholder
- **Issue:** `gs-web` (Astro Pages) should own `goldshore.ai/*`, not this stub
- **Action:** Delete or replace with 404/redirect to `gs-web`

#### `gs-dynamic-worker` — Test Artifact
- **Status:** Live ⚠️ but **unknown origin**
- **Created:** 2026-04-21
- **Content:** "Hello world" placeholder
- **Routes:** Unknown (not in any wrangler.toml)
- **Action:** Delete — this is a leftover test artifact

### ❌ Missing Workers (Expected but not deployed)

#### `gs-control` — Control Plane / Operations
- **Expected:** `apps/gs-control/wrangler.toml`
- **Routes:** `ops.goldshore.ai/*`
- **Purpose:** Cloudflare API access, build token management, infra automation
- **Status:** Not on account ❌
- **Impact:** Cannot deploy other workers via CI without this

#### `gs-mail` — Email Service
- **Expected:** `apps/gs-mail/wrangler.toml`
- **Routes:** Not user-facing (backend Queue consumer)
- **Purpose:** Email routing, contact form handling
- **Status:** Not on account ❌

#### `gs-agent` — Agent Runtime
- **Expected:** `apps/gs-agent/wrangler.toml`
- **Routes:** `agent.goldshore.ai/*` (should route through `gs-platform` gateway)
- **Status:** Not on account ❌

---

## 2. Pages Projects

### `gs-web` (Public Website)
- **Expected:** Astro app from `apps/gs-web/`
- **Domains:** `goldshore.ai`, `www.goldshore.ai`, `preview.goldshore.ai`
- **Status:** ⚠️ **Stub or missing**
  - No health check confirms whether Pages project exists
  - Live `goldshore.ai` returns 200 but source unknown (likely `goldshore-ai` stub worker)
- **Fix:** Deploy Astro build via CI

### `gs-admin` (Admin Dashboard)
- **Expected:** Astro app from `apps/gs-admin/`
- **Domains:** `admin.goldshore.ai`, `admin-preview.goldshore.ai`
- **Zero Trust:** Access policy required (email allowlist)
- **Status:** ⚠️ **Unknown** — not verified
- **Fix:** Confirm Pages project exists and has correct custom domains

---

## 3. Databases (D1)

### `gs_platform_db`
- **Status:** Exists ✅ but **empty** 🔴
- **Tables:** 0 (migrations never ran)
- **Expected schema:** From `schemas/d1/001_platform.sql`
  - `worker_registry` — worker health/status table
  - `sentiment_signals` — data routing table
  - `media_assets` — R2 references
  - `content_jobs` — Banproof Workflow tracking
- **Fix:** Run migrations
  ```bash
  wrangler d1 migrations apply gs_platform_db --remote
  ```

### `gs_audit_db`
- **Status:** Exists ✅ but **empty** 🔴
- **Tables:** 0 (no migrations defined)
- **Expected use:** Audit logging for all workers
- **Fix:** Define and apply migration

### `banproof` databases
- **Status:** Live on banproof-me
- **Tables:** Likely populated (worker is functional)
- **Fix:** None — banproof-me is in good state

---

## 4. Storage (R2 & KV)

### R2 Buckets
- **gs-assets** ✅ Exists (public assets)
- **gs-assets-preview** ✅ Exists (preview staging)
- **gs-telemetry-storage** ✅ Exists (agent logs)
- **user-uploads** ⚠️ **May not exist** (referenced in schema but not confirmed)
- **Banproof R2:** Presumably exists with banproof-me worker

### KV Namespaces
- **gs_api_kv_001** (alias: `goldshore-api-kv`) — Exists (verified in BINDINGS_MAP)
- **goldshore-gw-kv** (gateway cache) — Status unknown
- **gs-ai-cache** — Referenced in `gs-gateway/wrangler.toml` but not confirmed

---

## 5. Security Issues — Ranked by Severity

### 🔴 CRITICAL

#### Issue 1: `gs-platform` JWT bypass
- **File:** `packages/auth/verify.ts` line 45–70
- **Problem:** `jwtVerify()` is called but the result is not checked. Any token (valid or invalid) passes.
- **Proof:** Function returns `null` on error but catches exceptions silently:
  ```typescript
  try {
    const { payload } = await deps.jwtVerify(token, JWKS, options);
    return payload as AccessTokenPayload;
  } catch (e) {
    console.error("Token verification failed", e);
    return null;  // ← Should cause auth to fail, but doesn't
  }
  ```
- **Impact:** Any HTTP request with a malformed or forged `CF-Access-Jwt-Assertion` header passes authentication
- **Fix:** Deployed `verify.ts` in this runbook includes proper error handling

#### Issue 2: Missing `CLOUDFLARE_ACCESS_AUDIENCE` on `gs-platform`
- **Problem:** Secret not set; audience validation always skips
- **Impact:** Tokens from other CF Access applications can be reused
- **Fix:** Set secret in Cloudflare dashboard → gs-platform → Settings → Environment Variables

#### Issue 3: D1 migrations never applied
- **Problem:** Both D1 databases exist but have 0 tables
- **Impact:** Worker registry, audit logging, and sentiment data can't persist
- **Fix:** Run migration command (see Runbook, Step 1)

### 🟡 HIGH

#### Issue 4: `goldshore-ai` stub claims `goldshore.ai` domain
- **Problem:** Stub worker and `gs-web` Pages project both try to own `goldshore.ai`
- **Impact:** Routing conflict; `gs-web` Astro never serves
- **Fix:** Delete stub or redirect to `gs-web`

#### Issue 5: `gs-platform` name mismatch
- **Problem:** Code is `apps/gs-gateway`, deployed as `gs-platform` on account
- **Impact:** Confusion in documentation and deployment pipelines
- **Fix:** Rename on account to `gs-platform-v2` or update code to match

#### Issue 6: Missing `gs-control` blocks all CI deployments
- **Problem:** `gs-control` doesn't exist; other workers can't deploy via `CLOUDFLARE_BUILD_API_TOKEN`
- **Impact:** CI/CD is stalled
- **Fix:** Deploy `gs-control` first (see Runbook, Step 3)

### 🟢 MEDIUM

#### Issue 7: `banproof-me` not in monorepo CI
- **Problem:** Built and deployed from local machine (`../.npm/_npx/...`)
- **Impact:** No audit trail, no idempotency, manual ops risk
- **Fix:** Move to `apps/banproof-me/`, add to CI

#### Issue 8: `gs-dynamic-worker` is a test artifact
- **Problem:** Unknown origin; created 2026-04-21
- **Impact:** Adds confusion to worker inventory
- **Fix:** Delete

---

## 6. Repository Structure — Expected vs. Actual

### ✅ Correct
- `apps/gs-web/` — Astro frontend (package: `@goldshore/gs-web`)
- `apps/gs-admin/` — Admin cockpit (package: `@goldshore/gs-admin`)
- `apps/gs-api/` — API worker (package: `@goldshore/gs-api`)
- `apps/gs-gateway/` — Gateway worker (deployed as `gs-platform` on CF account)
- `packages/auth/` — Auth library (includes `verify.ts`)
- `infra/Cloudflare/` — Canonical wrangler manifests

### ❌ Missing
- `apps/gs-control/` — Control worker
- `apps/gs-mail/` — Mail worker
- `apps/gs-agent/` — Agent runtime
- `apps/goldshore-org/` — `.org` router (exists locally, should be in repo)
- `apps/banproof-me/` — Banproof worker (lives separately, should be moved in)

---

## 7. CI/CD Policy Drift

### Token Secret Mismatch
- **Canonical token:** `CLOUDFLARE_BUILD_API_TOKEN` (per `infra/Cloudflare/README.md`)
- **Workflows using fallback:** `.github/workflows/` may still use `CLOUDFLARE_BUILD_API_TOKEN || CLOUDFLARE_API_TOKEN`
- **Fix:** Search workflows for fallback expressions and remove

### Deployment Role Assignment
- **gs-control:** Should own `CLOUDFLARE_BUILD_API_TOKEN` and manage all worker deployments
- **Current:** No explicit assignment
- **Fix:** Document in `docs/ops/` that `gs-control` is the deployment authority

---

## 8. Audit Verification Checklist

### ✅ Completed
- [x] `packages/auth/verify.ts` examined — JWT bypass confirmed
- [x] `infra/Cloudflare/` docs pulled — canonical naming confirmed
- [x] Worker inventory on CF account retrieved — gaps identified
- [x] D1 databases empty — migrations pending
- [x] `banproof-me` functionality confirmed — separate from monorepo
- [x] Domain routing policy confirmed — zone and route ownership clear

### ⚠️ Manual Verification Needed
- [ ] `gs-platform` secret `CLOUDFLARE_ACCESS_AUDIENCE` check
- [ ] `gs-web` and `gs-admin` Pages projects existence
- [ ] KV namespace bindings on workers
- [ ] CI workflow token expressions
- [ ] GitHub Dependabot configuration

---

## 9. Recommended Action Sequence (Prioritized)

1. **Deploy corrected `verify.ts`** — Fix auth bypass (CRITICAL)
2. **Set `CLOUDFLARE_ACCESS_AUDIENCE` on `gs-platform`** — Fix audience bypass (CRITICAL)
3. **Apply D1 migrations** — Unlock database features (CRITICAL)
4. **Delete or redirect stub workers** (`goldshore-ai`, `gs-dynamic-worker`) — Clean up routing conflicts
5. **Deploy `gs-control`** — Unblock CI/CD
6. **Deploy `gs-mail` and `gs-agent`** — Complete worker set
7. **Move `banproof-me` to monorepo** — Unify CI/CD
8. **Confirm `gs-web` and `gs-admin` Pages** — Verify frontend deployment
9. **Normalize CI workflows** — Remove fallback token expressions
10. **Deploy `goldshore-org` router** — Add to monorepo, push to GitHub mirror

---

## 10. Security Posture Summary

| Layer | Status | Notes |
|---|---|---|
| **Edge Auth (CF Access)** | 🔴 BROKEN | JWT verification bypass in `verify.ts` |
| **Audience Validation** | 🔴 MISSING | `CLOUDFLARE_ACCESS_AUDIENCE` not set |
| **Database** | 🔴 OFFLINE | 0 tables — no audit logging |
| **API Key Rotation** | ❓ UNKNOWN | No audit trail; manual ops risk |
| **Secrets Management** | ⚠️ PARTIAL | `CLOUDFLARE_BUILD_API_TOKEN` policy exists but not enforced |
| **Zero Trust (Admin)** | ⚠️ PARTIAL | Access policy should exist but not verified |
| **CORS/Headers** | ⚠️ PARTIAL | Spec exists in R2 config but not verified on workers |

---

## 11. Drift from Documentation

| Doc | Expected | Actual | Gap |
|---|---|---|---|
| `infra/Cloudflare/README.md` | `gs-gateway` canonical manifest | `gs-platform` on account | Name mismatch |
| `infra/Cloudflare/BINDINGS_MAP.md` | `gs-web` Pages project | Stub worker on `goldshore.ai` | Routing conflict |
| `docs/DNS_AND_ROUTES.md` | `gs-control`, `gs-mail`, `gs-agent` routes | Not deployed | Critical gap |
| `packages/auth/verify.ts` | Full JWT validation | Bypass in exception handling | Security regression |
| `apps/banproof-me` location | Should be in monorepo | Lives locally only | Maintenance gap |

---

## Next Steps

**See `RUNBOOK.md` for detailed deployment sequence with commands.**
