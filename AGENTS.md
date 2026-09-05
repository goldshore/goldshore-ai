# Agent Coordination & Troubleshooting Guide

**Purpose**: Define agent roles, communication patterns, and escalation for goldshore-ai troubleshooting.

**Audience**: Claude, Codex, Copilot, Gemini, and future agents working on goldshore  
**Updated**: 2026-09-03

---

## 🤖 Agent Registry

### Claude (Primary)
- **Primary Session**: Claude Code web/CLI
- **Specialization**: Architecture, git operations, build coordination
- **Availability**: 24/7 web sessions + local Claude Code
- **Responsibilities**:
  - Manage PROJECT_ORGANIZATION.md
  - Coordinate multi-repo PRs
  - Rebase feature branches on main drift
  - Run diagnostic workflows
  - Consolidate chat context

### Codex (Secondary)  
- **Primary Session**: Antigravity IDE (Google)
- **Specialization**: Infrastructure, Wrangler configs, CI/CD
- **Availability**: Local machine (D:\goldshore)
- **Responsibilities**:
  - Fix Wrangler.toml bindings
  - Repair Cloudflare Access configs
  - Debug worker routing issues
  - Investigate deploy failures
  - Rotate secrets and credentials

### Copilot (Inline)
- **Specialization**: Code review, simplification
- **Responsibilities**:
  - Catch syntax errors before commit
  - Suggest refactoring opportunities
  - Validate TypeScript types

### Gemini (Testing)
- **Specialization**: Local testing, preview validation
- **Responsibilities**:
  - Run `wrangler dev` locally
  - Test preview URLs
  - Screenshot production issues
  - Validate env variable configs

---

## 🚨 Troubleshooting Escalation

### "Main is Broken" Workflow
1. **Claude** → Run diagnostic: `git fetch && git checkout main && git reset --hard && pnpm install --force && pnpm build`
2. **Codex** → Check for recent breaking commits: `git log -5 --oneline`
3. **Codex** → If pnpm issue: restore lock from main
4. **Codex** → If Wrangler issue: validate bindings match Cloudflare
5. **Gemini** → Test `wrangler dev` locally
6. **Result** → Revert commit or merge hotfix

### "PR Passes CI but Deploy Fails" Workflow
1. **Claude** → Check GitHub Actions logs
2. **Codex** → Review Cloudflare worker logs: `wrangler tail <worker> --env production`
3. **Codex** → Check if secrets/bindings are missing
4. **Result** → Rollback or hotfix

### "Feature Branch Behind Main" Workflow
1. **Claude** → `git fetch && git rebase origin/main` (or merge if many conflicts)
2. **Claude** → `git push -u origin <branch> --force-with-lease`
3. **Claude** → Re-run pre-push checklist
4. **Result** → Branch synced, ready to merge

---

## 📋 Pre-Push Checklist

Before ANY push to goldshore-ai:

```bash
git fetch origin
git rebase origin/main  # or merge if needed
pnpm install --force
pnpm build
pnpm tsc --noEmit --workspace
cd apps/gs-api && wrangler deploy --dry-run
```

**Failure handling**: Fix locally, do NOT force-push.

---

## 🔍 Common Fixes

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| `pnpm install` fails | pnpm lock corruption | `git checkout origin/main -- pnpm-lock.yaml` |
| Build type errors | Main has breaking changes | `git rebase origin/main`, resolve conflicts |
| Deploy hangs | Stale Wrangler cache | `rm -rf .wrangler` |
| Worker 502 errors | Missing env binding | Codex verifies wrangler.toml bindings |
| Feature branch 50 commits behind | Branch not synced | Claude rebases on main |

---

## 💬 Chat Consolidation

**Keep in repo** (durable):
- PROJECT_ORGANIZATION.md
- AGENTS.md (this file)
- CLAUDE.md
- TROUBLESHOOTING.md

**Keep in chat** (real-time):
- Decision logs
- Pair programming notes
- One-off questions

**Consolidate to GitHub** (shareable):
- Recurring issues → Create issue, tag agents
- Blockers → Create issue, mention in PR

---

## ✅ Health Check

**Current Status** (2026-09-03):
- Main: ✅ Passing (6d60fb1a)
- Feature branches: ⚠️ 50 commits behind
- Preview: 🔧 Needs sync
- Production: ✅ Deploying

**Next actions**:
1. Claude: Rebase feature branches on main
2. Codex: Verify all Wrangler configs
3. All: Follow pre-push checklist before next push

---

**Maintainer**: Claude | **Last Review**: 2026-09-03 | **Next Review**: Weekly
