# Goldshore Project Organization Silo

**Purpose**: Centralized troubleshooting and environment management for goldshore-ai monorepo.

**Last Updated**: 2026-09-03  
**Maintained By**: Claude Code + Agent Network

---

## 🎯 Project Silos

### Primary Development Silo: `goldshore-ai`
- **Monorepo Type**: pnpm + Turborepo
- **Apps**: `gs-web` (Astro frontend), `gs-api` (Hono API)
- **Deployment**: Cloudflare Workers + Pages
- **Git**: Multiple remote branches, frequent agent work

### Sister Silos
- `goldshore` (goldshore.org) — Data/research arm
- `goldshore-gateway` — Subdomain routing (gs-platform worker)
- `goldshore-admin`, `goldshore-api` — Legacy (consolidating)

---

## 📦 Environment Tiers

| Tier | Branch | Workers | Database | URL | Status |
|------|--------|---------|----------|-----|--------|
| **Production** | `main` | gs-web, gs-api | PLATFORM_DB (prod) | goldshore.ai | ✅ Live |
| **Preview/Staging** | `preview/*` | gs-web-preview, gs-api-preview | PLATFORM_DB (preview) | preview.goldshore.ai | ⚠️ Testing |
| **Local Dev** | `claude/*`, `codex/*` | `wrangler dev` | Local D1 | localhost:8787 | 🔧 Development |

---

## 🔧 Common Git Issues & Fixes

### Issue #1: Local Branch Behind Main (Current)
**Problem**: Feature branches drift from `origin/main` (currently 50+ commits behind)

**Why It Happens**:
- Multiple agents push different branches
- Main receives frequent merges (6+ commits/day)
- Local branches not rebased automatically

**Quick Fix**:
```bash
git fetch origin
git rebase origin/main  # or git merge origin/main
git push -u origin <branch>
```

**Prevention**:
- Rebase daily: `git fetch && git rebase origin/main`
- Use pre-commit hook to check drift
- Merge main into long-lived branches weekly

---

### Issue #2: "Remote Main Never Works"
**Symptoms**:
- Build fails after pulling main
- Dependencies out of sync
- pnpm lock corruption
- Wrangler config conflicts

**Root Causes**:
1. **pnpm-lock.yaml conflicts** — Multiple agents running `npm install`
2. **Wrangler.toml drift** — Binding/env changes not coordinated
3. **Build-time validation failures** — CI checks that don't run locally
4. **Unmerged PR fixes** — Critical patches in PRs, not on main

**Diagnostic Workflow**:
```bash
# Step 1: Full clean state
git fetch origin
git checkout main
git reset --hard origin/main
pnpm install --force

# Step 2: Check build
pnpm build

# Step 3: Test each app
cd apps/gs-web && npm run build
cd ../gs-api && npm run build

# Step 4: Validate Wrangler
cd ../gs-api && wrangler deploy --dry-run
```

---

## 🤖 Agent Roles & Troubleshooting

### Claude (This Session)
- **Role**: Project architect, git operations, silo management
- **Responsibilities**:
  - Maintain PROJECT_ORGANIZATION.md
  - Coordinate cross-silo PRs
  - Troubleshoot build failures
  - Rebase branches on main drift
- **Tools**: Git, Bash, GitHub MCP

### Codex (Other Sessions)
- **Role**: Infrastructure & deployment fixes
- **Responsibilities**:
  - Fix Wrangler config issues
  - Repair CI/CD workflows
  - Debug Cloudflare bindings
- **Tools**: Cloudflare MCP, Bash

### Copilot (IDE Integration)
- **Role**: Real-time code review in VS Code
- **Responsibilities**:
  - Catch syntax/import errors
  - Suggest simplifications
- **Tools**: Inline linting

### Gemini (Antigravity)
- **Role**: Local testing & preview builds
- **Responsibilities**:
  - Verify builds locally before pushing
  - Test `wrangler dev` workflows
  - Screenshot preview URLs
