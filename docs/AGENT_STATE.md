# AGENT_STATE.md — Shared Synchronization State

> **Real-time hemispheric brain state machine**  
> Last Updated: **2026-08-15 14:35:00Z**  
> Lead Agent: **Claude**  | Review Agent: **Codex (offline)**

---

## Current Work Unit

```yaml
active_work_unit:
  id: "admin-api-full-repair"
  status: "in-progress"
  priority: "critical"  # API data not persisting
  created: "2026-08-15T14:00:00Z"
  lead_agent: "claude"
  review_agent: "codex"  # Will validate when online
  
  phases:
    0_discovery: ✅ COMPLETE
    1_blocked: ❌ CODEX OFFLINE (no compute)
    2_plan: ✅ COMPLETE
    3_ready: 🔄 ACTIVE
    4_in_progress: 🔄 ACTIVE
    5_blocked_again: ⏸️ (if needed)
    6_review: ⏳ (waiting for Codex)
    7_merged: ⏸️
    8_qa: ⏸️
    9_complete: ⏸️
  
  current_phase: 4  # IN-PROGRESS
  phase_started: "2026-08-15T14:15:00Z"
```

---

## Discovery Findings (Phase 0 Complete)

### The Problem
**Symptom**: Admin dashboard forms submit but data doesn't save.  
**Root Cause**: Three-layer API architecture mismatch.

### Layer Analysis

#### Layer 1: Frontend Routes (gs-web/src/pages/api/admin/*)
- **Status**: ✅ Exists and working
- **Function**: Proxy stubs
- **Files**: 18+ files like `settings.ts`, `email/send.ts`, `users/[...path].ts`
- **Pattern**: 
  ```typescript
  export const PUT: APIRoute = ({ request, locals }) => 
    proxyApiRequest(request, '/admin/settings', locals.PUBLIC_API);
  ```
- **Issue**: `locals.PUBLIC_API` not verified

#### Layer 2: Backend Routes (gs-api/src/routes/admin.ts + sub-routers)
- **Status**: ✅ Mostly implemented
- **Function**: Actual API logic
- **Key Routes**: 
  - `/admin/settings` (GET|PUT) ✅
  - `/admin/users` (GET|POST|PATCH|DELETE) ✅
  - `/admin/email/send` (POST) ✅
  - `/admin/email/jobs` (GET) ✅
  - `/admin/approvals` (POST) ✅
  - Many sub-routers mounted
- **Issue**: All require `requirePermission()` but auth headers may not be passed from frontend

#### Layer 3: Database
- **Tables Defined** (Migration 004):
  - `admin_emails` ❌ (not used by API)
  - `admin_users` ❌ (API uses `users` instead)
  - `admin_audit_log` ❌ (API uses `audit_events` instead)
  - `admin_settings` ❌ (API uses `admin_cache` instead)
  - `admin_leads` ❌ (defined but no API route)
  - `admin_contact_submissions` ❌ (defined but no API route)
  
- **Tables Actually Used**:
  - `users` ✅
  - `audit_events` ✅
  - `admin_cache` ✅ (settings storage)
  - `mail_jobs` ✅ (email queue)
  
- **Issue**: Schema mismatch — data might write to wrong table

### Blocked Points Identified
1. **Cloudflare Access JWT**: Does frontend pass it to backend? Unknown
2. **Environment variable**: What is `locals.PUBLIC_API`? Is it set?
3. **Error logging**: Frontend components have zero error handlers
4. **DB schema**: Should drop unused `admin_*` tables

### Evidence Trail
- Frontend proxy: `apps/gs-web/src/pages/api/admin/settings.ts` (5 lines)
- Backend settings: `apps/gs-api/src/routes/admin.ts:45-76` (31 lines, includes caching logic)
- DB schema: `apps/gs-api/src/db/migrations/004-admin-schema.sql` (105 lines, mostly unused)
- Components: `apps/gs-web/src/components/admin/` (15 React components, no error logging)

---

## Agreed Repair Plan (Phase 2 Complete)

