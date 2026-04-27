# Branch Conflict Audit — 2026-03-22

## Scope

- Current local branch audited: `work` (`9e25c986`).
- Remote audited: `origin` -> `https://github.com/goldshore/goldshore-ai`.
- Comparison set: the 20 active branches from the user-provided branch list.
- Merge simulation method: temporary detached worktree on `work`, then `git merge --no-commit --no-ff <branch>` for each target branch.

## Headline Findings

- 20 of 20 audited branches produced a non-clean merge result into `work`.
- `work` is fully aligned with `origin/main` (`0` commits only on `work`, `0` commits only on `origin/main`, merge base `9e25c986`).
- Some branches failed before Git populated standard unmerged entries; these look like history/metadata problems rather than ordinary file-level conflicts.

## Results

| Branch | Status | Merge base | work-only | branch-only | Unmerged files | Notes |
|---|---:|---:|---:|---:|---:|---|
| `codespace-bug-free-space-chainsaw-544gxjjvvw72766q` | conflict | `107b7405` | 276 | 3057 | 78 | CONFLICT (modify/delete): .Jules/palette.md deleted in origin/codespace-bug-free-space-chainsaw-544gxjjvvw72766q and modified in HEAD.  Version HEAD of .Jules/palette.md left in tree. |
| `codex/github-mention-chore/working-copy-2026-03-19-mh995h` | conflict | `107b7405` | 276 | 244 | 56 | Auto-merging .github/workflows-disabled/preview-control-worker.yml |
| `codex/fix-critical-and-high-priority-bugs-2026-03-21` | conflict | `107b7405` | 276 | 3033 | 71 | Auto-merging .github/workflows/ci.yml |
| `codex/update-organization-access-for-jules-and-codex-2026-03-11` | conflict | `107b7405` | 276 | 3060 | 71 | Auto-merging .github/workflows/ci.yml |
| `codex/locate-and-update-legacy-tokens-in-infra-2026-03-14` | conflict | `107b7405` | 276 | 4010 | 84 | Auto-merging .github/workflows/ci.yml |
| `codex/locate-and-update-legacy-tokens-in-infra-2026-03-17-sde09k` | conflict | `107b7405` | 276 | 4044 | 84 | Auto-merging .github/workflows/ci.yml |
| `revert-4146-codex/refactor-initparallax-function-2026-03-21` | conflict | `2dfa2f4b` | 675 | 48 | 86 | origin/revert-4146-codex/refactor-initparallax-function-2026-03-21 is not a valid attribute name: .gitattributes:9 |
| `codex/add-parallax-hero-and-reusable-modal-2026-03-19-yx6l2h` | conflict | `71a917bf` | 650 | 2537 | 88 | Auto-merging .github/workflows/canonical-structure-check.yml |
| `codex/locate-and-update-legacy-tokens-in-infra-2026-03-15` | conflict | `107b7405` | 276 | 4008 | 63 | Auto-merging .github/workflows/ci.yml |
| `codex/replace-and-update-favicons-and-assets-2026-03-12-v88k1q` | conflict | `none` | 711 | 1607 | 0 | fatal: refusing to merge unrelated histories |
| `codex/refactor-global.css-for-clean-sections-2026-03-21` | conflict | `107b7405` | 276 | 4032 | 80 | Auto-merging .github/workflows/ci.yml |
| `codex/github-mention-chore/working-copy-2026-03-19` | conflict | `107b7405` | 276 | 245 | 60 | Auto-merging .github/workflows-disabled/preview-control-worker.yml |
| `codex/fix-high-priority-deployment-bugs-2026-03-21` | conflict | `107b7405` | 276 | 244 | 57 | Auto-merging .github/workflows-disabled/preview-control-worker.yml |
| `codex/github-mention-chore/working-copy-2026-03-19-4fdatf` | conflict | `107b7405` | 276 | 241 | 56 | Auto-merging .github/workflows-disabled/preview-control-worker.yml |
| `codex/fix-infra-deployment-for-renamed-gs-api-directory-2026-03-12` | conflict | `5ff91bd6` | 710 | 4 | 39 | Auto-merging .github/labeler.yml |
| `codex/fix-high-priority-bugs-from-codex-review-2026-03-01-enshox` | conflict | `none` | 711 | 109 | 0 | fatal: refusing to merge unrelated histories |
| `codex/standardize-cloudflare-worker-configuration-2026-03-18` | conflict | `none` | 711 | 1851 | 0 | fatal: refusing to merge unrelated histories |
| `codex/add-merge-or-squash-info-to-commit-descriptions-2026-03-14` | conflict | `none` | 711 | 12 | 0 | fatal: refusing to merge unrelated histories |
| `codex/replace-and-update-favicons-and-assets-2026-03-15-hverby` | conflict | `none` | 711 | 860 | 0 | fatal: refusing to merge unrelated histories |
| `codex/review-main-repo-for-errors-2026-03-12` | conflict | `none` | 711 | 1243 | 0 | fatal: refusing to merge unrelated histories |