- **Tools**: Terminal, Browser

---

## 📋 Pre-Push Checklist

Before pushing ANY branch to goldshore-ai:

- [ ] **Git sync**: `git fetch origin && git rebase origin/main`
- [ ] **Install**: `pnpm install --force` (if touched package.json)
- [ ] **Type check**: `pnpm --filter gs-web tsc --noEmit && pnpm --filter gs-api tsc --noEmit`
- [ ] **Build**: `pnpm build --filter gs-web && pnpm build --filter gs-api`
- [ ] **Lint**: `npx eslint . --max-warnings 0` (or configured limit)
- [ ] **Test**: `pnpm test` if new tests added
- [ ] **Wrangler**: `cd apps/gs-api && wrangler deploy --dry-run`

**If ANY step fails**: Fix locally before push. Do not force-push to remote.

---

## 🚀 Deployment Workflow

### From Feature Branch → Preview
1. Push feature branch to origin
2. GitHub Actions CI runs automatically
3. Preview URL appears in PR
4. Test preview URL against live database (preview env)
5. Codex reviews for blockers

### From Main → Production
1. PR approved and merged to main
2. CI runs full test suite
3. If passed: Auto-deploy to `gs-web` and `gs-api` workers
4. Cloudflare DNS updated
5. Monitor for errors in next 5 minutes

---

## 🔍 Debugging with Agents

### When Build Fails
```
→ Claude: Run diagnostic workflow above
→ Codex: Check Wrangler bindings & secrets
→ Gemini: Test locally with wrangler dev
→ Result: Fix pushed, PR updated
```

### When CI Passes but Deploy Fails
```
→ Claude: Check GitHub Actions logs
→ Codex: Review Cloudflare worker logs
→ Result: Rollback or hotfix
```

### When Main is "Broken"
```
→ Claude: Full clean checkout + build test
→ Codex: Check latest commits for regressions
→ Gemini: Test preview deployment
→ Result: Revert commit or fix in new PR
```

---

## 📊 Project Health Dashboard

### Current Status
- **Main Branch**: ✅ Passing (6d60fb1a)
- **Preview Env**: ⚠️ 50 commits behind (needs sync)
- **Local Dev**: 🔧 Per-agent branches
- **Deployment**: ✅ 5+ deploys/day, success rate 95%

### Monitoring
- **CI Status**: GitHub Actions → goldshore-ai workflows
- **Worker Logs**: Cloudflare Dashboard → Workers
- **Database**: D1 SQL query tool (ask Claude)

---

## 📝 Known Workarounds

### pnpm Lock Corruption
**Cause**: Running `npm install` on Termux/Android (wrong platform)  
**Fix**: `git checkout origin/main -- pnpm-lock.yaml && pnpm install`

### Wrangler Deploy Hangs
**Cause**: Old Wrangler cache  
**Fix**: `rm -rf .wrangler && wrangler deploy`

### Build Succeeds Locally, Fails in CI
**Cause**: Node version mismatch or lockfile difference  
**Fix**: `nvm use 20 && pnpm install --no-frozen-lockfile`

---

## 🛠️ Setup Instructions for New Agents

1. Clone repo: `git clone https://github.com/marzton/goldshore-ai.git`
2. Install: `pnpm install`
3. Read CLAUDE.md for bindings/secrets
4. Sync to main: `git checkout main && git pull origin main`
5. Create feature branch: `git checkout -b claude/your-task-name`
6. Follow Pre-Push Checklist before any git push

---

## 📞 Escalation Path

| Issue | Owner | Action |
|-------|-------|--------|
| Git sync stuck | Claude | Rebase/reset |
| Build fails on main | Codex | Revert/hotfix |
| Deploy failed | Codex | Rollback worker |
| pnpm corruption | Claude | Restore lock |
| Secrets missing | Codex | Re-add to Cloudflare |
| PR stuck in review | Claude | Ping reviewer |

---

**Next Action**: Run diagnostic workflow on main to confirm current state.
