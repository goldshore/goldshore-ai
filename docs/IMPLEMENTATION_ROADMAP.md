# Repository Consolidation Implementation Roadmap

**Created**: 2026-08-22  
**Status**: Ready for Execution  
**Timeline**: 21 days (5 phases)  
**Scope**: Consolidate 6 standalone production repos into goldshore-ai monorepo

---

## Executive Summary

This roadmap provides a complete, step-by-step implementation plan for consolidating goldshore-ai from a scattered multi-repo architecture to a lean, focused monorepo with 2 canonical apps (gs-web, gs-api).

**Key Outcomes**:
- ✅ All production functionality preserved in goldshore-ai
- ✅ ~1.5 GB of legacy code removed
- ✅ Simplified CI/CD and operational model
- ✅ Single deployment pipeline for core platform
- ✅ Clear responsibility boundaries (frontend vs. backend)

---

## Quick Reference

| Phase | Work | Timeline | Owner | Status |
|-------|------|----------|-------|--------|
| 1 | Archive 3 non-blocking repos | 1-3 hrs | Ops/Manual | 📋 Ready |
| 2 | Migrate admin features to gs-web | 3-4 days | Claude | 📋 Ready |
| 3 | Consolidate gateway into gs-api | 2-3 days | Claude | 📋 Ready |
| 4 | Decide goldshore-core integration | 1-3 days | Ops/Sec | ⏳ Awaiting decision |
| 5 | Document & brief team | 1-2 days | Claude | 📋 Ready |
| **Total** | | **~21 days** | | |

---

## Phase 1: Immediate Archival (Days 1-2)

### What
Archive 3 standalone repos with no production dependencies.

### Repos
1. **goldshore-ops** (359 KB) — KV stub, never built
2. **goldshore-web** (1.0 MB) — Deprecated Astro site
3. **goldshore-labs** (362 KB) — Purpose unclear, audit first

### How
GitHub Settings → Danger Zone → Archive repository (manual action, ~1 hour per repo)

### Documentation
See: `docs/PHASE1_ARCHIVAL_CHECKLIST.md`

### Success Criteria
- ✅ All 3 repos marked as archived (read-only)
- ✅ No references in goldshore-ai codebase
- ✅ CI/CD unaffected

### Risk Level
🟢 **LOW** — No code changes, no dependencies

---

## Phase 2: Admin Consolidation (Days 3-7)

### What
Migrate admin dashboard features from `goldshore-admin` into `apps/gs-web/src/pages/admin/`

### Current State
- goldshore-admin: 18 pages, running at admin.goldshore.ai
- gs-web admin: 70+ pages, running at goldshore.ai/admin/
- **Gap**: Customer/subscription management pages missing

### Work Items
1. Extract 5 components from goldshore-admin
   - `create-customer.tsx`, `customers-table.tsx`, `customers-list.tsx`
   - `create-subscription.tsx`, `subscriptions-table.tsx`

2. Create 5 new gs-web pages
   - `/admin/customers` — List view
   - `/admin/customers/[id]` — Detail view
   - `/admin/customers/new` — Create view
   - `/admin/subscriptions` — List view
   - `/admin/subscriptions/[id]` — Detail view

3. Implement 6 gs-api routes
   - `POST /api/admin/customers` — Create
   - `GET /api/admin/customers` — List
   - `GET /api/admin/customers/:id` — Read
   - `PATCH /api/admin/customers/:id` — Update
   - `POST /api/admin/subscriptions` — Create
   - `GET /api/admin/subscriptions` — List/Read/Update

4. Apply database migrations
   - Create `customers` table in PLATFORM_DB
   - Create `subscriptions` table in PLATFORM_DB

5. Update deployment config
   - Redirect admin.goldshore.ai to goldshore.ai/admin
   - Verify CF Access auth flows

6. Comprehensive testing
   - Component unit tests
   - API integration tests
   - E2E tests (CRUD operations)
   - CF Access auth tests

