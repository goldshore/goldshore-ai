# Standalone Repository Consolidation Plan

**Date**: 2026-08-22  
**Status**: Planning Phase (ready for execution)  
**Scope**: 6 standalone production repos → consolidate into goldshore-ai monorepo

---

## Current State: 10 Repositories

| Repo | Size | Type | Status | Production | Plan |
|------|------|------|--------|-----------|------|
| **goldshore-ai** | 59 MB | Monorepo | ✅ Active | ✅ Yes (gs-web, gs-api) | Keep - primary monorepo |
| **goldshore** | 26 MB | Monorepo | ✅ Active | ✅ Yes (.org domain) | Keep - separate project |
| **goldshore-admin** | 928 KB | Standalone | ✅ Active | ✅ Yes (admin.goldshore.ai) | 🔴 Consolidate → gs-web sub-routes |
| **goldshore-web** | 1.0 MB | Standalone | ✅ Active | ❌ No (deprecated) | 🟡 Archive |
| **goldshore-api** | 1.3 MB | Standalone | ✅ Active | ⚠️ Maybe (needs audit) | 🔴 Consolidate → gs-api or deprecate |
| **goldshore-core** | 491 KB | Standalone | ✅ Active | ✅ Yes (banproof-me) | 🔴 Route through gs-api queues or keep external |
| **goldshore-gateway** | 1.3 MB | Standalone | ✅ Active | ✅ Yes (gs-platform worker) | 🔴 Consolidate → gs-api routes |
| **goldshore-labs** | 362 KB | Standalone | ✅ Active | ❓ Unclear | 🟡 Audit → consolidate or archive |
| **goldshore-ops** | 359 KB | Standalone | ✅ Active | ❓ No (KV stub) | 🟡 Archive (never built) |
| **goldshore-org** | 217 KB | Standalone | ✅ Active | ✅ Yes (goldshore.org) | Keep - separate project |

---

## Migration Priority & Action Plan

### Priority 1: Remove Non-Production Repos (Immediate)

#### 1️⃣ goldshore-ops
- **Current**: KV template stub, never built
- **Action**: Archive immediately
- **Steps**:
  1. Check if anything depends on it (search for references in other repos)
  2. Document what was in it (for recovery if needed)
  3. Archive on GitHub (`Settings → Danger Zone → Archive this repository`)
  4. Update CLAUDE.md to remove reference

**Status**: ✅ Candidate for immediate archival

---

#### 2️⃣ goldshore-web
- **Current**: Deprecated Astro site (not in production)
- **Action**: Archive and remove from CI
- **Steps**:
  1. Confirm nothing references it in CI workflows
  2. Remove from any automated deployment pipelines
  3. Archive on GitHub
  4. Update CLAUDE.md

**Status**: ✅ Candidate for immediate archival

---

### Priority 2: Consolidate Admin Interface (High Priority)

