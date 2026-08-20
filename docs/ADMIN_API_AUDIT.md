# Admin API Full System Audit

**Created**: 2026-08-15 14:32:00Z  
**Lead**: Claude  
**Status**: IN-PROGRESS  
**Issue**: Admin dashboard forms submit but data doesn't save — complete connectivity audit.

---

## Executive Summary

Admin platform has **3 misaligned architectural layers**:

1. **Frontend proxy layer** (gs-web) ✅ Exists
2. **Backend API layer** (gs-api) ✅ Mostly exists
3. **Database schema** ✅ Exists but MISMATCH

**Result**: Requests succeed (200 OK) but data never persists. Cause: either auth headers lost in proxy, or writes go to wrong DB tables.

---

## The 3 Layers

### Layer 1: Frontend Routes (PROXY STUBS)
```
Location: apps/gs-web/src/pages/api/admin/*
Pattern: Forwarding requests to backend
Files: 18 files (settings.ts, email/send.ts, users/[...path].ts, etc)
```

Example:
```typescript
// apps/gs-web/src/pages/api/admin/settings.ts
export const PUT: APIRoute = ({ request, locals }) => 
  proxyApiRequest(request, '/admin/settings', locals.PUBLIC_API);
```

**Question**: What IS `locals.PUBLIC_API`? Is it set? Is it carrying auth?

---

### Layer 2: Backend Routes (HONO API)
```
Location: apps/gs-api/src/routes/admin.ts + sub-routers
Pattern: Actual business logic
Status: Mostly complete (email, users, settings, approvals)
```

Key routes:
- `GET|PUT /admin/settings` — Settings cache CRUD
- `GET|POST|PATCH|DELETE /admin/users` — User management
- `POST /admin/email/send` — Queue email job
- `GET /admin/email/jobs` — List jobs

**All routes require**: `requirePermission()` middleware  
**If missing CF Access JWT**: Silent 401 (client never knows)

---

### Layer 3: Database
```
Location: apps/gs-api/src/db/migrations/004-admin-schema.sql
Problem: Defines tables that API doesn't use
```

**Unused tables** (defined but never queried):
- `admin_emails` — API doesn't write here
- `admin_users` — API queries `users` table instead
- `admin_audit_log` — API uses `audit_events` instead
- `admin_settings` — API uses `admin_cache` instead
- `admin_leads` — API route exists but table abandoned
- `admin_contact_submissions` — ditto

**Actually used**:
- `users` ✅
- `audit_events` ✅
- `admin_cache` ✅
- `mail_jobs` ✅

**Why it breaks**: If frontend/developer writes to `admin_users`, it never reaches the API (which queries `users`).

---

## What We Know Works ✅

1. Frontend pages load
2. Forms render
3. Requests send (no network errors)
4. Backend routes exist
5. DB is accessible

---

## What's Broken ❌

1. **Proxy trust**: Does `locals.PUBLIC_API` resolve correctly?
2. **Auth headers**: Does CF Access JWT pass through proxy to backend?
3. **Error visibility**: Frontend has NO error logging — 401/403/500 responses hidden
4. **Schema alignment**: 6 tables defined but unused — data lost in wrong tables?

---

## Repair Steps

### Step 1: Frontend → Backend Connection (CLAUDE)
- File: `apps/gs-web/src/lib/api-proxy.ts`
- Action: Verify proxyApiRequest logic, confirm auth headers included
- Test: Send request to `/admin/settings`, watch backend logs for JWT

### Step 2: Add Error Logging (CLAUDE)
- Files: EmailManager, UsersManager, SettingsManager, EntriesManager, SecretCreator
- Action: Wrap fetch() calls, log errors to console
- Test: Delete a user, watch console for any 403/401

### Step 3: Clean DB Schema (CODEX)
- File: Create `007-drop-admin-schema.sql`
- Action: Drop `admin_emails`, `admin_users`, `admin_audit_log`, `admin_leads`, `admin_contact_submissions`, `admin_settings`
- Test: Verify no routes reference dropped tables

### Step 4: Verify End-to-End (CLAUDE + CODEX)
- `/admin/settings` PUT → check admin_cache table
- `/admin/email/send` POST → check mail_jobs table
- `/admin/users` POST → check users table
- All should persist and return on subsequent GETs

---

## Timeline

- Claude (now): Steps 1–2 (2 hours)
- Codex (when online): Step 3 (1 hour)
- Both: Step 4 verification (30 min)
- **ETA completion**: 2026-08-15 18:00 UTC

---

## Evidence

### Frontend Proxy
- `apps/gs-web/src/pages/api/admin/settings.ts` (5 lines)
- `apps/gs-web/src/pages/api/admin/email/send.ts` (3 lines)

### Backend API
- `apps/gs-api/src/routes/admin.ts` (320 lines — main router)
- `apps/gs-api/src/routes/admin/email.ts`
- `apps/gs-api/src/routes/admin/users.ts`
- `apps/gs-api/src/routes/admin/settings.ts`

### Database Schema
- `apps/gs-api/src/db/migrations/004-admin-schema.sql` (105 lines)
- `apps/gs-api/src/db/migrations/005-admin-cache-secrets.sql` (36 lines)

### Frontend Components (No Error Handling)
- `apps/gs-web/src/components/admin/EmailManager.tsx` — fetch calls, no try/catch
- `apps/gs-web/src/components/admin/UsersManager.tsx` — fetch calls, no try/catch
- `apps/gs-web/src/components/admin/SettingsManager.tsx` — fetch calls, no try/catch
- `apps/gs-web/src/components/admin/EntriesManager.tsx` — fetch calls, no try/catch
- `apps/gs-web/src/components/admin/SecretCreator.tsx` — fetch calls, no try/catch

---

## For Codex (When Online)

Hi Codex, Claude has fully audited the admin API layers. When you're back:

1. **Read** `docs/AGENT_STATE.md` (30 sec)
2. **Review** Claude's PR (code review form)
3. **Implement** database migration (Step 3)
4. **Verify** against backend routes
5. **Test** in preview

No rush—this will be in the handoff issue when you're ready.

---

## Locked Protocol

This audit follows `AGENT_SYNC.md` synchronized operation:
- Claude: Phase 4 IN-PROGRESS (Steps 1–2)
- Codex: Phase 4 BLOCKED (waiting for Step 1–2 to complete, then Step 3)
- Both: Phase 6 REVIEW (when PRs pushed)

See: `AGENT_SYNC.md` for full state machine.

---

## Success Criteria (Phase 4 Complete = All Passing)

- [ ] Frontend proxy verified (auth headers present)
- [ ] Error logging added to 5 components
- [ ] DB schema cleaned (6 unused tables dropped)
- [ ] `/admin/settings` GET → returns settings from admin_cache
- [ ] `/admin/settings` PUT → persists to admin_cache
- [ ] `/admin/email/send` → queues to mail_jobs
- [ ] `/admin/users` → queries users table
- [ ] No console errors on any admin page
- [ ] No 401/403/500 hidden failures

---

**Status**: Ready for Phase 3 (READY) → Phase 4 (IN-PROGRESS)  
**Next Checkpoint**: Claude pushes PR with error logging  
**Handoff Trigger**: When PR ready → notify Codex in issue