7. Archive goldshore-admin

### Documentation
See: `docs/PHASE2_ADMIN_MIGRATION.md`

### Success Criteria
- ✅ All 5 components migrated and tested
- ✅ 5 new admin pages created and functional
- ✅ 6 gs-api routes implemented and tested
- ✅ Database schema verified
- ✅ Deployment config updated
- ✅ E2E tests pass (CRUD workflows)
- ✅ goldshore-admin archived

### Risk Level
🟡 **MEDIUM** — Full page migration, requires testing

---

## Phase 3: Gateway Consolidation (Days 8-12)

### What
Move `goldshore-gateway` routing logic into `apps/gs-api`. Gateway currently handles CORS, CF Access validation, health checks, and request routing.

### Current State
- goldshore-gateway: Front-door Worker (gs-platform)
- Routes all requests to gs-api via API_SERVICE binding
- Handles CORS, auth, health check, correlation IDs

### Work Items
1. Copy middleware to gs-api
   - `src/middleware/cors.ts`
   - `src/middleware/access.ts`
   - `src/middleware/path-security.ts`

2. Integrate middleware into gs-api request pipeline
   - Add CORS preflight handling (OPTIONS requests)
   - Add CF Access JWT validation for `/api/*`
   - Add correlation ID handling (x-correlation-id header)
   - Add health check endpoint (`/health`)

3. Update all response handlers
   - Append CORS headers to all responses
   - Ensure correlation IDs propagated through handlers

4. Update Cloudflare configuration
   - Update wrangler.toml (environment bindings)
   - Update Cloudflare Dashboard routes (api.goldshore.ai → gs-api)

5. Testing
   - Unit tests for middleware
   - Integration tests for request pipeline
   - E2E tests (CORS, auth, health check)

6. Migration & Cutover
   - Parallel deployment (both gateway and gs-api running)
   - Canary deployment (10% → 50% → 100% traffic shift)
   - Monitor error rates and latency

7. Archive goldshore-gateway

### Documentation
See: `docs/PHASE3_GATEWAY_CONSOLIDATION.md`

### Success Criteria
- ✅ Middleware integrated into gs-api
- ✅ All responses include CORS headers
- ✅ Health check endpoint working
- ✅ Correlation IDs propagated correctly
- ✅ E2E tests pass (CORS, auth, routing)
- ✅ Zero errors during parallel deployment
- ✅ Traffic shift completes without issues
- ✅ goldshore-gateway archived

### Risk Level
🟡 **MEDIUM** — Routing changes affect all traffic, requires careful testing

---

## Phase 4: Core Integration Decision (Days 13-15)

### What
Decide whether `goldshore-core` (banproof-me security service) should be consolidated into gs-api or kept as external service.

### Decision Framework

**Option A: Consolidate** (2-3 days)
- Move banproof-me queue consumer into gs-api
- Pros: Single monorepo, simpler deployment
- Cons: Larger gs-api, security-critical code mixed in
- **When**: If async (queue-based) and team prefers unified deployment

**Option B: Keep External** (1 day)
- Document as external service, add HTTP client to gs-api
- Pros: Isolated, can scale independently
- Cons: Cross-service complexity, network latency
- **When**: If performance-critical or team prefers separation

### Work Items (Common)
1. Gather information (30 min)
   - Analyze goldshore-core integration points
   - Check logs for call patterns (latency, error rate)
   - Review team structure and ownership

2. Decision gate (30 min)
   - Ops/security team answers framework questions
   - Make explicit decision (A or B)
   - Document rationale

### Work Items (Option A Only)
3. Extract queue consumer from goldshore-core
4. Create `apps/gs-api/src/routes/queue-handlers/banproof-me.ts`
5. Port all security check logic to gs-api
6. Update wrangler.toml queue configuration
7. Security audit of imported code
8. Comprehensive testing (unit, integration, E2E)
9. Archive goldshore-core

