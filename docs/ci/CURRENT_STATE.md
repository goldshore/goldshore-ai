# Stabilization Sync Check Report

**Date:** Wed, 25 Feb 2026 20:51:35 GMT

## 1. Governance Compliance Check

### ❌ Violations Detected
- Unpinned CI Actions detected (must use SHA): actions/checkout is unpinned (uses @v4) in archive-path-guard.yml, actions/checkout is unpinned (uses @v4) in canonical-structure-check.yml, actions/setup-node is unpinned (uses @v4) in canonical-structure-check.yml, pnpm/action-setup is unpinned (uses @v4) in deploy-gs-admin.yml, actions/setup-node is unpinned (uses @v6) in deploy-gs-admin.yml, cloudflare/pages-action is unpinned (uses @v1) in deploy-gs-admin.yml, pnpm/action-setup is unpinned (uses @v4) in deploy-gs-api.yml, actions/setup-node is unpinned (uses @v6) in deploy-gs-api.yml, actions/checkout is unpinned (uses @v4) in deploy-gs-mail.yml, pnpm/action-setup is unpinned (uses @v4) in deploy-gs-mail.yml, actions/setup-node is unpinned (uses @v6) in deploy-gs-mail.yml, pnpm/action-setup is unpinned (uses @v4) in deploy-gs-web.yml, actions/setup-node is unpinned (uses @v6) in deploy-gs-web.yml, cloudflare/pages-action is unpinned (uses @v1) in deploy-gs-web.yml, actions/checkout is unpinned (uses @v4) in lockfile-guard.yml, actions/checkout is unpinned (uses @v4) in naming-lint.yml, pnpm/action-setup is unpinned (uses @v4) in naming-lint.yml, actions/setup-node is unpinned (uses @v6) in naming-lint.yml, actions/setup-node is unpinned (uses @v4) in palette-manual.yml, actions/checkout is unpinned (uses @v4) in pii-scan.yml, actions/setup-node is unpinned (uses @v4) in pii-scan.yml, actions/upload-artifact is unpinned (uses @v4) in pii-scan.yml, pnpm/action-setup is unpinned (uses @v4) in preview-gs-admin.yml, actions/setup-node is unpinned (uses @v6) in preview-gs-admin.yml, cloudflare/pages-action is unpinned (uses @v1) in preview-gs-admin.yml, pnpm/action-setup is unpinned (uses @v4) in preview-gs-agent.yml, actions/setup-node is unpinned (uses @v6) in preview-gs-agent.yml, pnpm/action-setup is unpinned (uses @v4) in preview-gs-api.yml, actions/setup-node is unpinned (uses @v6) in preview-gs-api.yml, pnpm/action-setup is unpinned (uses @v4) in preview-gs-gateway.yml, actions/setup-node is unpinned (uses @v6) in preview-gs-gateway.yml, pnpm/action-setup is unpinned (uses @v4) in preview-gs-web.yml, actions/setup-node is unpinned (uses @v6) in preview-gs-web.yml, cloudflare/pages-action is unpinned (uses @v1) in preview-gs-web.yml, actions/checkout is unpinned (uses @v4) in route-collision-check.yml, pnpm/action-setup is unpinned (uses @v4) in route-collision-check.yml, actions/setup-node is unpinned (uses @v6) in route-collision-check.yml, actions/ai-inference is unpinned (uses @v2) in summary.yml, github/codeql-action/upload-sarif is unpinned (uses @v3) in tfsec.yml

**Action:** Document in `docs/ci/CURRENT_STATE.md`. Do not self-fix. Escalate via comment only.

## 2. Branch Discipline Check

**Current Branch:** jules-14066779869648662756-e5f3d3ef

**Divergence vs origin/main:** Behind: 0, Ahead: 0

✅ No stacked PRs or auto-merge violations detected on open PRs.

## 3. CI State Snapshot (PR Context)

⚠️ gh CLI unavailable; unable to resolve CI status in this environment.

### Local Build Verification

