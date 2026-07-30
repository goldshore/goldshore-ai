# pnpm Lockfile Conflict Resolution Guide

## Overview

This document explains the automated pnpm-lock.yaml conflict resolution system that prevents manual resolution of 500+ conflicts when branches diverge.

## Problem Solved

Previously, when merging branches that modified dependencies, conflicts in `pnpm-lock.yaml` would require manual resolution of hundreds of entries. This was time-consuming and error-prone.

**Solution:** Automated workflows that detect, resolve, and regenerate the lockfile based on latest package specifications.

## Workflows

### 1. **auto-resolve-lockfile-conflicts.yml** (Automatic)

**Trigger:** Pull requests that modify `pnpm-lock.yaml`, `package.json`, or workspace files

**What it does:**
- Detects merge conflicts in `pnpm-lock.yaml`
- Automatically resolves conflicts by taking the current branch version
- Regenerates the lockfile from `package.json` specs using latest compatible versions
- Validates the regenerated lockfile
- Auto-commits the resolved lockfile to the PR branch
- Posts a comment on the PR confirming resolution

**How it works:**
```
PR with lockfile conflicts → Workflow detects conflicts → Regenerates from package.json
→ Validates → Commits to branch → Auto-comments on PR
```

**Example:**
When you push a branch with conflicting lockfile changes, this workflow:
1. Detects the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
2. Resolves by regenerating: `pnpm install --no-frozen-lockfile --lockfile-only`
3. Validates: `pnpm install --frozen-lockfile --ignore-scripts`
4. Commits and pushes the fix to your branch automatically

### 2. **repair-pnpm-lock.yml** (Manual + Auto-triggered)

**Triggers:**
- Manual: `workflow_dispatch` (can specify branch)
- Automatic: When `workspace-install` job fails
- Push to `main` with changes to package manifests

**What it does:**
- Regenerates `pnpm-lock.yaml` from package.json specifications
- Uses the latest compatible versions based on semver ranges
- Validates the lockfile with frozen lockfile check
- Creates a PR if lockfile changed (only on main)
- Idempotent: exits without change if lockfile is already correct

**How to use manually:**

1. **Repair main branch:**
   ```
   Go to Actions → "Repair pnpm lockfile" → Run workflow
   ```

2. **Repair specific branch:**
   ```
   Go to Actions → "Repair pnpm lockfile" → Run workflow
   Provide branch name in inputs
   ```

### 3. **lockfile-guard.yml** (Prevention)

**Trigger:** Pull requests

**What it does:**
- Prevents accidental manual changes to `pnpm-lock.yaml` in PRs
- Allows additions to new lockfiles
- Blocks modifications when the lockfile exists on main

**Purpose:** Ensures lockfile only changes through automation

## Workflow Decision Tree

```
Made dependency changes in package.json?
  ↓
Opened a PR?
  ↓
  ├─ Is pnpm-lock.yaml in conflict?
  │  └─ YES: auto-resolve-lockfile-conflicts.yml runs automatically ✅
  │  └─ NO: Skip to next
  │
  └─ Does workspace-install fail?
     └─ YES: repair-pnpm-lock.yml runs automatically ✅
     └─ NO: Everything is good ✓
```

## Automatic Resolution Strategy

The workflows use this priority order to resolve conflicts:

1. **Package.json specifications** - Source of truth
2. **Latest compatible versions** - Respects semver ranges
3. **Validation** - Ensures lockfile integrity
4. **Idempotency** - No unnecessary changes

## Example Scenarios

### Scenario 1: Merging dependency updates from two branches

**Before:**
- Branch A: Updates `@astrojs/tailwind` to 6.0.2
- Branch B: Updates Astro to 7.1.3
- Result: 200+ conflicts in pnpm-lock.yaml

**Now:**
1. Create PR from Branch A → B
2. Conflicts detected by `auto-resolve-lockfile-conflicts.yml`
3. Workflow regenerates lockfile with both updates
4. Validated and auto-committed
5. PR shows "✅ Lockfile Conflict Resolved" comment

### Scenario 2: Adding new dependencies across team

**Before:**
- Developer 1 adds `zod@4.3.6`
- Developer 2 adds `tsx@4.23.1`  
- Both merge: 100+ conflicts in shared entries