## Representative Conflict Hotspots

- `codex/add-parallax-hero-and-reusable-modal-2026-03-19-yx6l2h`: 88 unmerged files. First files surfaced: `.github/workflows/canonical-structure-check.yml`, `.github/workflows/lockfile-guard.yml`, `.github/workflows/naming-guard.yml`, `.github/workflows/palette-manual.yml`, `.github/workflows/pii-scan.yml`, `.github/workflows/preview-gs-agent.yml`, `.github/workflows/sonarcloud.yml`, `.github/workflows/stabilization-task.yml`, `.github/workflows/tfsec.yml`, `README.md`, `apps/gs-admin/package.json`, `apps/gs-admin/public/assets/logo.svg`.
- `revert-4146-codex/refactor-initparallax-function-2026-03-21`: 86 unmerged files. First files surfaced: `.gitattributes`, `.github/workflows-disabled/preview-control-worker.yml`, `.github/workflows/lockfile-guard.yml`, `.github/workflows/neuralegion.yml`, `.github/workflows/pii-scan.yml`, `.github/workflows/preview-gs-admin.yml`, `.github/workflows/preview-gs-agent.yml`, `.github/workflows/preview-gs-api.yml`, `.github/workflows/preview-gs-gateway.yml`, `.github/workflows/preview-gs-web.yml`, `.github/workflows/sonarcloud.yml`, `.github/workflows/summary.yml`.
- `codex/locate-and-update-legacy-tokens-in-infra-2026-03-14`: 84 unmerged files. First files surfaced: `.github/workflows/deploy-gs-control.yml.disabled`, `.github/workflows/preview-gs-agent.yml`, `AGENTS.md`, `README.md`, `apps/gs-admin/public/favicon.svg`, `apps/gs-admin/src/layouts/AdminLayout.astro`, `apps/gs-admin/src/lib/cloudflare.ts`, `apps/gs-admin/src/pages/index.astro`, `apps/gs-agent/README.md`, `apps/gs-agent/package.json`, `apps/gs-agent/wrangler.toml`, `apps/gs-api/README.md`.
- `codex/locate-and-update-legacy-tokens-in-infra-2026-03-17-sde09k`: 84 unmerged files. First files surfaced: `.github/workflows/deploy-gs-control.yml.disabled`, `.github/workflows/preview-gs-agent.yml`, `AGENTS.md`, `README.md`, `apps/gs-admin/public/favicon.svg`, `apps/gs-admin/src/layouts/AdminLayout.astro`, `apps/gs-admin/src/lib/cloudflare.ts`, `apps/gs-admin/src/pages/index.astro`, `apps/gs-agent/README.md`, `apps/gs-agent/package.json`, `apps/gs-agent/wrangler.toml`, `apps/gs-api/README.md`.
- `codex/refactor-global.css-for-clean-sections-2026-03-21`: 80 unmerged files. First files surfaced: `.github/workflows/deploy-gs-control.yml.disabled`, `.github/workflows/preview-gs-agent.yml`, `README.md`, `apps/gs-admin/public/favicon.svg`, `apps/gs-admin/src/layouts/AdminLayout.astro`, `apps/gs-admin/src/lib/cloudflare.ts`, `apps/gs-admin/src/pages/index.astro`, `apps/gs-agent/README.md`, `apps/gs-agent/package.json`, `apps/gs-agent/wrangler.toml`, `apps/gs-api/README.md`, `apps/gs-api/package.json`.
- `codespace-bug-free-space-chainsaw-544gxjjvvw72766q`: 78 unmerged files. First files surfaced: `.Jules/palette.md`, `AGENTS.md`, `apps/gs-admin/package.json`, `apps/gs-admin/src/components/Sidebar.astro`, `apps/gs-admin/src/layouts/AdminLayout.astro`, `apps/gs-admin/src/lib/gs-api.ts`, `apps/gs-agent/package.json`, `apps/gs-agent/wrangler.toml`, `apps/gs-api/README.md`, `apps/gs-api/package.json`, `apps/gs-api/src/routes/health.ts`, `apps/gs-api/src/routes/media.ts`.
- `codex/fix-critical-and-high-priority-bugs-2026-03-21`: 71 unmerged files. First files surfaced: `AGENTS.md`, `apps/gs-admin/package.json`, `apps/gs-admin/src/components/Sidebar.astro`, `apps/gs-admin/src/layouts/AdminLayout.astro`, `apps/gs-admin/src/lib/gs-api.ts`, `apps/gs-agent/package.json`, `apps/gs-agent/wrangler.toml`, `apps/gs-api/README.md`, `apps/gs-api/package.json`, `apps/gs-api/src/routes/health.ts`, `apps/gs-api/src/routes/media.ts`, `apps/gs-api/src/routes/system.ts`.
- `codex/update-organization-access-for-jules-and-codex-2026-03-11`: 71 unmerged files. First files surfaced: `AGENTS.md`, `apps/gs-admin/package.json`, `apps/gs-admin/src/components/Sidebar.astro`, `apps/gs-admin/src/layouts/AdminLayout.astro`, `apps/gs-admin/src/lib/gs-api.ts`, `apps/gs-agent/package.json`, `apps/gs-agent/wrangler.toml`, `apps/gs-api/README.md`, `apps/gs-api/package.json`, `apps/gs-api/src/routes/health.ts`, `apps/gs-api/src/routes/media.ts`, `apps/gs-api/src/routes/system.ts`.

