# CI/CD, Secrets, and Deployment Policy

**Authority:** gs-control service owner (Platform ops)  
**Enforced by:** GitHub Actions validation, Cloudflare API guards  
**Last updated:** 2026-04-24  
**Review cycle:** Quarterly

---

## Secret Contract (Canonical)

### Primary Token

| Secret | Purpose | Scope | Owner | Rotation |
|---|---|---|---|---|
| `CLOUDFLARE_BUILD_API_TOKEN` | Deploy all workers + infra operations | All gs-* workers, Pages, API calls | gs-control service owner | 90 days |

### Secondary Secrets (Per-Service)

| Secret | Service | Purpose | Owner |
|---|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | All | Identify Cloudflare account | Platform ops |
| `OPENAI_API_KEY` | gs-api, banproof-me | External AI inference | Service owner |
| `GEMINI_API_KEY` | gs-api (optional) | External AI inference | Service owner |
| `POA_TOKEN` | banproof-me | Proof of Agency protocol | BanProof owner |
| `AUDIT_TOKEN` | banproof-me | Audit logging | BanProof owner |

---

## Deployment Token Policy

### ✅ REQUIRED: Use canonical token

```yaml
# .github/workflows/deploy-gs-api.yml
env:
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_BUILD_API_TOKEN }}
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

steps:
  - name: Deploy to Cloudflare
    run: wrangler deploy --env prod
```

### ❌ PROHIBITED: Fallback expressions (except explicit migration windows)

```yaml
# WRONG — do not do this
env:
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_BUILD_API_TOKEN || secrets.CLOUDFLARE_API_TOKEN }}
  # ↑ This allows fallback to a different token — breaks audit trail
```

### ❌ PROHIBITED: Inline tokens

```yaml
# WRONG — never hardcode
env:
  CLOUDFLARE_API_TOKEN: "z3d3e6f4a9b2c1d5e8g7h6i9j2k..."
```

---


### Migration behavior from `CLOUDFLARE_API_TOKEN`

- CI/deploy and infra automation must use `secrets.CLOUDFLARE_BUILD_API_TOKEN` as the primary and only token source.
- Backward compatibility is handled by **secret mirroring at the repository/org secret store**, not by workflow `||` expressions.
- During migration, platform ops may keep `CLOUDFLARE_API_TOKEN` secret value synchronized to the same token out-of-band, then remove legacy secret references after verification.
- Workflow-level fallback (`secrets.A || secrets.B`) is disallowed because it obscures which credential was used during deployment.

## Workflow Standards

### All Deploy Workflows Must:

1. **Validate before deploy**
   ```yaml
   - name: Validate worker structure
     run: pnpm run validate:structure
   ```

2. **Use canonical token only**
   ```yaml
   env:
     CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_BUILD_API_TOKEN }}
   ```

3. **Log deployment metadata**
   ```yaml
   - name: Log deployment
     run: echo "Deployed ${{ github.sha }} to ${{ matrix.env }} at $(date)"
   ```

4. **Fail fast on secret missing**
   ```yaml
   - name: Check secrets
     run: |
       [[ -n "$CLOUDFLARE_BUILD_API_TOKEN" ]] || { echo "Missing CLOUDFLARE_BUILD_API_TOKEN"; exit 1; }
       [[ -n "$CLOUDFLARE_ACCOUNT_ID" ]] || { echo "Missing CLOUDFLARE_ACCOUNT_ID"; exit 1; }
   ```

5. **Protect sensitive output**
   ```yaml
   - name: Deploy
     run: wrangler deploy --env prod
     env:
      # Secrets are automatically masked by GitHub Actions
      # Do NOT add | grep, echo, or cat on secret values
   ```

---

## Lockfile Guards

### `pnpm-lock.yaml`

**Policy:** No dependency version updates without explicit PR review.

**CI Guard:**
```bash
# scripts/check-lockfile-safety.sh
if git diff HEAD~1 pnpm-lock.yaml | grep -q '^+.*"version"'; then
  echo "❌ Lockfile was updated. This requires dependency review."
  exit 1
fi
```

**Allowed changes:**
- `pnpm install` (adds packages, approved in PR)
- Dependabot PRs (see Dependabot policy below)

**Blocked changes:**
- Manual lockfile edits
- Version bumps without `pnpm add/update` commands

---

## Dependabot Configuration

### File: `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "03:00"
    open-pull-requests-limit: 5
    reviewers:
      - "marzton"
    assignees:
      - "marzton"
    labels:
      - "dependencies"
      - "[type] maintenance"
    allow:
      - dependency-type: "direct"
    ignore:
      - dependency-name: "wrangler"
        versions: ["5.x"]  # Ignore breaking changes
    commit-message:
      prefix: "[deps]"
```

### Auto-Merge Rules for Dependabot

**✅ Auto-merge allowed:**
- Patch updates (`1.2.3` → `1.2.4`) with passing tests
- Dev dependencies only (no runtime deps)
- Security updates (marked `cvss_score >= 5`)

**❌ Auto-merge blocked:**
- Major version updates
- Runtime dependency updates
- Transitive dependency updates

**Workflow:**
```yaml
# .github/workflows/dependabot-auto-merge.yml
name: Dependabot Auto-Merge
on: pull_request

