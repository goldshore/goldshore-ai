# PR Cleanup Runbook

This document outlines the disposition of 28 open Pull Requests based on the triage matrix.

## Phase 1: Fast Duplicate Closure

The following PRs are identified as duplicates or superseded and should be closed immediately.

| PR # | Branch | Recommended Action | Reason |
| :--- | :--- | :--- | :--- |
| 3344 | pr-3344 | Close | Duplicate of favicon family (superseded by 3869) |
| 3795 | pr-3795 | Close | Duplicate of favicon family (superseded by 3869) |
| 3847 | pr-3847 | Close | Duplicate of favicon family (superseded by 3869) |
| 3883 | pr-3883 | Close | Duplicate of favicon family (superseded by 3869) |
| 3884 | pr-3884 | Close | Duplicate of favicon family (superseded by 3869) |
| 3885 | pr-3885 | Close | Duplicate of favicon family (superseded by 3869) |
| 3347 | pr-3347 | Close | Stale conflict resolution artifact |
| 3385 | pr-3385 | Close | Stale conflict resolution artifact |
| 3583 | pr-3583 | Close | Stale conflict resolution artifact |
| 3841 | pr-3841 | Close | Duplicate of legacy-infra family (superseded by 3882) |
| 3870 | pr-3870 | Close | Duplicate of legacy-infra family (superseded by 3882) |
| 3881 | pr-3881 | Close | Duplicate of legacy-infra family (superseded by 3882) |
| 3333 | pr-3333 | Close | Superseded by 3849 |

## Phase 2: Pick One Representative per Family

Review these representatives to decide on final merging or cherry-picking.

| PR # | Branch | Recommended Action | Reason |
| :--- | :--- | :--- | :--- |
| 3869 | pr-3869 | Cherry-pick only | Representative for favicon/assets |
| 3882 | pr-3882 | Representative | Representative for legacy infra |
| 3849 | pr-3849 | Likely close | Stale web/layout changes; check if still wanted |

## Phase 3: Salvage Small/Scoped Work

These PRs contain potentially useful changes but are too stale to merge directly.

| PR # | Branch | Recommended Action | What to Salvage |
| :--- | :--- | :--- | :--- |
| 3322 | pr-3322 | Cherry-pick only | Risk Radar UI restyle |
| 3328 | pr-3328 | Cherry-pick only | Canonical logo rollout |
| 3375 | pr-3375 | Cherry-pick only | Worker naming / CI / docs contract |
| 3476 | pr-3476 | Cherry-pick only | Workflow / validate-rebuild cleanup |
| 3804 | pr-3804 | Cherry-pick only | Canonical CSS export fix |
| 3806 | pr-3806 | Cherry-pick only | Legacy Cloudflare naming normalization |

## Phase 4: Explicitly Close Large Stale Branches

| PR # | Branch | Recommended Action | Reason |
| :--- | :--- | :--- | :--- |
| 3332 | pr-3332 | Close | Stale infra rename/deploy (54 files, 5k+ behind) |
| 3335 | pr-3335 | Close | Stale DNS validation (3.5k+ behind, old paths) |
| 3535 | pr-3535 | Close | Broad stale branch (72 files, 3k+ behind) |
| 3582 | pr-3582 | Close | Broad stale branch (3k+ behind) |
| 3860 | pr-3860 | Close | High-risk/Broad (300 files, 2k+ behind) |
| 3338 | pr-3338 | Close | High-risk/Broad (42 ahead, 3k+ behind) |

---
**Note:** All cherry-picks must be validated against the `gs-control` build token requirement.