### Step 1: Verify Frontend → Backend Connection (CLAUDE) — 🔍 INVESTIGATING
**Files**: `apps/gs-web/src/lib/api-proxy.ts`, `apps/gs-web/src/middleware.ts`, `packages/auth/verify.ts`  

**Findings**:
- ✅ `locals.PUBLIC_API` correctly set to `https://api.goldshore.ai` in wrangler.toml (line 36, 75)
- ✅ Admin routes at `/api/admin/*` require `CF-Access-Jwt-Assertion` header (packages/auth/verify.ts:121)
- ✅ Astro middleware validates CF Access JWT and sets `locals.adminSession` (middleware.ts:73-98)
- ⚠️ **KEY ISSUE**: Frontend fetch requests may not include `CF-Access-Jwt-Assertion` header
  - Header is added by Cloudflare edge only on authenticated initial request
  - Subsequent browser fetch() calls must include it via cookie OR explicit forwarding
  - proxyApiRequest copies all headers from browser request, but CF Access JWT might only be in edge headers

**Action Taken**:
- Added detailed auth header logging to proxyApiRequest (api-proxy.ts)
- Logs `CF-Access-JWT-Assertion`, `CF-Access-Client-Id`, `Authorization` presence
- Logs HTTP status on failures with auth context
- Added adminSession logging to settings.ts GET/PUT (shows if middleware authorized the route)

**Next Steps to Debug**:
1. Deploy with logging and check browser console for `[proxyApiRequest]` output
2. Check if `CF-Access-Jwt-Assertion` is present in logged auth headers
3. If missing: verify Cloudflare Access policy is attached to admin.goldshore.ai routes
4. If present but failing: check gs-api auth logs for why JWT verification is failing
5. If auth headers missing: implement session-token or cookie-based auth fallback

**Success Criteria**: 
- Logging shows CF-Access-Jwt-Assertion present in all admin API requests
- gs-api auth middleware successfully verifies JWT on proxied requests
- No 401/403 errors in subsequent admin operations

---

### Step 2: Add Error Logging to Frontend Components (CLAUDE)
**Files**:
- `apps/gs-web/src/components/admin/EmailManager.tsx`
- `apps/gs-web/src/components/admin/UsersManager.tsx`
- `apps/gs-web/src/components/admin/SettingsManager.tsx`
- `apps/gs-web/src/components/admin/EntriesManager.tsx`
- `apps/gs-web/src/components/admin/SecretCreator.tsx`

**Action**:
- Wrap all fetch() calls in try/catch
- Log errors to console.error (dev) and Sentry (prod)
- Add human-readable error messages to UI
- Log HTTP status codes

**Pattern**:
```typescript
try {
  const res = await fetch('/api/admin/email/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = await res.json();
    console.error(`[EmailManager] ${res.status}:`, error);
    throw new Error(error.message || 'Unknown error');
  }
} catch (err) {
  console.error('[EmailManager] Request failed:', err);
  setErrorMessage(err.message);
}
```

**Success Criteria**: 
- All requests logged to console
- Dev can see 401/403/500 responses immediately

---

### Step 3: Clean Up Database Schema (CODEX)
**Files**: `apps/gs-api/src/db/migrations/007-drop-admin-schema.sql` (new)

**Action**:
- Create migration that drops unused tables:
  - `admin_emails`
  - `admin_users`
  - `admin_audit_log`
  - `admin_leads`
  - `admin_contact_submissions`
  - `admin_settings`
- Keep: `admin_cache`, `admin_secrets`
- Run in preview env, verify no breakage
- Codex: Compare with actual table usage in gs-api routes

**Success Criteria**: 
- Migration runs without error
- No routes reference dropped tables
- Schema is now single-source-of-truth

---

### Step 4: End-to-End Verification (CLAUDE + CODEX)
**Test sequence**:
1. Claude: `/admin/settings` GET — should return current settings
2. Claude: `/admin/settings` PUT — update settings, verify cache write
3. Codex: `/admin/email/send` — queue test email, check mail_jobs table
4. Codex: `/admin/users` GET — list users, verify pagination
5. Both: Check browser console for errors
6. Both: Check gs-api logs for auth failures

