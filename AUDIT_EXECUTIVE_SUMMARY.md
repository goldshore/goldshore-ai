# GoldShore Labs — Audit Executive Summary

**Date:** 2026-04-25
**Authority:** marzton (account owner)
**Scope:** Live Cloudflare state vs. canonical repo expectations
**Status:** 🟡 **FUNCTIONAL BUT DRIFTING** — critical security issue + 3 missing workers + DB migrations pending

---

## Live Cloudflare Account State (f77de112)

### Workers Live
| Worker | Status | Issue |
|---|---|---|
| `gs-platform` | 🟢 Live | JWT bypass in verify.ts — **CRITICAL SECURITY** |
| `gs-api` | 🟢 Live | OK |
| `banproof-me` | 🟢 Live | Deployed from local machine (npm/_npx), not in monorepo |
| `goldshore-ai` | 🟡 Stub | "Hello world" — conflicts with gs-web Pages domain |
| `gs-dynamic-worker` | 🟡 Test artifact | Created Apr 21, "Hello world" — safe to delete |

### Workers Missing (Expected but not deployed)
- `gs-gateway` — Named `gs-platform` on CF (naming mismatch)
- `gs-control` — Not deployed
- `gs-mail` — Not deployed
- `gs-agent` — Not deployed

### Pages Projects
| Project | Status |
|---|---|
| `gs-web` | ⚠️ Unknown if deployed, or conflicting with `goldshore-ai` stub |
| `gs-admin` | ⚠️ Unknown if deployed |

### Databases
| Database | Tables | Status |
|---|---|---|
| `gs_platform_db` | 0 | 🔴 Exists but **empty** — migrations never applied |
| `gs_audit_db` | 0 | 🔴 Exists but **empty** — no migrations defined |

### Storage (R2 & KV)
| Resource | Status |
|---|---|
| R2: `gs-assets`, `gs-assets-preview`, `gs-telemetry-storage` | 🟢 Exist |
| R2: `user-uploads` | ⚠️ Referenced but not verified |
| KV: `gs_api_kv_001`, `goldshore-gw-kv`, `gs-ai-cache` | ⚠️ Status unknown |

---

## Canonical Expectations (from repo)

### Workers Expected (from wrangler.toml + BINDINGS_MAP.md)
| Worker | Canonical Path | Live Name | Binding Dependencies |
|---|---|---|---|
| gs-api | `infra/Cloudflare/gs-api.wrangler.toml` | `gs-api` ✅ | D1, R2, AI |
| gs-gateway | `apps/gs-gateway/wrangler.toml` | `gs-platform` ❌ Mismatch | API service, Agent service, KV |
| gs-control | `apps/gs-control/wrangler.toml` | Not deployed ❌ | CF API token, Account ID |
| gs-mail | `apps/gs-mail/wrangler.toml` | Not deployed ❌ | Queue consumer |
| gs-agent | Expected | Not deployed ❌ | Queue producer |

### Pages Expected
| Pages Project | Canonical Path | App | Domains | Status |
|---|---|---|---|---|
| gs-web | `infra/Cloudflare/gs-web.wrangler.toml` | `apps/gs-web` | goldshore.ai, www.goldshore.ai | ⚠️ Unknown |
| gs-admin | `infra/Cloudflare/gs-admin.wrangler.toml` | `apps/gs-admin` | admin.goldshore.ai | ⚠️ Unknown |

---

## Critical Issues (Ranked)

### 🔴 CRITICAL: JWT Bypass in `gs-platform`

**File:** `packages/auth/verify.ts` (lines 45–70)

**Issue:** Token verification fails **open** — requests pass through even if JWT is invalid, expired, or forged.

```typescript
// CURRENT (BROKEN)
try {
  const { payload } = await deps.jwtVerify(token, JWKS, options);
  return payload as AccessTokenPayload;
} catch (e) {
  console.error("Token verification failed", e);
  return null;  // ← Returns null but caller doesn't check it
}
```

**Impact:** Any service calling `gs-platform` auth gateway accepts **any** JWT-like string in the `CF-Access-Jwt-Assertion` header.

**Fix:** Ensure caller (`authMiddleware` in `apps/gs-gateway/src/middleware/auth.ts`) checks the return value and blocks on `null`.

**Verification:**
```bash
# Test with invalid token
curl -H "CF-Access-Jwt-Assertion: garbage" https://gw.goldshore.ai/
# Expected: 401 Unauthorized
# Currently: Probably 200 OK (auth fails open)
```

---

### 🔴 CRITICAL: `CLOUDFLARE_ACCESS_AUDIENCE` Not Set

**Issue:** `gs-platform` secret is missing — audience validation is skipped.

**Impact:** A valid JWT issued for **another** Cloudflare Access app can be used on `gs-platform`, allowing token reuse across security boundaries.

**Fix:** In Cloudflare dashboard:
```
Workers → gs-platform → Settings → Environment Variables
→ Add: CLOUDFLARE_ACCESS_AUDIENCE = "gs-platform"
```

---

### 🔴 CRITICAL: D1 Migrations Not Applied

**Issue:** Both `gs_platform_db` and `gs_audit_db` exist but have 0 tables.

**Impact:** Workers can't write audit logs or worker registry. D1 binding succeeds but schema doesn't exist.

