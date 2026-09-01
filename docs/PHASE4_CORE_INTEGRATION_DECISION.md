# Phase 4: goldshore-core Integration Decision (banproof-me)

**Timeline**: 1-3 days (decision-dependent)  
**Date Started**: 2026-08-22  
**Owner**: Ops/Security Team + Claude/Codex  
**Status**: ⏳ Awaiting architecture decision

---

## Objective

Determine whether `goldshore-core` (banproof-me security service) should be:
- **Option A**: Consolidated into `apps/gs-api` as queue consumer/handler
- **Option B**: Kept as external service with documented integration

This decision impacts deployment architecture, team responsibilities, and operational complexity.

---

## Current State Analysis

### goldshore-core (banproof-me Security Service)
**Location**: `/home/user/marzton/goldshore-core/`  
**Current Role**: Security/ban-check service  
**Deployment**: Cloudflare Worker (`banproof-me`)  
**Size**: 491 KB  
**Purpose**: 
- User security checking
- Ban verification
- Rate limiting enforcement
- Risk assessment

### Current Integration Points
**From gs-api**:
- Queue message: Likely via `gs-mail-jobs` or `goldshore-jobs` queue
- Or: HTTP call to banproof-me Worker endpoint

**Assumptions**:
- Not critical path (async processing via queue)
- Security-critical code (requires careful testing)
- Performance not ultra-sensitive (can tolerate small latency increase)

---

## Decision Matrix

### Option A: Consolidate into gs-api ✅ RECOMMENDED IF...

**When to choose**:
- banproof-me is accessed via queue messages (async)
- Team wants single monorepo deployment
- Code size is manageable (~500 KB)
- Testing capacity available (security-critical)

**Pros**:
- Single monorepo deployment (simpler CI/CD)
- No cross-service complexity
- Easier to test/monitor (one codebase)
- No separate team ownership needed

**Cons**:
- Larger gs-api deployment (~500 KB additional)
- Security-critical code in main API (higher risk)
- Requires extensive E2E testing
- May need isolation via separate queue handler

**Timeline**: 2-3 days
**Effort**: HIGH (requires security audit + testing)
**Risk**: MEDIUM (security-critical)

**Implementation**:
```
1. Extract banproof-me queue consumer from goldshore-core
2. Add as gs-api queue handler: /src/routes/queue-handlers/banproof-me.ts
3. Update queue consumer config in wrangler.toml
4. Port all security check logic to gs-api
5. Test exhaustively (unit, integration, E2E)
6. Archive goldshore-core repo
```

---

### Option B: Keep External ✅ RECOMMENDED IF...

**When to choose**:
- banproof-me is performance-critical (ultra-low latency)
- Team prefers service isolation (security reasons)
- Separate team/ownership planned for security service
- Risk mitigation: external failure doesn't take down main API

**Pros**:
- Isolated service (can scale/fail independently)
- Separate team responsibility (security-focused)
- Lower risk (main API unaffected if banproof-me fails)
- Easier to rate-limit/throttle as external service

**Cons**:
- Cross-service operational complexity
- Network latency (slightly slower than internal handler)
- Separate deployment pipeline
- Requires service discovery / endpoint configuration

**Timeline**: 1 day
**Effort**: LOW (documentation + configuration)
**Risk**: LOW (minimal code changes)

**Implementation**:
```
1. Document banproof-me as external service in CLAUDE.md
2. Update gs-api to call banproof-me endpoint (HTTP)
3. Add retry logic + circuit breaker for failures
4. Update deployment docs (team owns 2 services)
5. Keep goldshore-core as standalone repo
```

---

## Decision Framework

### Questions to Answer

**Performance**:
1. What's the typical latency requirement for security checks?
   - < 50ms: Consolidate (async anyway)
   - 50-200ms: Either option (marginal impact)
   - > 200ms: Keep external (no impact on critical path)

2. How often do security checks fail?
   - < 1%: Consolidate (failures rare)
   - 1-5%: Either option
   - > 5%: Keep external (isolation valuable)

**Team Structure**:
3. Who owns security/ops?
   - Same team: Consolidate (simpler handoff)
   - Different teams: Keep external (clear ownership)

4. Are there compliance requirements (SOC 2, security audit)?
   - Yes: Consider external (easier to audit/isolate)
   - No: Consolidate (simpler)

