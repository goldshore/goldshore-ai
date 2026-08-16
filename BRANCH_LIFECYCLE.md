# BRANCH LIFECYCLE — Viable Branch Governance

> **Branch tagging and retirement protocol**  
> Prevents stale branches, merge conflicts, and technical debt accumulation  
> Effective: 2026-08-15

---

## Branch Status Tags (Mandatory)

Every branch MUST have one of these tags in its description:

### 🟢 **ACTIVE** — In active use
- Last commit: ≤ 7 days ago
- PR exists and is in review/merge process
- Lead agent assigned and actively working
- TTL: 30 days (auto-clean if no activity)

**Example**:
```bash
git branch -m old-branch-name new-branch-name
# Then add to GitHub branch description:
# [status:active] Lead: Claude | Phase: 4 | ETA: 2026-08-16
```

**Rule**: Active branches must update AGENT_STATE.md daily or auto-stale after 3 days

---

### 🟡 **FROZEN** — Paused but valuable
- Work halted temporarily (waiting for Codex, blocked on dependency, etc.)
- Will resume within 14 days
- Last commit: ≤ 14 days ago
- Reason documented in branch description

**Example**:
```
[status:frozen] Reason: waiting for Codex online
Lead: Claude | Paused: 2026-08-15 | Resume: 2026-08-16
Blocker: Codex compute offline
Related Issue: #1234
```

**Rule**: Frozen branches must have clear unblock condition + ETA

---

### 🔵 **ARCHIVED** — Historical reference
- Work is complete and merged to main/stage
- Kept for git blame/history traceability
- No new work permitted
- Last commit: > 30 days ago

**Example**:
```
[status:archived] Merged to main: 2026-08-14
Commit: c2a4956b
Reason: Feature complete, shipped to production
```

**Rule**: Archive after merge, do not re-open

---

### 🔴 **STALE** — Abandoned or rotting
- Last commit: > 30 days ago (auto-tagged by CI)
- No active PR
- No agent assigned
- Likely merge conflicts

**Action**: After 45 days stale → delete (with archive snapshot)

**Example**:
```
[status:stale] Auto-tagged 2026-08-15
Last commit: 2026-07-15 (31 days ago)
Action: Will delete 2026-08-29
Snapshot: github.com/marzton/goldshore-ai/archive/stale-branch-name.tar.gz
```

---

### ⚫ **PROTECTED** — Cannot be deleted
- Main, stage, or critical infra branch
- Set in GitHub branch protection rules
- Auto-tagged

**Example**:
```
[status:protected] Protected branch
Deletion blocked by GitHub rules
```

---

## Branch Naming Convention (Locked)

```
<status>/<owner>/<type>/<descriptor>

Where:
  status    = agent name or "hotfix"
  owner     = responsible agent (claude, codex, gemini)
  type      = feature|bugfix|hotfix|audit|docs|infra|chore
  descriptor = brief slug (kebab-case, max 30 chars)

Examples:
  feature/claude/admin/api-error-logging
  bugfix/codex/db/schema-mismatch-fix
  hotfix/claude/auth/jwt-validation
  audit/claude/admin/full-system-audit
  infra/gemini/cf/worker-binding-cleanup
  chore/codex/lockfile/pnpm-lock-regenerate
```

**Invalid** (will be flagged):
- ❌ `claude-fixes` (no type)
- ❌ `my-feature` (no owner)
- ❌ `FEATURE/CLAUDE/admin/fixes` (wrong case)
- ❌ `feature/claude/admin/this-is-a-very-long-descriptor-that-exceeds-limits` (too long)

---

## Branch Inventory (Registry)

Maintain in: `docs/BRANCH_REGISTRY.md`

**Auto-generated daily** via GitHub Actions. Manual edits forbidden (CI overwrites).