### Work Items (Option B Only)
3. Document banproof-me endpoint in this roadmap
4. Add HTTP client to gs-api (with retry/circuit breaker)
5. Add monitoring/alerts for endpoint
6. Update deployment docs (2 services now)
7. Add integration tests (mocked endpoint)
8. Keep goldshore-core as external service

### Documentation
See: `docs/PHASE4_CORE_INTEGRATION_DECISION.md`

### Success Criteria (Option A)
- ✅ Queue consumer extracted and integrated
- ✅ Security audit passed
- ✅ Comprehensive testing complete
- ✅ goldshore-core archived

### Success Criteria (Option B)
- ✅ banproof-me endpoint documented
- ✅ HTTP client with retry/circuit breaker
- ✅ Monitoring/alerts configured
- ✅ Integration tests pass

### Risk Level
🟡 **MEDIUM** (if Option A) — Security-critical code, requires audit  
🟢 **LOW** (if Option B) — Configuration only, minimal risk

---

## Phase 5: Documentation & Communication (Days 16-21)

### What
Update all documentation and brief team on new monorepo structure.

### Work Items
1. Update CLAUDE.md
   - Replace "Active branch" section with completion summary
   - Update "Standalone repos" section with archive status
   - Update "Repo consolidation roadmap" section

2. Create CONSOLIDATION_SUMMARY_2026_08.md
   - High-level overview of what changed
   - Impact on different teams (frontend, backend, ops, devx)
   - Performance improvements
   - Rollback plan

3. Update deployment documentation
   - Remove references to goldshore-admin deployment
   - Remove references to goldshore-gateway deployment
   - [If Option A] Add note about banproof-me queue handler
   - Simplify deployment checklist (fewer services)

4. Update team runbooks/processes
   - Adjust oncall procedures (fewer services to monitor)
   - Update incident response playbooks
   - Update deployment checklists

5. Team communication
   - Send email summarizing changes
   - Post Slack announcement (optional)
   - Schedule optional team sync (optional)
   - Answer team questions

6. Monitoring & follow-up
   - Set up alerts for gs-api errors
   - Monitor admin routes for 48 hours
   - Monitor for unexpected latency increases
   - Gather team feedback (2 weeks post-consolidation)

### Documentation
See: `docs/PHASE5_DOCUMENTATION_COMMUNICATION.md`

### Success Criteria
- ✅ CLAUDE.md updated
- ✅ CONSOLIDATION_SUMMARY_2026_08.md created
- ✅ Deployment documentation updated
- ✅ Team email sent (or Slack announcement posted)
- ✅ No team blockers or concerns
- ✅ Monitoring in place
- ✅ 2-week follow-up scheduled

### Risk Level
🟢 **LOW** — Documentation only, no code changes

---

## Cross-Phase Considerations

### CI/CD
- Verify no hardcoded paths to deleted apps in `.github/workflows/`
- Confirm GitHub Actions deploy tokens still valid
- Test full deployment pipeline (gs-web + gs-api only)

### Testing Strategy
- Unit tests for each component/route
- Integration tests for middleware/handlers
- E2E tests for full workflows (CRUD, auth, routing)
- Performance tests (before/after latency comparison)
- CF Access auth tests (critical!)

### Rollback Plan
All changes tracked in git with full history:
- `git revert <commit-hash>` to undo any phase
- `git checkout <commit> -- apps/<app>` to recover deleted apps
- GitHub → Restore archive to unarchive repos
- **No permanent data loss**

### Monitoring & Alerts
- gs-api error logs (watch for 401/403 spikes)
- Admin routes: 404s or response time increases
- Gateway health check (if still running in parallel)
- Correlation ID tracking (for distributed tracing)

