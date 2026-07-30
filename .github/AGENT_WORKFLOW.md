# Multi-Agent Workflow Strategy

**Last Updated**: 2026-07-25

## Overview

This repository supports collaborative work by multiple AI agents (Claude, Codex, Jules, Copilot) without overwriting each other's changes.

## Environment Structure

### Branches & Environments

```
main (production)
  ├─ prod deployment
  ├─ Full CI checks
  └─ Blocked for direct agent pushes

stage (preview/staging)
  ├─ preview deployment
  ├─ Relaxed CI checks
  └─ Merge point for feature branches

agent/<agent-name>/<work-type>
  ├─ Individual agent working branch
  ├─ No CI deployment
  └─ PR → stage (then stage → main via manual approval)
```

### Deployment Strategy

| Branch | Deploys To | Audience | Auto? |
|--------|-----------|----------|-------|
| `main` | Production (goldshore.ai) | Public users | Yes |
| `stage` | Preview (preview.goldshore.ai) | Internal testing | Yes |
| `agent/*` | None (PR only) | Code review | No |

## Agent Workflow

### 1. Starting New Work

```bash
# Clone and fetch latest
git clone https://github.com/marzton/goldshore-ai.git
cd goldshore-ai
git fetch origin main stage

# Create feature branch from stage (not main)
git checkout -b agent/claude/feature/my-feature origin/stage
```

**Why `stage` not `main`?**
- `stage` is designed for agent work
- `main` is production-locked
- Agents merge PR → stage → main (never directly to main)

### 2. Working on Files

#### Use Namespace Prefixes

```bash
# ✅ Good: Specific scope
agent/claude/feature/auth-flow
agent/codex/bugfix/payment-validation
agent/jules/hotfix/cloudflare-dns

# ❌ Avoid: Vague scope
agent/claude/fixes
agent/codex/updates
```

#### Claim Files with Issue Comments

**Before editing a file**, comment on a GitHub issue:
```
[agent:claude] [status:in-progress]
Working on: apps/gs-api/src/auth/index.ts
 Branch: agent/claude/feature/oauth-integration
ETA: 2026-07-26
```

This prevents two agents from editing the same file simultaneously.

#### Pull Latest Before Major Edits

```bash
# Sync with stage before large edits
git fetch origin stage
git rebase origin/stage

# Resolve any conflicts
# ...

git push origin agent/claude/feature/my-feature --force-with-lease
```

### 3. Commit Messages

**Format**:
```
[agent:claude] [env:preview] Brief description

Long description if needed.

Merge Strategy: Squash
Related Issue: #1234
Agent: claude
```

**Merge Strategy Options**:
- `Merge Strategy: Squash` — For feature work (preferred)
- `Merge Strategy: Merge Commit` — For infrastructure/docs changes

### 4. Push & Create PR

```bash
# Push to agent branch
git push origin agent/claude/feature/my-feature

# Create PR against stage (NOT main)
# GitHub UI will default to main; change base to 'stage'
```

**PR Checklist**:
- [ ] Title: `[claude] Brief description`
- [ ] Description includes merge strategy
- [ ] Base branch: `stage` (not `main`)
- [ ] No conflicts with `stage`
- [ ] CI checks passing

### 5. Review & Merge to Stage

**Review Process**:
1. Code review (can be automated or manual)
2. Approve
3. **Squash & Merge** (or "Merge Commit" if specified)
4. Delete agent branch after merge

**After PR Merged to Stage**:
```bash
# Local cleanup
git fetch origin
git branch -D agent/claude/feature/my-feature
git checkout stage
git pull origin stage
```

### 6. Stage → Main (Manual Promotion)

**When to Promote Stage to Main**:
- All preview tests passing
- At least 1 hour soak time on stage
- No known regressions
- Owner approval

**Promotion Process**:
```bash
# Owner only
git checkout main
git pull origin main
git merge --no-ff origin/stage -m "chore: promote stage to main"
git push origin main
```