```markdown
# Branch Inventory — 2026-08-15

## ACTIVE Branches (3)
| Branch | Owner | Type | Last Commit | Age | ETA | PR |
|--------|-------|------|-------------|-----|-----|-----|
| feature/claude/admin/api-error-logging | claude | feature | 2026-08-15 14:35 | 0h | 2026-08-16 | #6552 |
| feature/codex/db/schema-cleanup | codex | feature | 2026-08-14 22:00 | 16h | 2026-08-16 | (pending) |
| hotfix/claude/auth/jwt-fix | claude | hotfix | 2026-08-15 10:00 | 4h | 2026-08-15 | #6540 |

## FROZEN Branches (2)
| Branch | Owner | Type | Paused | Reason | Resume ETA |
|--------|-------|------|--------|--------|------------|
| feature/codex/admin/site-builder | codex | feature | 2026-08-14 | Waiting on design specs | 2026-08-20 |
| audit/claude/cf/infrastructure-review | claude | audit | 2026-08-10 | Blocked on Codex review | 2026-08-16 |

## ARCHIVED Branches (24)
| Branch | Merged | Merged Into | Date | Commits |
|--------|--------|-------------|------|---------|
| feature/claude/web/homepage-redesign | ✅ | main | 2026-08-10 | 8 |
| feature/codex/api/oauth-integration | ✅ | main | 2026-08-09 | 12 |
| ... (20 more) | | | | |

## STALE Branches (5)
| Branch | Owner | Last Commit | Age | Action | Deadline |
|--------|-------|-------------|-----|--------|----------|
| feature/claude/ai/prompt-optimization | claude | 2026-07-15 | 31d | Delete | 2026-08-29 |
| feature/gemini/admin/docs-generator | gemini | 2026-07-10 | 36d | Delete | 2026-08-24 |
| ... (3 more) | | | | |

## PROTECTED Branches (3)
| Branch | Purpose | Last Update | Protection Level |
|--------|---------|-------------|------------------|
| main | Production | 2026-08-15 | Maximum |
| stage | Preview/Staging | 2026-08-15 | High |
| develop | Legacy (deprecated) | 2026-07-01 | Medium (marked for removal) |
```

---

## Lifecycle State Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│    CREATED (new branch from stage/main)                    │
│         ↓                                                   │
│    ┌────────────────────────────────────────┐              │
│    │ Tag: [status:active]                   │              │
│    │ Add to AGENT_STATE.md locked_files     │              │
│    │ Assign lead agent                      │              │
│    └────────────────────────────────────────┘              │
│         ↓                                                   │
│    ACTIVE (< 7 days old, PR open, agent working)          │
│         │                                                  │
│    ┌────┴────────────────────────────────────┐             │
│    │                                         │             │
│    ✓ PR MERGED                      ✗ PAUSED/BLOCKED      │
│    (no new commits expected)         (waiting for input)   │
│         │                                  │               │
│         ↓                                  ↓               │
│    ┌────────────────────┐         ┌──────────────────┐    │
│    │ ARCHIVED           │         │ FROZEN           │    │
│    │ Keep for history   │         │ Keep for resume  │    │
│    │ (30 days ref only) │         │ (≤14 days pause) │    │
│    └────────────────────┘         └──────────────────┘    │
│                                           │                │
│                                    [Resume work?]          │
│                                           │                │
│                                    YES: → ACTIVE           │
│                                    NO:  → ARCHIVED         │
│                                           ↓                │
│                                    ┌──────────────────┐    │
│                                    │ STALE (> 30 days)│    │
│                                    │ Auto-tag by CI   │    │
│                                    └──────────────────┘    │
│                                           │                │
│                                    [Fix & resume?]         │
│                                           │                │
│                                    YES: → ACTIVE           │
│                                    NO:  → DELETE (45 days) │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Automated Lifecycle Management

### GitHub Actions: `branch-hygiene.yml`

Runs daily at 2 AM UTC. Automatically:

1. **Tag STALE branches** (no commits in 30 days, no open PR)
   ```yaml
   - Branch age ≥ 30 days
   - No open PR
   - No agent assigned in AGENT_STATE.md
   → Add label: `stale`
   → Post warning comment on repo
   ```

2. **Archive snapshots** (when branches age 45+ days)
   ```bash
   git archive stale-branch-name > archive/stale-branch-name.tar.gz
   git push archive
   ```