#### 3️⃣ goldshore-admin → gs-web sub-routes
- **Current**: Running at `admin.goldshore.ai` (Pages deployment)
- **Contains**: Admin dashboard, controls, settings UI
- **Action**: Migrate to `apps/gs-web/src/pages/admin/` sub-routes
- **Complexity**: HIGH (full SPA migration)
- **Steps**:
  1. ✅ **Already started**: Admin features cherry-picked into gs-web (PRs #6896-6900)
  2. Analyze remaining admin code in goldshore-admin not yet migrated
  3. Migrate remaining routes/components to gs-web
  4. Update deployment: Change admin.goldshore.ai to point to gs-web sub-route
  5. Update CLAUDE.md to document admin routes in gs-web
  6. Archive goldshore-admin repo

**Status**: ✅ In Progress (features already being restored; need to complete UI migration)

---

### Priority 3: Consolidate API & Gateway Workers (High Priority)

#### 4️⃣ goldshore-gateway → gs-api routes
- **Current**: Running as `gs-platform` Worker (platform front door)
- **Contains**: Subdomain routing logic, multi-tenant handling
- **Action**: Merge routing logic into gs-api
- **Complexity**: MEDIUM (route consolidation)
- **Steps**:
  1. Audit `goldshore-gateway/src` to understand routing logic
  2. Map gateway routes to gs-api handler pattern
  3. Consolidate subdomain logic into gs-api middleware
  4. Test routing against all known subdomains
  5. Update wrangler.toml to remove gs-platform worker references
  6. Archive goldshore-gateway repo

**Timeline**: Week 2  
**Status**: 🟡 Awaiting arch review (routing consolidation is complex)

---

#### 5️⃣ goldshore-api → gs-api (or archive if superseded)
- **Current**: Standalone API repo (1.3 MB)
- **Unclear**: Whether gs-api in goldshore-ai is a full replacement
- **Action**: Audit for parity with gs-api in goldshore-ai
- **Complexity**: MEDIUM (dependency analysis required)
- **Steps**:
  1. Compare `goldshore-api/src` with `apps/gs-api/src` for feature parity
  2. If goldshore-ai/gs-api has all features:
     - Document what was in goldshore-api
     - Archive goldshore-api repo
  3. If goldshore-api has unique features:
     - Migrate missing features to apps/gs-api
     - Archive goldshore-api repo

**Timeline**: Week 1  
**Status**: ⏳ Pending parity audit

---

### Priority 4: Handle Security/Core Integration (Medium Priority)

#### 6️⃣ goldshore-core → gs-api queues or stay external
- **Current**: Running as security service (`banproof-me` worker)
- **Contains**: Ban/security checking logic
- **Action**: Route through gs-api or keep external
- **Complexity**: MEDIUM (security-critical code)
- **Decision points**:
  - Is this integrated with gs-api already? (check queue consumers in apps/gs-api)
  - Is it performance-critical (needs to stay separate)?
  - Can it be migrated as queue handler inside gs-api?
- **Steps**:
  1. Analyze current integration points
  2. If integrated: Consolidate code into gs-api queue handlers
  3. If external: Update documentation and keep standalone
  4. If neither: Migrate logic into gs-api

**Timeline**: Week 2  
**Status**: ⏳ Pending integration audit

---

### Priority 5: Audit Unclear Repos (Low Priority)

#### 7️⃣ goldshore-labs
- **Current**: 362 KB, active, purpose unclear
- **Action**: Audit to determine if it's used
- **Steps**:
  1. Search for references in CI, deployment configs, README files
  2. If used: Document purpose and plan integration
  3. If unused: Archive

**Status**: ❓ Needs investigation

---

### Keep as-is (Separate Monorepos)

#### ✅ goldshore (marzton/goldshore)
- **Purpose**: `.org` domain research/data intelligence
- **Status**: Active, separate product
- **Action**: Keep as independent monorepo

#### ✅ goldshore-org (marzton/goldshore-org)
- **Purpose**: goldshore.org website
- **Status**: Active
- **Action**: Keep as independent project

---

## Execution Strategy

### Phase 1: Non-Blocking Archival (Days 1-2)
- [ ] Archive goldshore-ops (no dependencies expected)
- [ ] Archive goldshore-web (deprecated, verify no CI references)
- [ ] Audit goldshore-labs (if not used, archive)

### Phase 2: Admin Consolidation (Days 3-7)
- [ ] Complete admin feature migration (continue from PRs #6896-6900)
- [ ] Migrate remaining admin UI routes to gs-web
- [ ] Update admin.goldshore.ai deployment config
- [ ] Archive goldshore-admin repo

### Phase 3: API Consolidation (Days 8-14)
- [ ] Audit goldshore-api for parity with gs-api
- [ ] Migrate missing features if any
- [ ] Archive goldshore-api repo
- [ ] Consolidate gateway routing into gs-api
- [ ] Archive goldshore-gateway repo

### Phase 4: Security Integration (Days 15-21)
- [ ] Audit goldshore-core integration points
- [ ] Consolidate or document external dependency
- [ ] Update deployment configs

### Phase 5: Documentation & Communication (Days 22-28)
- [ ] Update CLAUDE.md with new unified structure
- [ ] Create migration summary document
- [ ] Brief team on changes
- [ ] Update README to reflect monorepo consolidation

---

## Risk Assessment

### High Risk
- **Admin Migration**: Full UI transfer; must maintain Cloudflare Access auth
  - Mitigation: Test CF Access policies before full migration
- **Gateway Consolidation**: Route logic affects all subdomain traffic
  - Mitigation: Run parallel routing before cutover; 100% traffic test

### Medium Risk
- **API Parity**: Standalone repos may have features gs-api lacks
  - Mitigation: Full code audit before archival
- **Core Integration**: Security-critical code; needs careful testing
  - Mitigation: Extensive E2E testing of security checks

### Low Risk
- **Ops/Web Archival**: No production dependencies

---

## Success Criteria

- ✅ All production functionality preserved in goldshore-ai monorepo
- ✅ No broken deployments post-consolidation
- ✅ CI/CD pipelines updated to use consolidated repos
- ✅ All external references updated
- ✅ Team can deploy and update from single monorepo
- ✅ Archive repos remain accessible for historical reference

---

## File Structure Post-Consolidation

```
goldshore-ai/
├── apps/
│   ├── gs-web/
│   │   ├── src/pages/
│   │   │   ├── admin/          ← Migrated from goldshore-admin
│   │   │   ├── dashboard/
│   │   │   └── ...
│   │   └── ...
│   └── gs-api/
│       ├── src/routes/
│       │   ├── gateway/        ← Migrated from goldshore-gateway
│       │   ├── security/       ← Migrated from goldshore-core (if applicable)
│       │   └── ...
│       └── ...
├── packages/
│   └── ... (unchanged)
└── docs/
    └── STANDALONE_REPO_CONSOLIDATION_PLAN.md
```

---

## Blocked Repos (Keep Separate)

These will NOT be consolidated into goldshore-ai (separate product lines):

- **goldshore** (marzton/goldshore) — Research & data intelligence (.org domain)
- **goldshore-org** (marzton/goldshore-org) — Informational website (goldshore.org)

---

## Next Steps

1. **Today**: Get approval on this plan
2. **Tomorrow**: Start Phase 1 (archive non-blocking repos)
3. **Week 1**: Continue Phase 2 (admin consolidation)
4. **Week 2**: Begin Phase 3 (API consolidation)
5. **Week 3+**: Phases 4-5 (security integration & documentation)

---

_Generated by Claude Code · Session: session_011bt45s8TaWC3tgMGeY3QA3_