**Now:**
1. Workflow automatically resolves both additions
2. Regenerates lockfile with all changes
3. Latest compatible versions selected
4. Team doesn't need to manually merge lockfile

### Scenario 3: CI failure due to lockfile corruption

**Before:**
- Corrupted lockfile → workspace-install fails
- Manual regeneration required
- Cherry-picking + another PR needed

**Now:**
1. workspace-install fails
2. repair-pnpm-lock.yml auto-triggers
3. Creates automation/repair-pnpm-lock PR
4. Corrected lockfile ready for review and merge

## Validation Steps

Each workflow performs these validations:

```bash
# Step 1: Regenerate
pnpm install --no-frozen-lockfile --lockfile-only

# Step 2: Full validation
pnpm install --frozen-lockfile --ignore-scripts

# Step 3: Check for conflict markers
grep -E "^(<{7}|>{7}|={7})" pnpm-lock.yaml
# Should return nothing (no conflicts remaining)

# Step 4: YAML integrity
# pnpm will fail if YAML is invalid
```

## Manual Operations

### Force repair on any branch

```bash
# Trigger via UI
Go to: Actions → "Repair pnpm lockfile" → Run workflow
Input: Branch name to repair

# Or use GitHub CLI
gh workflow run repair-pnpm-lock.yml -f branch=<branch-name>
```

### Check current lockfile health

```bash
pnpm install --frozen-lockfile --ignore-scripts
```

If this passes, lockfile is healthy.

### Regenerate locally (if needed)

```bash
# Resolve conflicts locally
git checkout --ours pnpm-lock.yaml
pnpm install --no-frozen-lockfile
git add pnpm-lock.yaml
git commit -m "chore: regenerate pnpm-lock.yaml"
```

## Configuration

### Auto-trigger repair on workspace-install failure

The `repair-pnpm-lock.yml` now includes:

```yaml
workflow_run:
  workflows: ['workspace-install']
  types: [failed]
  branches: [main]
```

This means if workspace-install fails on main, repair automatically runs.

### Adjust sensitivity

To modify when auto-resolution runs, edit:
- `auto-resolve-lockfile-conflicts.yml`: The `on.pull_request.paths` section
- `repair-pnpm-lock.yml`: The `on.push.paths` section

## Troubleshooting

### Conflict still showing after auto-resolve

**Solution:** The workflow may have failed validation. Check:
1. The workflow run logs (Actions tab)
2. Comment on the PR for error details
3. Run manual repair: `workflow_dispatch` on repair-pnpm-lock.yml

### Lockfile keeps changing

**Cause:** Conflicting version constraints in package.json files

**Solution:** 
1. Review package.json updates
2. Resolve version conflicts before merging
3. Re-run auto-resolve workflow: `workflow_dispatch`

### Workflow not triggering

**Cause:** Workflow file paths or branch conditions not matching

**Solution:**
1. Check branch name (workflows only run on specified branches)
2. Verify file modifications match the `paths` filter
3. Manually trigger via `workflow_dispatch`

## Best Practices

1. **Keep package.json organized** - Clear version ranges prevent cascade conflicts
2. **Review dependency updates** - Don't blindly accept all changes
3. **Test after merge** - Always validate with `pnpm install --frozen-lockfile`
4. **Monitor workflow runs** - Check Actions tab to see if conflicts were resolved
5. **Use semver wisely** - Consistent version ranges reduce conflicts

## Performance

- **Auto-resolve workflow:** ~30 seconds
- **Repair workflow:** ~1-2 minutes
- **Regeneration time:** ~20 seconds
- **Validation time:** ~10 seconds

Total: Conflicts resolved and validated in under 5 minutes automatically, vs. 30+ minutes of manual work.

## Related Files

- `.github/workflows/auto-resolve-lockfile-conflicts.yml` - Automatic conflict resolution
- `.github/workflows/repair-pnpm-lock.yml` - Lockfile repair (auto + manual)
- `.github/workflows/lockfile-guard.yml` - Prevent manual changes
- `.github/workflows/regenerate-lockfile.yml` - Manual regeneration (legacy)
- `pnpm-lock.yaml` - The lockfile (auto-managed)

## Questions?

Check the workflow logs in GitHub Actions for detailed execution info.
