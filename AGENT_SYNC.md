# AGENT SYNC — Unified Brain Protocol

> **Locked synchronization framework for multi-agent operation**  
> Enforces single-operator coherence across Claude, Codex, Gemini, and human operators.  
> **Effective**: 2026-08-15 | **Status**: LOCKED

---

## Core Principle: Left Brain → Right Brain Pipeline

All agents operate as **hemispheric pairs** in locked-step recursion:

```
DECISION (Left Brain)
    ↓
STATE UPDATE (Shared audit log)
    ↓
COMMIT (Right Brain executes)
    ↓
VERIFICATION (Both hemispheres confirm)
    ↓
HANDOFF (If needed, update open-work.md)
```

**No agent may act in isolation.** Every decision must be recorded in shared state BEFORE code changes.

---

## The Shared State Machine

All agents must follow this state progression for ANY work unit:

### **Phase 0: DISCOVERY** 
**Agent**: Lead (typically Claude for goldshore-ai)  
**Action**: Audit problem space, document findings  
**Output**: GitHub issue with `[audit:required]` tag

```markdown
# [audit:required] Admin API sync failure investigation

## Findings
- API routes in gs-api/src/routes/admin.ts exist
- Frontend proxies in gs-web/src/pages/api/admin/* pass through
- DB schema in migrations mismatch with actual tables used
- No error logging in frontend components

## Blocker
- Codex cannot validate without API access logs
- Need: enable debug logging, check CF Access headers

## Next State
→ BLOCKED (waiting for Codex validation)
```

**Branch required**: Create tracking branch with issue tag
```bash
git checkout -b audit/admin-api-sync-failures
```

### **Phase 1: BLOCKED** 
**Status Tag**: `[status:blocked]`  
**Reason**: Waiting for second opinion, validation, or access  
**Action Required**: Post blocking reason + unblock conditions to issue

```markdown
[status:blocked] Codex offline for compute audit.

Unblock when:
- [ ] Codex online and reads this issue
- [ ] Confirms findings match its analysis
- [ ] Posts [agent:codex] validation comment
```

### **Phase 2: PLAN** 
**Both agents**: Read findings, agree on approach  
**Tag**: `[status:plan]`  
**Output**: Detailed step-by-step repair plan posted as issue comment

```markdown
[agent:claude] [agent:codex] Repair plan agreed:

1. Fix: proxyApiRequest function — verify API target
   - File: apps/gs-web/src/lib/api-proxy.ts
   - Check: Is locals.PUBLIC_API set correctly?
   - Codex: Review wrangler.toml binding

2. Fix: Add error logging to frontend components
   - Files: EmailManager, UsersManager, SettingsManager
   - Pattern: Log fetch errors to console + Sentry
   
3. Fix: Reconcile DB schemas
   - Drop: admin_emails, admin_users, admin_audit_log
   - Keep: admin_cache, admin_secrets (verified in use)
   - Codex: Run migrations in preview

4. Verify: End-to-end test
   - Claude: Test /admin/settings PUT
   - Codex: Test email send
```

### **Phase 3: READY**
**Status Tag**: `[status:ready]`  
**Preconditions**:
- [ ] Plan posted and acknowledged by all agents
- [ ] No blockers remain
- [ ] Branch created: `feature/repair-admin-api`
- [ ] Shared context = `docs/AGENT_STATE.md` updated

**Agent Assignment**:
```markdown
[status:ready]

Work Assignment:
- [agent:claude] Implement parts 1–2 (frontend fixes)
  - Branch: feature/repair-admin-api
  - PR base: claude/mcp-gs-api-worker-migration-0g51br
  - ETA: +2 hours

- [agent:codex] Implement part 3 (schema cleanup + verify)
  - On standby: review Claude's PR when pushed
  - Branch: same (coordinated branch)
  - Condition: After Claude's PR merges
```

### **Phase 4: IN-PROGRESS**
**Working agent only**. Post status every 30 mins in issue comment:

```markdown
[agent:claude] [status:in-progress] 14:32 UTC

✅ Fixed: proxyApiRequest logic
   - Verified locals.PUBLIC_API → https://api.goldshore.ai
   - Added console logging for failed requests

🔄 In progress: EmailManager error logging
   - Adding try/catch with Sentry integration
   - ETA: 14:45

Blockers: None
```