jobs:
  auto-merge:
    if: github.actor == 'dependabot[bot]'
    runs-on: ubuntu-latest
    steps:
      - name: Check tests pass
        run: gh pr checks ${{ github.event.pull_request.number }} --required
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Check semver
        run: |
          # Only auto-merge patch/minor updates
          VERSION_CHANGE=$(gh pr view ${{ github.event.pull_request.number }} --json title -q '.title' | grep -o "[0-9]\.")
          if [[ "$VERSION_CHANGE" == "major" ]]; then
            echo "Major version update — skipping auto-merge"
            exit 1
          fi

      - name: Auto-merge
        run: gh pr merge ${{ github.event.pull_request.number }} --auto --squash
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Code Review Requirements

### Branch Protection: `main`

```
Settings → Branches → Branch protection rules → main

✓ Require a pull request before merging
  • Require approvals: 1
  • Dismiss stale pull request approvals: YES
  
✓ Require status checks to pass before merging
  • Required checks:
    - "Tests"
    - "Lint"
    - "Validate (worker structure)"
    - "Validate (naming)"
    - "Validate (workspace)"
    - "Check (lockfile safety)"
  
✓ Require branches to be up to date before merging: YES

✓ Require a conversation resolution before merging: YES

✓ Require code owner reviews: YES
  File: .github/CODEOWNERS
```

### CODEOWNERS

```
# .github/CODEOWNERS

# Infrastructure
infra/Cloudflare/   @marzton
apps/gs-control/    @marzton
apps/gs-api/        @marzton
apps/gs-gateway/    @marzton

# Frontend
apps/gs-web/        @marzton
apps/gs-admin/      @marzton

# Auth (security-sensitive)
packages/auth/      @marzton

# Everything else
*                   @marzton
```

---

## Pre-Merge Safeguards

### Prohibited Files in Commits

**Block these patterns:**

```bash
# .gitignore additions (security)
^\.env
^env\.secrets
^dist/
^node_modules/
^\.astro/
^.*\.key$
^.*\.pem$

# Temporary build artifacts
^\.next/
^out/
^\.turbo/
^coverage/

# Generated files (except migrations/schemas)
^apps/.*/src/generated/.*
^!(schemas/|migrations/)
```

**GitHub Actions check:**

```yaml
# .github/workflows/check-forbidden-files.yml
name: Check Forbidden Files
on: pull_request

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check for secrets and artifacts
        run: |
          forbidden_patterns=(
            '\.env'
            'env\.secrets'
            '\.key$'
            '\.pem$'
            'node_modules/'
            'dist/'
            'coverage/'
          )
          
          has_forbidden=false
          for pattern in "${forbidden_patterns[@]}"; do
            if git diff --cached --name-only | grep -q "$pattern"; then
              echo "❌ Forbidden file pattern found: $pattern"
              has_forbidden=true
            fi
          done
          
          if [[ "$has_forbidden" == true ]]; then
            exit 1
          fi
```

---

## Audit Logging & Compliance

### Deployment Audit Trail

Every deployment logs:
- Timestamp
- Committer
- Commit SHA
- Environment (prod/preview/dev)
- Worker name
- Build duration
- Success/failure

**Log destination:** GitHub Actions artifacts + Cloudflare deployment history

### Monthly Audit Report

```bash
# Generate audit report
gh api repos/marzton/goldshore-ai/actions/runs \
  --paginate \
  -q '.workflow_runs[] | {conclusion, created_at, name}' \
  > reports/ci-audit-monthly.json

# Review for anomalies
grep -i failure reports/ci-audit-monthly.json
```

---

## Rollback Policy

### If a Deployment Fails

1. **Do NOT re-run immediately.** Diagnose first.
2. **Check logs:** GitHub Actions → Workflow → Step output
3. **Rollback if critical:**
   ```bash
   wrangler deployments rollback --name gs-api --message "Rolled back due to [reason]"
   ```
4. **Post-mortem:** File issue, update docs

### If a Secret Leaks

1. **Rotate immediately:**
   ```bash
   # Cloudflare dashboard → API Tokens → Rotate
   ```
2. **Re-create GitHub secret** with new value
3. **Update all deployments** that use it
4. **File security issue** (private report)

---

## Secrets Checklist

### Before Each Deploy

- [ ] `CLOUDFLARE_BUILD_API_TOKEN` is set in GitHub secrets
- [ ] `CLOUDFLARE_ACCOUNT_ID` is set
- [ ] No fallback expressions in workflows
- [ ] No hardcoded tokens in code/commits
- [ ] Worker wrangler.toml references bindings correctly
- [ ] Lockfile has no suspicious changes
- [ ] All required status checks are passing
- [ ] PR has required approvals

---

## FAQ

### Q: I need to deploy a one-off fix to production. Can I use `wrangler deploy` locally?
**A:** No. All deployments must go through GitHub Actions for audit trail. Push to a branch, file PR, get approved, merge to main. GitHub Actions deploys.

### Q: What if I don't have the `CLOUDFLARE_BUILD_API_TOKEN`?
**A:** Request it from the gs-control service owner (Platform ops). Never use your personal Cloudflare token — it breaks the audit trail.

### Q: Can I commit a secret to the repo "temporarily"?
**A:** No. Treat it as a security breach immediately. Rotate the token.

### Q: How do I know if a Dependabot PR is safe to auto-merge?
**A:** The workflow checks: (1) tests pass, (2) it's a patch/minor update, (3) no breaking changes in the CHANGELOG. If all pass, it's safe.

---

## Related Documents

- `policy/REPO_OWNERSHIP.md` — Service locations and build paths
- `policy/ROUTE_POLICY.md` — Domain and route ownership
- `docs/DEPLOYMENT_RUNBOOK.md` — Step-by-step deployment guide
