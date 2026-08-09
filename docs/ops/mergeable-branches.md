# Finding Merge-able Branches (Goldshore)

> [!NOTE]
> **Document metadata**
>
> - **Single source of truth for:** branch mergeability and branch operations workflow
> - **Last updated:** 2026-08-09
> - **Updated by:** PR triage ruleset
> - **Workflow update path:** `.github/workflows/pr-triage.yml`

This is the project-standard workflow for identifying branches that can merge cleanly.

## Fast local check

1. Update refs:

```bash
git fetch --all --prune
```

2. List remote branches already fully merged into `origin/main`:

```bash
git branch --remotes --merged origin/main
```

> These are safe-delete candidates, not merge candidates.

## Conflict-free mergeability scan (recommended)

Use the repo script:

```bash
scripts/merge-audit.sh --target origin/main
```

Output columns:

- `STATUS=clean` → dry-run merge succeeded
- `STATUS=conflict` → conflicts expected
- `MERGED=yes` → branch already contained in target

Useful flags:

```bash
scripts/merge-audit.sh --target origin/develop --max 25
scripts/merge-audit.sh --target origin/main --include-merged
scripts/merge-audit.sh --target origin/main --no-fetch
```

## Additional branch drift checks

List branches not merged into `origin/main`:

```bash
git branch -r --no-merged origin/main
```

Compare divergence for a branch:

```bash
git log --oneline --left-right --cherry origin/main...origin/<branch-name>
```

- `<` commits are missing from the branch
- `>` commits are introduced by the branch

## Workflow policy

- Keep `main` deployable.
- Rebase feature branches onto `origin/main` before merge.
- Require passing CI before final merge.
- Require passing external Cloudflare Workers Builds when they are reported.
- Never recommend a `dirty`, `blocked`, `unstable`, draft, behind, red, or
  pending PR for merge.
- Treat a merged-then-reverted lineage as provenance, not as a reusable merge
  branch. Reapply reviewed changes on a fresh branch from current `main`.

Example:

```bash
git checkout feature-x
git rebase origin/main
```

## Stale PR supersedence policy

`PR Hygiene` automation closes PRs as superseded when all conditions are true:

- PR age is greater than 3 days.
- PR has unresolved merge conflicts (`mergeable_state=dirty`) **or** has red CI checks.
- Closure comment includes a replacement PR reference when one exists (`Supersedes #<old-pr>`), otherwise indicates replacement is pending from a clean branch.

Workflow: `.github/workflows/pr-hygiene.yml`.

## Automated triage ruleset

`.github/pr-triage-ruleset.json` is evaluated by the `PR Triage` workflow.
It reports one of three decisions:

- `ready` — no structural blocker or observed hold; required branch-protection
  checks must still pass before merge.
- `hold` — draft, drift, unhealthy base, or red/pending checks require attention.
- `blocked` — the PR violates a repository rule and the workflow fails.

Blocking rules include:

- PRs must target `main`.
- Added or modified deployable apps are limited to `apps/gs-web` and
  `apps/gs-api`; deletion of retired satellite apps remains allowed.
- New or modified `deploy-*.yml` workflows are limited to
  `deploy-gs-web.yml` and `deploy-gs-api.yml`.
- More than 40 changed files requires human label `triage:large-approved`.
- `revert-*` branches require human label `triage:revert-approved`.
- A changed branch with no commits ahead of `main` is treated as a reverted
  lineage and requires human label `triage:reapply-approved`.
- Merge conflicts always block.

When `main` itself is red, a narrowly scoped repair PR may use
`triage:base-repair`. Agents must not self-apply any `triage:*approved` label;
the label records an explicit human risk decision, not a CI bypass.