**Success Criteria**: 
- All requests return 200/201
- No 401/403 errors
- Data persists across page reload

---

## Locked Files (Until 2026-08-16 02:00 UTC)

```yaml
locked_files:
  - path: "apps/gs-web/src/lib/api-proxy.ts"
    locked_by: "claude"
    reason: "Investigating frontend→backend connection — auth header forwarding"
    expires: "2026-08-16T02:00:00Z"
    status: "debug logging added, ready for review"
    
  - path: "apps/gs-web/src/pages/api/admin/settings.ts"
    locked_by: "claude"
    reason: "Adding adminSession validation logging"
    expires: "2026-08-16T02:00:00Z"
    status: "in progress"
```

**Rule**: If Codex needs to edit these, post `[status:blocked]` comment in issue and wait for lock to expire (or Claude releases it).

---

## Handoff Checkpoint (When Claude Completes Steps 1–2)

**Trigger**: Claude pushes PR with error logging fixes  
**Handoff To**: Codex  
**Action Required**:

```markdown
[agent:codex] PLEASE READ:

Claude completed frontend diagnostics + error logging.
Your turn: implement Step 3 (DB schema cleanup).

What to do:
1. Read this AGENT_STATE.md fully
2. Check the pushed PR #XXXXX (link below)
3. Verify no routes use dropped tables
4. Create migration 007-drop-admin-schema.sql
5. Test in preview env
6. Reply: [agent:codex] [status:review] PR ready for merge

Files you'll touch:
- apps/gs-api/src/db/migrations/007-drop-admin-schema.sql (new)

Files to AVOID (locked by Claude):
- apps/gs-web/src/lib/api-proxy.ts (until lock expires)
- EmailManager, UsersManager, SettingsManager (locked)

Questions? Reply to this issue.
```

---

## Blockers (Currently: 1)

```yaml
blockers:
  - id: "codex-offline"
    severity: "high"
    status: "active"
    description: "Codex out of compute — cannot validate schema cleanup"
    impact: "Step 3 (DB schema) blocked"
    unblock_condition: "Codex online"
    unblock_owner: "Codex"
    created: "2026-08-15T14:00:00Z"
```

**Action**: Waiting for Codex to come online. Claude will continue with Steps 1–2.

---

## Commit History (This Session)

| Commit SHA | Message | Agent | Phase |
|-----------|---------|-------|-------|
| f8adc163 | `fix: add comprehensive error logging to admin frontend` | claude | 4 |
| e979d247 | `fix: add MCP_WORKERS_PROMPT KV binding to gs-api` | claude | 4 |
| c30166ac | `fix: add auth header logging to frontend proxy for debugging API auth failures` | claude | 4 |
| (pending) | `fix: add adminSession validation logging to admin API routes` | claude | 4 |
| (pending) | (Codex will add schema cleanup) | codex | 4 |

---

## Next State Transitions

```
Current: Phase 4 (IN-PROGRESS)
    ↓ When Claude pushes PR
Next: Phase 6 (REVIEW) — waiting for Codex to review
    ↓ When Codex reviews + approves
Next: Phase 7 (MERGED) — PR merges to branch
    ↓ When Codex schema PR merges
Next: Phase 8 (QA) — human tests in preview
    ↓ When smoke tests pass
Final: Phase 9 (COMPLETE) — ready to promote to stage
```

---

## Context for Codex (When Online)

Codex, when you read this:

1. **What happened**: Claude found that admin API has 3 misaligned layers
2. **What's needed**: Backend and database schema cleanup
3. **Your role**: 
   - Validate the findings (review Layer 2+3 code)
   - Implement database migration (drop unused admin_* tables)
   - Test in preview
4. **What's blocked**: You're waiting on this file + Claude's PR
5. **Your starting point**: Step 3 of the repair plan above

**Link to issue**: [TBD — post GitHub issue URL here]

No rush — work at your pace once compute is available.

---

**State Machine Validator**: This file is source-of-truth. Update it before every commit.  
**Last Sync Time**: 2026-08-15 14:35:00Z  
**Next Sync Due**: 2026-08-15 15:05:00Z (30-min interval)
