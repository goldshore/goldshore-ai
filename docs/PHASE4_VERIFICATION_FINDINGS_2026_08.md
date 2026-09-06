# Phase 4: Verification Findings — Active Deployments in goldshore-core

**Date**: 2026-08-22  
**Investigation**: goldshore-core repository deployment status  
**Status**: CRITICAL FINDINGS IDENTIFIED

---

## Key Discovery: banproof-me is Still ACTIVE

### Deployment Status

**banproof-me** (Security Service)
- **Worker Name**: `banproof-me`
- **Production Routes**: 
  - `banproof.me/*`
  - `www.banproof.me/*`
- **Database**: Shared `gs_platform_db` (same as gs-api)
- **Key Storage**: Shared `INFRA_SECRETS` KV namespace
- **Status**: ✅ **ACTIVELY DEPLOYED IN PRODUCTION**

**Discovery**: banproof-me.wrangler.toml has `[env.production]` section with explicit routes to production domains. This is an active service that handles production traffic.

### Architecture Implications

```
Current Setup:
  banproof.me (production)
    ↓
  banproof-me Worker (in goldshore-core repo)
    ↓
  gs_platform_db (shared D1 database)
  INFRA_SECRETS (shared KV namespace)
```

**Key Issue**: banproof-me shares the same database and key storage as gs-api, meaning:
- It's not isolated from the main goldshore-ai application
- Database schema must accommodate both apps
- Secrets are shared infrastructure

---

## Other Deployments in goldshore-core

### goldshore-core (main Worker)
- **Worker Name**: `goldshore-core`
- **Production Routes**: `core.goldshore.org/*`
- **Status**: ✅ **DEPLOYED** (but appears to be legacy)
- **Assessment**: Likely superseded by gs-api, but need to verify traffic

### goldshore-admin
- **Worker Name**: `goldshore-admin`
- **Status**: ❌ **SUPERSEDED**
- **Successor**: gs-web in goldshore-ai
- **Recommendation**: Stop deployment, archive code

### goldshore-ai (in goldshore-core)
- **Type**: Marketing website (duplicate of goldshore-ai repo structure)
- **Status**: ❌ **SUPERSEDED**
- **Successor**: gs-web in goldshore-ai
- **Recommendation**: Archive

---

## Shared Infrastructure Dependencies

Both goldshore-core apps and gs-api use:

### Database
- **Name**: `gs_platform_db`
- **ID**: `9703574e-adb7-481e-8d98-96f8ce5f8a90`
- **Users**:
  - ✅ gs-api (PLATFORM_DB)
  - ✅ banproof-me (DB)
  - ✅ goldshore-admin (DB)
  - ✅ goldshore-ai in goldshore-core (DB)

### Key Storage
- **Name**: `INFRA_SECRETS`
- **ID**: `0c45009b68c944d6988a5268bdaa7361`
- **Users**:
  - ✅ gs-api (if configured)
  - ✅ banproof-me (INFRA_SECRETS)
  - ✅ goldshore-admin (INFRA_SECRETS)
  - ✅ goldshore-ai (INFRA_SECRETS)

---

## Recommended Action Plan

### Scenario A: Keep banproof-me Separate (SIMPLER)

**Approach**: Archive goldshore-core but maintain banproof-me deployment

**Process**:
1. Create standalone goldshore-core archived state in GitHub
   - Update README: "Core functionality moved to gs-api; banproof-me runs independently"
   - Move banproof-me to separate branch or minimal repo
   - Archive remaining code

2. Keep banproof-me deployment as-is
   - No code migration required
   - No risk to production service
   - Minimal operational change

**Timeline**: 2-3 hours
**Risk**: LOW
**Recommendation**: ✅ **BEST OPTION**

### Scenario B: Consolidate banproof-me into gs-api (MORE COMPLEX)

**Approach**: Migrate banproof-me routes/handlers into gs-api

**Process**:
1. Audit banproof-me functionality
   - Review source code
   - Understand data model
   - Identify dependencies

2. Create banproof-me routes in gs-api
   - Add `/banproof-me/*` or similar route prefix
   - Integrate authentication
   - Map database tables

3. Comprehensive testing
   - Unit tests for all banproof-me endpoints
   - Integration tests with existing gs-api middleware
   - Production traffic simulation

4. Gradual migration
   - Deploy to preview environment
   - Canary deployment (10% → 50% → 100% traffic shift)
   - Monitoring during rollout

5. Cutover
   - Update Cloudflare routing from banproof-me Worker to gs-api
   - Monitor for issues
   - Archive banproof-me repo

**Timeline**: 3-5 days
**Risk**: MEDIUM-HIGH (consolidated security service requires extensive testing)
**Recommendation**: ⚠️ **ONLY if consolidation provides significant value**

---

## Decision Required

### Question 1: Does banproof-me Add Business Value?

**If YES**:
- Recommend Scenario A (keep separate)
- Maintain current deployment
- Archive goldshore-core legacy code

**If NO**:
- Recommend decommissioning banproof-me
- Archive entire goldshore-core
- Simplify infrastructure

### Question 2: What is banproof-me's Purpose?

Looking at the codebase, banproof-me likely provides:
- Security/authentication service
- Identity management
- Fraud/risk assessment (based on name)

**Need to verify**: 
- Is it actively used by goldshore-ai?
- Do any goldshore-ai workflows call banproof-me APIs?
- Are there active users/customers depending on this service?

### Question 3: Is Consolidation Worth the Risk?

**Consolidation benefits**:
- Single deployment target (gs-api)
- Unified middleware stack
- Simplified credential management

**Consolidation costs**:
- 3-5 days of development
- Extensive testing required (security-critical service)
- Deployment risk (affects security features)
- Potential performance impact

**Recommendation**: Unless there's clear operational benefit, Scenario A (keep separate) is safer.

---

## Current Status Summary

| Component | Status | Action |
|---|---|---|
| **gs-api** | ✅ Active & Canonical | Keep as-is |
| **gs-web** | ✅ Active & Canonical | Keep as-is |
| **banproof-me** | ✅ Active & Independent | Keep as-is OR Consolidate (decision needed) |
| **goldshore-core** | ⚠️ Legacy/Superseded | Archive immediately |
| **goldshore-admin** | ❌ Superseded | Archive immediately |
| **goldshore-ai (in goldshore-core)** | ❌ Superseded | Archive immediately |

---

## Immediate Next Steps

1. **Verify banproof-me Usage** (1 hour):
   - Does gs-web import/call banproof-me?
   - Do any APIs depend on it?
   - Check git logs for recent changes

2. **Make Decision** (30 minutes):
   - Scenario A: Keep separate (simpler, recommended)
   - Scenario B: Consolidate (requires more work)
   - Scenario C: Decommission (if no longer needed)

3. **Execute Phase 4** (2-3 hours):
   - Archive goldshore-core legacy code
   - Update documentation
   - Commit decision to feature branch

---

## Files to Review

- `apps/banproof-me/src/index.ts` — Entry point and routes
- `apps/banproof-me/package.json` — Dependencies
- Search goldshore-ai codebase for "banproof" references
- Check if any gs-web pages call banproof-me APIs

---

## Success Criteria for Phase 4

- [x] Identified all active deployments in goldshore-core
- [ ] Determined banproof-me is necessary and in-use
- [ ] Made decision: Keep separate vs. Consolidate vs. Decommission
- [ ] Documented decision with rationale
- [ ] Created action plan for archival or consolidation

---

**Investigation Complete**. Ready for decision on banproof-me status.