## Branches With Non-Standard Merge Failures

- `codex/replace-and-update-favicons-and-assets-2026-03-12-v88k1q`: merge failed with note `fatal: refusing to merge unrelated histories` and Git reported `0` unmerged files.
- `codex/fix-high-priority-bugs-from-codex-review-2026-03-01-enshox`: merge failed with note `fatal: refusing to merge unrelated histories` and Git reported `0` unmerged files.
- `codex/standardize-cloudflare-worker-configuration-2026-03-18`: merge failed with note `fatal: refusing to merge unrelated histories` and Git reported `0` unmerged files.
- `codex/add-merge-or-squash-info-to-commit-descriptions-2026-03-14`: merge failed with note `fatal: refusing to merge unrelated histories` and Git reported `0` unmerged files.
- `codex/replace-and-update-favicons-and-assets-2026-03-15-hverby`: merge failed with note `fatal: refusing to merge unrelated histories` and Git reported `0` unmerged files.
- `codex/review-main-repo-for-errors-2026-03-12`: merge failed with note `fatal: refusing to merge unrelated histories` and Git reported `0` unmerged files.

## Commands Used

```bash
git remote add origin https://github.com/goldshore/goldshore-ai
git fetch --prune origin main <20 branch names>
git worktree add --detach /tmp/<audit-worktree> work
git -C /tmp/<audit-worktree> merge --no-commit --no-ff origin/<branch>
git rev-list --left-right --count work...origin/<branch>
```