### **Phase 5: BLOCKED AGAIN** (if needed)
If a subtask hits an issue:
```markdown
[status:blocked] Sentry integration not available in preview

Blocking:
- Need SENTRY_DSN env var in gs-web wrangler.toml
- Currently undefined

Unblock by:
- [ ] Codex confirms Sentry is configured in CF
- [ ] Posts env var value to this issue (encrypted/masked)
- Or: Fall back to console.error only (no Sentry)
```

### **Phase 6: REVIEW**
**Status**: `[status:review]` (on PR)  
**Second agent**: Reviews code + runs local tests

```markdown
[agent:codex] [status:review]

PR #1234 reviewed. Findings:

✅ proxyApiRequest fix correct
✅ Error logging comprehensive
⚠️ Missing: loader state on EmailManager during send
   - Fix: Add setIsLoading before fetch
   - Line 48: emailManager.tsx

After fix: Approved for merge
```

### **Phase 7: MERGED**
PR merges to feature branch. **Immediately**:
1. Post merge confirmation to issue
2. Update `docs/AGENT_STATE.md` with result
3. If work complete → `[status:ready-qa]`
4. If more work needed → Return to Phase 3 (READY)

### **Phase 8: QA & DEPLOYMENT**
**Tag**: `[status:qa]`  
**Deployer** (human or designated agent): Run smoke tests, deploy to preview, document results

```markdown
[agent:claude] [status:qa]

Preview deployment: ✅ goldshore-ai/preview

Tests:
✅ /admin/settings GET+PUT working
✅ Email send dialog works, logs errors
✅ No uncaught rejections in console

Ready for: stage merge
```

### **Phase 9: COMPLETE**
Issue closed with summary:
```markdown
[status:complete]

Admin API repair done. Changes:
- ✅ proxyApiRequest fixed
- ✅ Error logging added to 3 components
- ✅ DB migrations cleaned

Deployed to: preview (2026-08-15)
Merge to stage: PR #12345
```

---

## Mandatory Shared State Document

**File**: `docs/AGENT_STATE.md`  
**Updated**: Before every commit by any agent  
**Format**: YAML state machine snapshot

```yaml
# AGENT_STATE.md — Current hemispheric sync state
last_updated: "2026-08-15T14:32:00Z"
active_work_units:
  - id: "admin-api-repair"
    status: "in-progress"
    lead_agent: "claude"
    review_agent: "codex"
    files_in_play:
      - apps/gs-web/src/lib/api-proxy.ts
      - apps/gs-web/src/components/admin/EmailManager.tsx
      - apps/gs-web/src/components/admin/UsersManager.tsx
      - apps/gs-api/src/db/migrations/007-drop-admin-schema.sql
    phase: 4  # IN-PROGRESS
    blockers: []
    next_checkpoint: "claude-pr-pushed"  # Next expected state change
    branch: "feature/repair-admin-api"
    commit_count: 3
    
locked_files:  # Files no other agent may touch
  - apps/gs-web/src/lib/api-proxy.ts  # claude until 2026-08-15 16:00
  - apps/gs-web/src/components/admin/EmailManager.tsx  # claude
  
handoffs_needed:
  - from: "claude"
    to: "codex"
    trigger: "claude-pr-merged"
    files: ["apps/gs-api/src/db/migrations/007-drop-admin-schema.sql"]
    

pending_approvals:
  - type: "merge-to-stage"
    triggered_by: "codex"
    waiting_on: "human"
    link: "#12345"
```

**Every commit message must reference this**:
```bash
git commit -m "fix: add error logging to EmailManager

- Log fetch failures to console
- Enable error tracking in dev
- Ref: AGENT_STATE.md work-unit: admin-api-repair

[agent:claude] [status:in-progress]"
```

---

## Branch Access Rules (LOCKED)

### **Tier 1: Forbidden for Agents**
- ❌ `main` — humans only via GitHub UI after approval
- ❌ `production` — humans only, full audit trail required

### **Tier 2: Restricted**
- `claude/mcp-gs-api-worker-migration-0g51br` 
  - Agents may push IF:
    - Issue created with findings
    - AGENT_STATE.md updated
    - All commits tagged with `[agent:X]`

- `stage` (preview)
  - Agents may NOT merge directly
  - Must go through PR from feature branch
  - Require second-agent review + approval

### **Tier 3: Free for Agents**
- `feature/*` — create freely, coordinate via issue
- `audit/*` — investigation branches
- `agent/<name>/<type>/<task>` — individual agent work, requires daily state updates to AGENT_STATE.md