### Communication Plan
1. **Before Phase 1**: Brief ops team on archive plan
2. **After Phase 1**: Announce archival complete
3. **After Phase 2**: Announce admin features now in gs-web
4. **After Phase 3**: Announce gateway consolidation complete
5. **After Phase 4**: Announce core integration decision
6. **After Phase 5**: Send comprehensive team update

---

## Dependencies & Prerequisites

### Required
- ✅ Cleanup phase (legacy apps deleted, auto-generated files removed) — **COMPLETE**
- ✅ CONSOLIDATION_AUDIT_2026_08.md analysis — **COMPLETE**
- ⏳ Ops/security team to review Phase 4 decision framework

### Optional
- Access to Cloudflare Dashboard (for Worker route updates)
- Access to GitHub Settings (for archive actions)
- Team sync (optional, for questions/concerns)

---

## Timeline & Pacing

### Recommended Pacing
```
Week 1:
  Days 1-3: Phase 1 (archival) — 3 hours total
  Days 3-7: Phase 2 (admin) — 3-4 days (parallel with P1)

Week 2:
  Days 8-12: Phase 3 (gateway) — 2-3 days
  Days 13-15: Phase 4 (decision) — 1-3 days (parallel with P3)

Week 3:
  Days 16-21: Phase 5 (documentation) — 1-2 days (parallel with P4)
```

### Critical Path
1. Phase 1: Non-blocking (can happen anytime)
2. Phase 2: Needs Phase 1 complete (admin routes freed up)
3. Phase 3: Needs Phase 2 complete (gateway still routes to gs-api)
4. Phase 4: Parallel with Phase 3 (independent decision)
5. Phase 5: Final (documentation of all changes)

---

## Success Metrics

### Phase 1
- [ ] 3 repos archived (read-only)
- [ ] CI/CD unaffected
- [ ] Zero errors in goldshore-ai

### Phase 2
- [ ] Customer/subscription pages accessible
- [ ] CRUD operations working end-to-end
- [ ] E2E tests passing
- [ ] CF Access auth working

### Phase 3
- [ ] All routes respond with CORS headers
- [ ] Health check endpoint working
- [ ] Correlation IDs propagated
- [ ] Traffic shift to gs-api complete
- [ ] Zero errors during cutover

### Phase 4
- [ ] Core integration decision documented
- [ ] If Option A: Testing complete, archived
- [ ] If Option B: Monitoring/alerts configured

### Phase 5
- [ ] All documentation updated
- [ ] Team briefed and no blockers
- [ ] Monitoring in place
- [ ] 2-week follow-up scheduled

---

## Detailed Phase Documents

- **Phase 1**: `docs/PHASE1_ARCHIVAL_CHECKLIST.md`
- **Phase 2**: `docs/PHASE2_ADMIN_MIGRATION.md`
- **Phase 3**: `docs/PHASE3_GATEWAY_CONSOLIDATION.md`
- **Phase 4**: `docs/PHASE4_CORE_INTEGRATION_DECISION.md`
- **Phase 5**: `docs/PHASE5_DOCUMENTATION_COMMUNICATION.md`

---

## Support & Questions

- **Technical Details**: See individual phase docs
- **Consolidation Rationale**: `docs/CONSOLIDATION_AUDIT_2026_08.md`
- **Cleanup Completion**: `docs/CLEANUP_LOG_2026_08.md`
- **Architecture Overview**: `CLAUDE.md`

---

## Next Actions

1. **Right Now**: Review this roadmap
2. **Day 1**: Execute Phase 1 (archival — ~3 hours)
3. **Days 3-7**: Execute Phase 2 (admin migration)
4. **Days 8-12**: Execute Phase 3 (gateway consolidation)
5. **Days 13-15**: Execute Phase 4 (core decision)
6. **Days 16-21**: Execute Phase 5 (documentation)
7. **Day 22+**: Monitor production, gather feedback, adjust processes

---

_Generated by Claude Code · Session: session_011bt45s8TaWC3tgMGeY3QA3_
