# Deprecated and Vulnerable Transitive Dependencies

> [!NOTE]
> **Document metadata**
> - **Single source of truth for:** deprecated/transitively vulnerable package tracking
> - **Last updated:** 2026-02-11
> - **Updated by:** manual
> - **Workflow update path:** `N/A` (manual-only updates at this time)

## Overview

These packages are marked as deprecated in `pnpm-lock.yaml` and should be updated when convenient. None are critical, but they represent technical debt.

## Packages to Update

### 1. ESLint Configuration Modules (Migration from legacy ESLint)

```
- @eslint/config-array (deprecated)
- @eslint/object-schema (deprecated)
```

**Action:** Update ESLint to latest version with new configuration system  
**Impact:** Code quality, linting  
**Effort:** Low - Usually automatic with ESLint upgrade

### 2. File Globbing (Security)

```
- glob (older versions)
```

**Issue:** Published security vulnerabilities, outdated implementation  
**Alternative:** Use `fast-glob` or node's built-in glob  
**Action:** Identify which package depends on old glob, update to modern alternative  
**Impact:** Security scan results  
**Effort:** Medium - May need to update build scripts

### 3. File Operations (Build Tools)

```
- rimraf (v3 - unsupported)
```

**Recommendation:** Update to rimraf v4-v6  
**Impact:** Build tooling stability  
**Action:** Update via pnpm upgrade  
**Effort:** Low

### 4. Memory/Caching (Stability)

```
- lru-cache (legacy version)
```

**Issue:** Memory leaks, not actively maintained  
**Action:** Update to current version  
**Impact:** Build performance, memory usage  
**Effort:** Low - Patch-compatible usually

## How to Update

### Option 1: Manual Update (Recommended)

```bash
pnpm list | grep "deprecated"  # Identify direct dependencies
pnpm up <package-name>          # Update to latest
pnpm install                    # Regenerate lock file
```

### Option 2: Full Dependency Audit

```bash
pnpm audit --fix                # Auto-fix vulnerable packages
```

### Option 3: Targeted Updates by Workspace

```bash
cd apps/gs-web
pnpm up
cd ../../
```

## Merge Step

After updates, commit with:

```bash
git add pnpm-lock.yaml package.json
git commit -m "chore: update deprecated transitive dependencies

Updates:
- ESLint modules to latest
- Removes old glob security warnings
- Updates rimraf to v4+
- Updates lru-cache to current version

This reduces dependency scan findings and improves build stability."
```

## Validation

After updating:

1. Run: `pnpm install` - Verify lock file regenerates cleanly
2. Run: `pnpm audit --prod` - Check for remaining issues
3. Run: `pnpm build` in each workspace - Verify builds pass
4. Commit and push

**Priority:** Medium (Nice-to-have, not blocking)  
**Time to Complete:** 15-30 minutes  
**Risk:** Low (Mostly patch-level updates)