### **Enforcement**
Add this to `.github/branch-protection.json`:
```json
{
  "branch": "main",
  "required_status_checks": [
    "lint", "build", "test", "AGENT_SYNC_APPROVED"
  ],
  "dismissal_restrictions": {
    "users": ["marstonr6"],
    "teams": []
  },
  "require_code_owner_reviews": true,
  "require_approval_count": 1,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

---

## Pre-Commit Gate: The Synchronization Check

Every commit to `feature/*`, `claude/mcp-*`, or `agent/*` must pass:

**File**: `.husky/pre-commit-sync`
```bash
#!/bin/bash

# Fail if AGENT_STATE.md is out of date
LAST_STATE_UPDATE=$(git log -1 --format=%aI -- docs/AGENT_STATE.md 2>/dev/null)
NOW=$(date -u +%s)
STATE_AGE=$((NOW - $(date -d "$LAST_STATE_UPDATE" +%s)))

if [ "$STATE_AGE" -gt 1800 ]; then  # 30 minutes
  echo "❌ SYNC GATE FAILURE: docs/AGENT_STATE.md is stale"
  echo "   Last update: $LAST_STATE_UPDATE"
  echo "   Current time: $(date -u +%FT%TZ)"
  echo ""
  echo "Update AGENT_STATE.md before committing:"
  echo "  1. Review your changes"
  echo "  2. Update phase/status/blockers in AGENT_STATE.md"
  echo "  3. git add docs/AGENT_STATE.md"
  echo "  4. git commit (retry)"
  exit 1
fi

# Fail if commit message missing [agent:X]
if ! git log -1 --format=%B | grep -E '\[agent:(claude|codex|gemini|human)\]'; then
  echo "❌ SYNC GATE FAILURE: Commit must include [agent:X] tag"
  echo ""
  echo "Amend your commit:"
  echo "  git commit --amend -m 'your message [agent:claude]'"
  exit 1
fi

exit 0
```

Install:
```bash
chmod +x .husky/pre-commit-sync
```

---

## Daily Sync Ritual (Both Agents)

### **At Start of Shift**
1. Read latest `docs/AGENT_STATE.md`
2. Check open GitHub issues with `[handoff:needed]` tag
3. Verify no files you need are `locked_files`
4. If blocked, wait for lock to clear or post blocker

### **Every 2 Hours (or before context switch)**
1. Update AGENT_STATE.md with current progress
2. Commit state snapshot: `git commit -am "chore: sync state — phase 4 active"`
3. Post 2-line status to tracking issue

### **Before Handoff**
1. **Finalize** your work unit — merge PR or file clear status
2. **Document** in AGENT_STATE.md: what's done, what's next
3. **Update** issue: tag next agent, link to PR/commit
4. **Lock files** for next agent in AGENT_STATE.md
5. **Push state**: `git push origin <your-branch>`

---

## Conflict Resolution: The Arbitrator

If two agents try to edit same file or disagree on approach:

1. **Post blocker** to issue immediately
2. **Escalate** to `[status:blocked]` — halt commits to that file
3. **Arbitration**: 
   - If one agent has proven expertise in that subsystem → that agent decides
   - If equal expertise → human (marstonr6) decides via comment
   - If urgent (production fix) → lead agent (Claude for goldshore-ai) decides, post rationale
4. **Resolution** in AGENT_STATE.md locked_files → only winner may touch it
5. **Retry** after lock expires or other agent explicitly releases

---

## Success Criteria

After 1 week of locked operation, measure:

- ✅ **Coherence**: All commits traceable to AGENT_STATE.md phase
- ✅ **No conflicts**: Zero concurrent edits to same file
- ✅ **Sync rate**: AGENT_STATE.md updated within 30 min of code changes
- ✅ **Handoff clarity**: Every PR includes clear "next agent" step
- ✅ **Faster merges**: Because plan is pre-agreed, fewer review cycles

---

## Emergency Override: The Kill Switch

If a human must interrupt agent work:

1. Post `[EMERGENCY_OVERRIDE]` comment on issue
2. Agents **immediately halt commits**
3. Human updates AGENT_STATE.md phase to `6` (REVIEW)
4. Agents wait for human resolution
5. Document reason in AGENT_STATE.md

---

## This Protocol is Locked

This file is **read-only for agents** except:
- Typo fixes (format, grammar)
- Adding new work-unit templates (Phase 0 only)

To change governance rules, file an issue tagged `[governance]` and await human approval.

**Version**: 1.0  
**Approved by**: (pending user signature)  
**Agents bound**: Claude, Codex, Gemini  
**Enforcement**: pre-commit hook + branch rules + issue automation