**Scale & Load**:
5. How much traffic does banproof-me handle?
   - < 1000 req/min: Consolidate (negligible overhead)
   - 1000-10000 req/min: Either option
   - > 10000 req/min: Keep external (separate scaling)

---

## Recommendation Process

### Step 1: Information Gathering (30 min)
**Owner**: Claude/Codex  
**Action**:
1. Analyze goldshore-core source code (queue/HTTP integration)
2. Check gs-api logs for banproof-me call patterns (latency, error rate)
3. Review team structure (who currently manages banproof-me?)
4. Document findings in section below

### Step 2: Decision Gate (30 min)
**Owner**: Ops/Security Team  
**Action**:
1. Review findings from Step 1
2. Answer questions in "Decision Framework" section above
3. Make explicit decision: Option A or Option B
4. Document rationale in this file

### Step 3: Implementation (1-3 days)
**Owner**: Claude/Codex  
**Action**:
1. If Option A: Consolidate into gs-api (2-3 days)
2. If Option B: Update docs + configuration (1 day)
3. Archive repo if consolidating
4. Update CLAUDE.md with final decision

---

## Analysis & Findings

**To be completed after Step 1**

### goldshore-core Code Structure
```
Status: ⏳ Awaiting analysis
- Integration type: Queue consumer? HTTP? Both?
- Lines of code: TBD
- Dependencies: TBD
- Security-critical logic: TBD
- Test coverage: TBD
```

### Current Deployment
```
Status: ⏳ Awaiting analysis
- Deployment frequency: TBD
- Error rate: TBD
- Latency: TBD (p50, p95, p99)
- Traffic volume: TBD
```

### Team & Process
```
Status: ⏳ Awaiting analysis
- Current owner: TBD
- On-call rotation: TBD
- Audit requirements: TBD
- Compliance constraints: TBD
```

---

## Final Decision

**To be completed after Step 2**

### Chosen Option
- [ ] Option A: Consolidate into gs-api
- [ ] Option B: Keep external service

### Rationale
```
Status: ⏳ Awaiting decision
```

### Implementation Owner
```
Status: ⏳ Awaiting assignment
```

### Timeline
```
Status: ⏳ Awaiting decision
```

---

## Option A: Consolidation Implementation Checklist

**Only if Option A chosen**

- [ ] Extract banproof-me queue consumer from goldshore-core
- [ ] Create `apps/gs-api/src/routes/queue-handlers/banproof-me.ts`
- [ ] Port all security check logic to gs-api
- [ ] Update `apps/gs-api/wrangler.toml` queue consumer config
- [ ] Add unit tests for security checks
- [ ] Add integration tests (with mock queue)
- [ ] Add E2E tests (full queue flow)
- [ ] Security audit of imported code
- [ ] Performance testing (latency impact)
- [ ] Deploy to preview environment
- [ ] Test with staging traffic
- [ ] Deploy to production
- [ ] Archive goldshore-core on GitHub
- [ ] Update CLAUDE.md

---

## Option B: Keep External Implementation Checklist

**Only if Option B chosen**

- [ ] Document banproof-me endpoint URL in this file
- [ ] Update `CLAUDE.md` with external service note
- [ ] Add HTTP client in gs-api to call banproof-me
- [ ] Add retry logic (exponential backoff)
- [ ] Add circuit breaker (fail-open or fail-closed?)
- [ ] Add monitoring/alerts for banproof-me endpoint
- [ ] Update deployment docs (2 services)
- [ ] Update runbook for banproof-me failures
- [ ] Add integration tests (with mocked endpoint)
- [ ] Document team ownership (who deploys banproof-me?)
- [ ] Update CLAUDE.md

---

## Post-Decision Actions

1. **Update CLAUDE.md**:
   - If Option A: Remove banproof-me from "Standalone repos" section
   - If Option B: Add external service note with endpoint URL

2. **Notify Team**:
   - Brief team on decision
   - Update deployment processes
   - Update runbooks/oncall procedures

3. **Monitor**:
   - Watch for integration issues
   - Monitor performance/latency
   - Alert on failures

---

## Next Steps

1. **Decision Required**: Ops/security team to answer "Decision Framework" questions
2. **Notify Claude/Codex**: Pass findings + decision to implementation owner
3. **Execute**: Implement Option A or B per checklist above
4. **Archive**: Remove goldshore-core if consolidating

---

_Generated by Claude Code · Session: session_011bt45s8TaWC3tgMGeY3QA3_