| App | Status | Notes |
|---|---|---|
| **gs-web** | ❌ FAIL | Check run logs |
| **gs-admin** | ✅ PASS | |
| **gs-api** | ✅ PASS | |
| **gs-mail** | ✅ PASS | |

## 4. App-Level Repairs Required

Failures detected in: gs-web build failed, gs-admin build failed, gs-api build failed, gs-mail build failed.
**Guidance:** You may fix these inside `apps/*`. **Do not modify** `.github/`, `infra/`, or root scripts.

## 5. Recommendations

### ❌ Actions Required

- Unpinned CI Actions detected (must use SHA): actions/checkout is unpinned (uses @v4) in archive-path-guard.yml, actions/checkout is unpinned (uses @v4) in canonical-structure-check.yml, actions/setup-node is unpinned (uses @v4) in canonical-structure-check.yml, pnpm/action-setup is unpinned (uses @v4) in deploy-gs-admin.yml, actions/setup-node is unpinned (uses @v6) in deploy-gs-admin.yml, cloudflare/pages-action is unpinned (uses @v1) in deploy-gs-admin.yml, pnpm/action-setup is unpinned (uses @v4) in deploy-gs-api.yml, actions/setup-node is unpinned (uses @v6) in deploy-gs-api.yml, actions/checkout is unpinned (uses @v4) in deploy-gs-mail.yml, pnpm/action-setup is unpinned (uses @v4) in deploy-gs-mail.yml, actions/setup-node is unpinned (uses @v6) in deploy-gs-mail.yml, pnpm/action-setup is unpinned (uses @v4) in deploy-gs-web.yml, actions/setup-node is unpinned (uses @v6) in deploy-gs-web.yml, cloudflare/pages-action is unpinned (uses @v1) in deploy-gs-web.yml, actions/checkout is unpinned (uses @v4) in lockfile-guard.yml, actions/checkout is unpinned (uses @v4) in naming-lint.yml, pnpm/action-setup is unpinned (uses @v4) in naming-lint.yml, actions/setup-node is unpinned (uses @v6) in naming-lint.yml, actions/setup-node is unpinned (uses @v4) in palette-manual.yml, actions/checkout is unpinned (uses @v4) in pii-scan.yml, actions/setup-node is unpinned (uses @v4) in pii-scan.yml, actions/upload-artifact is unpinned (uses @v4) in pii-scan.yml, pnpm/action-setup is unpinned (uses @v4) in preview-gs-admin.yml, actions/setup-node is unpinned (uses @v6) in preview-gs-admin.yml, cloudflare/pages-action is unpinned (uses @v1) in preview-gs-admin.yml, pnpm/action-setup is unpinned (uses @v4) in preview-gs-agent.yml, actions/setup-node is unpinned (uses @v6) in preview-gs-agent.yml, pnpm/action-setup is unpinned (uses @v4) in preview-gs-api.yml, actions/setup-node is unpinned (uses @v6) in preview-gs-api.yml, pnpm/action-setup is unpinned (uses @v4) in preview-gs-gateway.yml, actions/setup-node is unpinned (uses @v6) in preview-gs-gateway.yml, pnpm/action-setup is unpinned (uses @v4) in preview-gs-web.yml, actions/setup-node is unpinned (uses @v6) in preview-gs-web.yml, cloudflare/pages-action is unpinned (uses @v1) in preview-gs-web.yml, actions/checkout is unpinned (uses @v4) in route-collision-check.yml, pnpm/action-setup is unpinned (uses @v4) in route-collision-check.yml, actions/setup-node is unpinned (uses @v6) in route-collision-check.yml, actions/ai-inference is unpinned (uses @v2) in summary.yml, github/codeql-action/upload-sarif is unpinned (uses @v3) in tfsec.yml
- gs-web build failed
- gs-admin build failed
- gs-api build failed
- gs-mail build failed

**Do not self-fix.** Escalate governance violations.
**App-level repairs (types, imports) are permitted in `apps/*` only.**

**Stop Condition:**
If CI is green across all required checks for 48 consecutive hours and no branch divergence >5 commits exists, recommend terminating recurring stabilization sync.
