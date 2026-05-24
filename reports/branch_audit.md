# Repository Branch Audit - 2026-04-01

This report summarizes the state of branches in the `goldshore-ai` repository. The focus is on identifying merged branches for cleanup and stale branches that may no longer be relevant after the monorepo consolidation.

## 1. Recently Active Branches (Drafting/Consolidation)
These branches have been modified in the last 7 days and are likely part of active workstreams.

| Branch Name | Last Commit | Author | Notes |
| :--- | :--- | :--- | :--- |
| `main` | 2026-04-01 | Bobby Rosenberg | Current primary branch |
| `origin/copilot/repair-monorepo-...` | 2026-03-29 | Bobby Rosenberg | Related to monorepo repair |
| `origin/dependabot/npm_and_yarn/...` | 2026-03-29 | Bobby Rosenberg | Multiple dependabot updates |
| `origin/codex/update-phase-5-...` | 2026-03-28 | Bobby Rosenberg | Rebuild script updates |

## 2. Merged Branches (Cleaned Up ✅)
The following branches have been successfully deleted from `origin` as they were already fully merged into `main`.

### Remote Branches (Cleaned)
- [x] `remotes/origin/codex/document-service-binding-flows-...`
- [x] `remotes/origin/codex/implement-actual-agent-signal-...`
- [x] `remotes/origin/codex/inventory-routes-and-service-bindings-...`
- [x] `remotes/origin/codex/update-jules-nightly.yml-...`
- [x] `remotes/origin/codex/update-maintenance.yml-...`
- [x] `remotes/origin/codex/update-package.json-build-scripts-...`
- [x] `remotes/origin/codex/update-workspace-layout-in-documentation-...`
- [x] `remotes/origin/feat/theme-integration-web-admin`
- [x] `remotes/origin/perf/optimize-key-rotation-...`
- [x] `remotes/origin/revert-4301-revert-4290-testing-cloudflare-metrics-...`
- [x] `remotes/origin/revert-4403-claude/document-repo-config-BJD0q`
- [x] `remotes/origin/revert-4405-claude/setup-preview-dns-BJD0q`
- [x] **7x Dependabot branches pruned**


## 3. Stale Unmerged Branches (Ready for Cleanup?)
These branches are **NOT merged** into `main` and have not been updated since the monorepo consolidation work began in earnest (pre-March 25th).

| Date | Branch Name | Author | Subject |
| :--- | :--- | :--- | :--- |
| **Nov 2025** | `origin/infra-monorepo-foundation` | google-labs-jules[bot] | fix(ci): correct build process and deployment configuration |
| **Mar 15** | `origin/codex/replace-logo-asset-...` | Bobby Rosenberg | Follow-up: align GS-* Cloudflare worker |
| **Mar 13** | `origin/codex/update-book-strategy-...` | Bobby Rosenberg | Merge branch 'main-HEAD' into ... |
| **Mar 13** | `origin/codex/replace-hardcoded-colors-...` | Bobby Rosenberg | Merge branch 'main-HEAD' into ... |
| **Mar 12** | `origin/codex/resolve-conflicts-...` | Bobby Rosenberg | Potential fix for pull request finding |

## 4. Unmerged Revert & Fix Attempts (Abandoned?)
These are unmerged and likely indicate failed automation attempts or manual reverts that were never closed.

- `origin/revert-4267-codex/add-svg-upload-...` (Mar 22)
- `origin/revert-4271-codex/separate-gs-control-...` (Mar 22)
- `origin/revert-4275-codex/evaluate-gs-web-access-...` (Mar 22)
- `origin/revert-4285-dependabot/github_actions/...` (Mar 22)
- `origin/revert-4290-testing-cloudflare-metrics-...` (Mar 22)
- `origin/revert-4330-codex/implement-actual-agent-...` (Mar 22)
- `origin/revert-4338-revert-4285-dependabot/...` (Mar 22)
- `origin/revert-4341-revert-4330-codex/...` (Mar 22)
- `origin/revert-4342-revert-4285-dependabot/...` (Mar 22)
- `origin/revert-4406-revert-4405-claude/...` (Mar 27)

> [!CAUTION]
> If these were botched attempts to fix the repo, we should consider deleting them to prevent confusion during further consolidation steps.