OR use GitHub UI: Create a PR from `stage` → `main`, marked as `[release]`.

## Conflict Avoidance

### File Ownership Pattern

Use **issue claims** to avoid concurrent edits:

**Issue Template**:
```markdown
## [agent:claude] Feature: OAuth Flow

**Files**: 
- apps/gs-api/src/auth/oauth.ts
- apps/gs-web/src/pages/login.astro

**Status**: [status:in-progress]
**Branch**: agent/claude/feature/oauth-flow
**ETA**: 2026-07-26

---

**Agents**: Please comment below if you need to edit these files.
```

### Lockfile Conflicts

If `pnpm-lock.yaml` has conflicts:

```bash
# In your agent branch
rm pnpm-lock.yaml
pnpm install  # Regenerate against latest deps
git add pnpm-lock.yaml
git commit -m "chore: resolve lockfile conflicts"
git push origin agent/claude/feature/my-feature
```

### Large Edits Across Multiple Agents

**Stagger Work**:
1. Claude: Implement backend changes
2. Claude PR → stage (wait for merge + test)
3. Codex: Implement frontend changes
4. Codex PR → stage (wait for merge + test)
5. Jules: Infrastructure/config updates
6. Jules PR → stage
7. Owner: Promote stage → main

## CI/CD Pipeline

### Checks on Agent Branches
- ✅ Lint
- ✅ Build
- ✅ Tests
- ✅ Lockfile validation
- ❌ Deploy (never from agent branches)

### Checks on Stage
- ✅ All agent checks
- ✅ Preview deployment
- ✅ Smoke tests
- ❌ Production deploy

### Checks on Main
- ✅ All checks
- ✅ Production deployment
- ✅ Post-deploy health checks

## Emergency Procedures

### Hotfix in Production

```bash
# 1. Create hotfix branch from main
git checkout -b agent/claude/hotfix/critical-bug origin/main

# 2. Fix the issue
# ... edit files ...

# 3. Test locally
pnpm install && pnpm build

# 4. Push and create PR (base: main)
git push origin agent/claude/hotfix/critical-bug
# Create PR from hotfix → main (NOT stage)

# 5. After merge to main, back-merge to stage
git checkout stage
git pull origin stage
git merge origin/main
git push origin stage
```

### Rollback from Production

```bash
# If production deploy fails
git revert <commit-sha>  # in main
git push origin main

# Wait for new CI run
# Rollback deployment will be triggered
```

## Best Practices

1. **Communicate Early**: Use issue comments for file claims
2. **Keep PRs Small**: ≤500 lines per PR when possible
3. **Test Locally**: Run `pnpm build` and `pnpm test` before pushing
4. **Rebase, Not Merge**: Use `git rebase origin/stage` to keep history clean
5. **Use Merge Strategy Header**: Always include merge strategy in commit messages
6. **Never Force Push to Main**: Main is protected; force pushes are blocked
7. **Document Breaking Changes**: Add migration notes to PR description

## Tooling

### Useful Scripts

```bash
# Check which agent branches are active
gh pr list --state open --json number,title,headRefName | grep "agent/"

# Sync agent branch with stage
git fetch origin stage && git rebase origin/stage

# Clean up old branches
git branch -vv | grep 'origin.*gone' | awk '{print $1}' | xargs git branch -D
```

## FAQ

**Q: Can I push directly to main?**
A: No. Main is protected. All changes must come via PR from stage.

**Q: What if my PR conflicts with another agent's work?**
A: Resolve conflicts in your agent branch, test locally, and push again. If needed, coordinate via issue comments.

**Q: How do I know if a file is being edited?**
A: Check the issue board for `[status:in-progress]` tags and open PRs listing the file.

**Q: How long should I wait before promoting stage to main?**
A: Minimum 1 hour after all PRs merge to stage. Monitor logs for errors.