3. **Delete stale branches** (45 days old)
   ```bash
   git branch -D old-branch-name
   # Log deletion to BRANCH_REGISTRY.md
   ```

4. **Sync BRANCH_REGISTRY.md**
   ```bash
   # Auto-generated from:
   # - git branch --list with descriptions
   # - GitHub API: PR status
   # - AGENT_STATE.md: active work units
   # Commit with: [ci:branch-hygiene] (no agent tag)
   ```

---

## Manual Branch Operations

### Create a New Feature Branch
```bash
# 1. Ensure you're on stage/main (latest)
git checkout stage
git pull origin stage

# 2. Create branch with naming convention
git checkout -b feature/claude/admin/api-error-logging

# 3. Add branch description (GitHub only via API or UI)
# Go to: https://github.com/marzton/goldshore-ai/branches
# Edit branch description:
# [status:active] Lead: Claude | Phase: 4 | ETA: 2026-08-16

# 4. Update AGENT_STATE.md with locked files
# (commit this, it's part of your work)

# 5. Make commits with [agent:X] tag
git commit -m "fix: add error logging [agent:claude]"
```

### Pause (Freeze) a Branch
```bash
# 1. Update branch description in GitHub UI:
# [status:frozen] Reason: Waiting for Codex | Resume: 2026-08-16

# 2. Update AGENT_STATE.md:
# - Set work_unit.status = "blocked"
# - Document blocker condition
# - Commit and push

git commit -am "chore: pause admin-api work — awaiting Codex [agent:claude]"
git push origin feature/claude/admin/api-error-logging
```

### Resume a Frozen Branch
```bash
# 1. Sync with stage first (may have conflicts)
git fetch origin stage
git rebase origin/stage

# 2. Update branch description:
# [status:active] Resume: 2026-08-16 | Phase: 4

# 3. Update AGENT_STATE.md:
# - Set status back to "in-progress"
# - Clear blocker reason
# - Commit

git commit -am "chore: resume admin-api work [agent:claude]"
git push origin feature/claude/admin/api-error-logging -f  # -f okay after rebase
```

### Close/Archive a Branch (After Merge)
```bash
# 1. After PR merges, update branch description:
# [status:archived] Merged to main: 2026-08-15 | Commit: c2a4956b

# 2. Do NOT delete the branch immediately
# It stays as reference for git blame/history

# 3. GitHub Actions will eventually archive it to tar.gz
# After 30 days: git branch -D feature/claude/admin/api-error-logging
```

### Force Delete a Branch (Emergency)
```bash
# Only if branch is truly junk (e.g., accidental merge)
# Requires: admin permissions

git push origin --delete feature/claude/bad-branch
# CI will log deletion with reason marker
```

---

## Branch Protection Rules (GitHub)

### Main Branch
```
✓ Require branches to be up to date
✓ Require status checks: lint, build, test
✓ Require code owner review
✓ Require approval from: marstonr6 (2 approvals)
✓ Dismiss stale reviews
✓ Require branches to be up to date before merging
✗ Allow force pushes: NO
✗ Allow deletions: NO
✗ Allow direct pushes: NO
```

### Stage Branch
```
✓ Require branches to be up to date
✓ Require status checks: lint, build, test, preview-deploy
✓ Require code owner review
✓ Require 1 approval (can be agent review)
✗ Allow force pushes: NO
✗ Allow deletions: NO
✗ Allow direct pushes: NO
```

### Feature/Audit/Hotfix Branches
```
✓ Require status checks: lint, build, test
✗ Code review: optional (agents handle via AGENT_STATE.md)
✗ Force pushes: allowed (after rebase)
✗ Deletions: allowed after merge
```

---

## Integration with AGENT_SYNC.md

**AGENT_SYNC** phase machine maps to **Branch Lifecycle**:

| Phase | Branch Status | Action |
|-------|---------------|--------|
| 0 DISCOVERY | [status:active] | Create audit/* branch |
| 1 BLOCKED | [status:frozen] | Tag blocker reason |
| 2 PLAN | [status:active] | Add to AGENT_STATE.md |
| 3 READY | [status:active] | Lock files in registry |
| 4 IN-PROGRESS | [status:active] | Daily status commits |
| 5 BLOCKED AGAIN | [status:frozen] | Update blocker |
| 6 REVIEW | [status:active] | PR open, code review |
| 7 MERGED | [status:archived] | Auto-tag after merge |
| 8 QA | [status:active] | Test on stage |
| 9 COMPLETE | [status:archived] | Retire branch |

**Rule**: If branch phase ≠ AGENT_STATE.md phase → CI warning (manual fix required)

---

## Reporting & Metrics

### Weekly Branch Health Report
Auto-generated by `.github/workflows/branch-report.yml`:

```markdown
# Branch Health Report — Week of 2026-08-15

## Summary
- Active branches: 3
- Frozen branches: 2
- Archived branches: 24
- Stale branches: 5 (auto-delete deadline: 2026-08-29)

## Warnings
⚠️ feature/gemini/admin/docs (36 days old) — auto-delete in 9 days
⚠️ feature/claude/ai/search (31 days old) — consider archiving

## Recommendations
1. Unfreeze audit/claude/cf or archive it (frozen since 2026-08-10)
2. Delete 5 stale branches to clean up repo
3. All active branches on schedule

## Action Items
- [ ] Owner: Resume or archive frozen branches by 2026-08-20
- [ ] CI: Auto-delete stale branches on 2026-08-29
```

### Branch Age Distribution
```
Age Distribution (all branches):
< 1 day:    ████████░░░░░░ 3 active
1-7 days:   ███████░░░░░░░░░░ 8 active
7-30 days:  ████░░░░░░░░░░░░░░░░░ 2 frozen, 3 archived
30-45 days: ██░░░░░░░░░░░░░░░░░░░░ 5 stale (flagged)
> 45 days:  ░░░░░░░░░░░░░░░░░░░░░░░ 0 (auto-deleted)

Oldest stale: 36 days (auto-delete 2026-08-24)
```

---

## FAQ

**Q: I need to pause my branch for 3 weeks. What do I do?**
A: Tag it `[status:frozen]` with reason + resume date. After 14 days, CI will flag it for cleanup. If you need > 14 days, re-freeze with new date or archive it.

**Q: Can I have 2 agents working on the same branch?**
A: No. Branches are owned by one lead agent. If second agent needed, either:
- Create second branch (codex/admin/schema-cleanup)
- Or add handoff in AGENT_STATE.md with lock on files

**Q: What if a branch is truly stale (completely abandoned)?**
A: CI auto-tags after 30 days. After 45 days, it's auto-deleted (after snapshot). If you want to keep it, unfreeze it or manually tag as `[status:archived]`.

**Q: Can I delete main/stage branches?**
A: No. They're `[status:protected]`. GitHub blocks deletion even for admins without override.

**Q: When should I archive a branch vs. keep it active?**
A: Archive when:
- Work is complete and merged
- No commits expected for ≥ 30 days
- But keep it for git blame/history (don't hard-delete)

**Q: How do I know which branch to work on next?**
A: Check `docs/AGENT_STATE.md` → `handoffs_needed` → that's your next assigned branch.

---

## Enforcement Checklist

- [ ] BRANCH_LIFECYCLE.md committed to repo
- [ ] All existing branches tagged with `[status:*]`
- [ ] `.github/workflows/branch-hygiene.yml` created
- [ ] `.github/workflows/branch-report.yml` created
- [ ] Branch naming convention enforced in CI
- [ ] BRANCH_REGISTRY.md auto-generated daily
- [ ] GitHub branch protection rules updated
- [ ] AGENT_STATE.md + BRANCH_LIFECYCLE.md sync rules documented
- [ ] Team trained on new lifecycle
- [ ] First stale-branch cleanup scheduled for 2026-08-29

---

**Status**: Ready for enforcement  
**Version**: 1.0  
**Locked**: Yes — only typo fixes by agents  
**Approval Required**: User (marstonr6)