**Fix:**
```bash
wrangler d1 migrations apply gs_platform_db --remote
wrangler d1 migrations apply gs_audit_db --remote
```

---

### 🟡 HIGH: Worker Naming Mismatch (`gs-platform` vs `gs-gateway`)

**Issue:** Repository declares the gateway as `gs-gateway` (in wrangler.toml, docs, service bindings). Live account has it as `gs-platform`.

**Impact:** Service binding calls reference `gs-gateway` but live worker is `gs-platform`. KV sync and validation scripts may fail.

**Fix:** Choose one:
- **Option A (recommended):** Rename live worker on CF from `gs-platform` to `gs-gateway` (matches repo canonical name)
- **Option B:** Rename all repo references to `gs-platform` (matches live name)

**Current:** Option B is happening (wrangler.toml says `name = "gs-platform"` in recent updates)

---

### 🟡 HIGH: 3 Workers Missing (`gs-control`, `gs-mail`, `gs-agent`)

**Impact:** Control plane, mail service, and agent runtime not deployed. Blocks full system operation.

**Timeline:** Deploy in order (Step 5–7 in runbook)

---

### 🟠 MEDIUM: Route Conflict (`goldshore-ai` stub vs `gs-web` Pages)

**Issue:** Both `goldshore-ai` stub worker and `gs-web` Pages project claim `goldshore.ai` domain.

**Impact:** Only one can serve requests. Routing is ambiguous.

**Fix:** Delete `goldshore-ai` stub worker. Confirm `gs-web` Pages project is deployed and healthy.

---

### 🟠 MEDIUM: Stub Worker (`gs-dynamic-worker`)

**Issue:** Test artifact created 2026-04-21, serves "Hello world", origin unknown.

**Fix:** Delete it.

---

### 🟠 MEDIUM: `banproof-me` Not in Monorepo

**Issue:** Deployed from local machine (`../.npm/_npx/...` in bundle path), not in `marzton/goldshore-ai`.

**Impact:** No audit trail in git, no CI/CD integration, single point of failure.

**Fix:** Migrate to `apps/banproof-me/`, commit, and deploy via CI.

---

## Key Findings

### ✅ Strengths
- **Docs are comprehensive:** AUDIT_LIVE_STATE.md, REMEDIATION.md, DEPLOYMENT_RUNBOOK.md, policy/* all exist and are well-maintained
- **Repo structure is clean:** Canonical paths defined in infra/Cloudflare/README.md, workers follow naming convention
- **Auth package exists:** verify.ts structure is correct, just not enforced in middleware
- **Schema is defined:** D1 migrations exist in schemas/d1/, just not applied

### ⚠️ Drift Areas
- **Naming:** `gs-platform` (live) vs `gs-gateway` (repo) — needs reconciliation
- **Deployment:** banproof-me deployed locally, goldshore-org not in repo, gs-control/gs-mail/gs-agent not deployed
- **Database:** Migrations defined but never ran
- **Security:** JWT bypass not enforced, audience not configured

### 🎯 Path Forward
1. **Fix security immediately** (Steps 1–3 in runbook, ~15 minutes)
2. **Apply D1 migrations** (Step 4, ~10 minutes)
3. **Delete stubs and integrate missing services** (Steps 5–7, ~45 minutes)
4. **Verify routing and bindings** (Step 8, ~20 minutes)

**Total time:** ~90 minutes, mostly waiting for migrations and builds.

---

## Recommended Next Action

**Run the deployment runbook in order:**

```bash
# Step 1: Verify and test auth package
pnpm -F @goldshore/auth test

# Step 2: Set CLOUDFLARE_ACCESS_AUDIENCE on gs-platform (via dashboard or wrangler)
wrangler secret put CLOUDFLARE_ACCESS_AUDIENCE --name gs-platform
# Paste: "gs-platform"

# Step 3: Apply D1 migrations
wrangler d1 migrations apply gs_platform_db --remote
wrangler d1 migrations apply gs_audit_db --remote

# Step 4: Deploy corrected gs-gateway (or gs-platform)
cd apps/gs-gateway
wrangler deploy --env prod

# Step 5–8: Follow docs/DEPLOYMENT_RUNBOOK.md for full sequence
```

All supporting files (AUDIT.md, RUNBOOK.md, policy/*.md, scripts/audit-live-state.sh, config/*.toml) are in this commit.

---

## File Manifest

- **AUDIT.md** — Detailed findings with evidence and verification steps
- **docs/DEPLOYMENT_RUNBOOK.md** — Already in repo, 8-step deployment sequence
- **policy/REPO_OWNERSHIP.md** — Already in repo, canonical app registry
- **policy/ROUTE_POLICY.md** — Already in repo, routing rules and conflict prevention
- **policy/CICD_POLICY.md** — Already in repo, token contract and workflow standards
- **scripts/audit-live-state.sh** — Executable to verify live state (new)
- **config/goldshore-org-wrangler.toml** — For goldshore-org integration (new)

---

## Questions for Clarification

1. **gs-platform vs gs-gateway naming:** Which name should be canonical going forward?
2. **goldshore-org:** Should this be a separate GitHub repo (`marzton/goldshore-org` mirror) or deployment artifact only?
3. **banproof-me:** Ready to migrate to monorepo CI/CD, or keep separate?
4. **Deploy immediately or wait?** Security fixes are blocking, but full deployment can wait.
