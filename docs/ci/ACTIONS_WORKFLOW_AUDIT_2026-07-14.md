# GitHub Actions and Workflow Audit - 2026-07-14

Merge Strategy: Squash

This audit uses the replacement `AGENTS.md` rule as the source of truth:
GoldShore is a two-app monorepo with only `apps/gs-web` and `apps/gs-api`.
No secret values were inspected or recorded.

## Executive Summary

The repository is currently inconsistent with the two-app rule in three
different places:

1. Local workflow files still include production deploy workflows beyond
   `deploy-gs-web.yml` and `deploy-gs-api.yml`.
2. Live GitHub workflow registration still has many legacy active workflows
   from older branches or files no longer present locally.
3. Workspace and merge-check scripts still reference legacy apps such as
   `gs-admin`, `gs-control`, `gs-gateway`, `gs-agent`, `gs-mail`, and
   `gs-mcp`.

This is why open branches feel hard to merge or close: the visible GitHub
state, local workflow tree, branch-protection config, and AGENTS policy do not
agree.

## Live Branch Protection

Live `main` branch protection currently requires exactly these checks:

- `Required Merge Checks / workspace-install`
- `Required Merge Checks / gs-api-build-test`
- `Required Merge Checks / gs-web-build`
- `Required Merge Checks / deployment-dry-run`

It also has admin enforcement enabled and stale review dismissal enabled.

The live required check set does **not** currently require
`Required Merge Checks / gs-admin-build`.

## Local Workflow Findings

Allowed production deploy workflows under the replacement AGENTS rule:

- `.github/workflows/deploy-gs-api.yml`
- `.github/workflows/deploy-gs-web.yml`

Local production deploy files that violate the rule and should be deleted or
renamed out of `.github/workflows`:

- `.github/workflows/deploy-admin.yml`
- `.github/workflows/deploy-dispatch.yml`
- `.github/workflows/deploy-gs-mail.yml`
- `.github/workflows/deploy-gs-www-redirect.yml`
- `.github/workflows/deploy-platform.yml`

Local preview/manual workflows that reference retired app surfaces and should
be rewritten or disabled:

- `.github/workflows/cf-discover.yml`
- `.github/workflows/cf-pages-setup.yml`
- `.github/workflows/cf-worker-ops.yml`
- `.github/workflows/infrastructure-guard.yml`
- `.github/workflows/required-merge-checks.yml`

## Live GitHub Workflow Registry Findings

`gh workflow list --repo marzton/goldshore-ai --all` reports active workflows
that are not present in the current local `.github/workflows` tree. Important
legacy active workflows include:

- `.github/workflows/deploy-agent.yml`
- `.github/workflows/deploy-control-worker.yml`
- `.github/workflows/deploy-gateway.yml`
- `.github/workflows/deploy-web.yml`
- `.github/workflows/preview-admin.yml`
- `.github/workflows/preview-agent.yml`
- `.github/workflows/preview-control-worker.yml`
- `.github/workflows/preview-gateway.yml`
- `.github/workflows/preview-gs-admin.yml`
- `.github/workflows/preview-gs-agent.yml`
- `.github/workflows/preview-gs-control.yml`
- `.github/workflows/preview-gs-control-worker.yml`
- `.github/workflows/preview-gs-gateway.yml`
- `.github/workflows/preview-gs-web.yml`
- `.github/workflows/preview-web.yml`
- `.github/workflows/gateway-validation.yml`
- `.github/workflows/gateway-config-validation.yml`
- `.github/workflows/sync-infra.yml`

These should be disabled in GitHub Actions, and removed from the default branch
if they still exist there through branch drift.

## Workspace Guard Findings

`pnpm-workspace.yaml` violates the replacement AGENTS rule. It currently lists:

- `apps/gs-admin`
- `apps/gs-control`
- `apps/gs-gateway`
- `apps/gs-mcp`
- `apps/gs-platform`
- `apps/gs-agent`
- `apps/gs-mail`
- `apps/gs-www-redirect`
- `apps/gs-core-worker`
- `apps/armsway-com`
- `apps/banproof-me`
- `apps/gs-trading`
- `packages/*`
- `infra/*`

Under the current AGENTS rule, the workspace package list should identify only:

- `apps/gs-web`
- `apps/gs-api`

If shared packages are still needed, the AGENTS rule should be explicitly
amended before keeping `packages/*`. As written, the guard says only the two app
directories are valid.

## Required Merge Checks Workflow Findings

`.github/workflows/required-merge-checks.yml` still defines:

- `gs-admin-build`
- admin build dependency in `deployment-dry-run`
- admin dry-run build step

That conflicts with the replacement rule that admin UI must live under
`apps/gs-web` routes.

Recommended rewrite:

- Keep `workspace-install`
- Keep `gs-api-build-test`
- Keep `gs-web-build`
- Keep `deployment-dry-run`
- Remove `gs-admin-build`
- Remove admin build/dry-run steps

## Branch Protection Config Drift

Live branch protection requires four checks and does not require
`gs-admin-build`.

`scripts/configure-branch-protection.mjs` still includes:

- `Required Merge Checks / gs-admin-build`

If `.github/workflows/enforce-branch-protection.yml` runs with that script, it
can reintroduce a stale required status check.

Recommended rewrite:

- Remove `Required Merge Checks / gs-admin-build`
- Keep the four live required checks listed above
- Consider setting required approving review count to match live policy if
  CODEOWNER reviews are not intended

## Validator Findings

`node scripts/sync-secrets.mjs check` passed.

`tsx scripts/validate-worker-names.ts` passed.

`tsx scripts/validate-workspace-contract.ts` failed:

- `gs-mcp`: missing required file(s): `tsconfig.json`
- `.github/workflows/deploy-platform.yml`: missing canonical API worker path
  `apps/gs-api`
- `gs-web`: wrangler name `gs-web-app` requires folder to be `gs-web-app`

The validator itself is stale because it still requires:

- `gs-admin`
- `gs-control`
- `gs-gateway`
- `gs-agent`

That validator should be rewritten to validate only `gs-web` and `gs-api`, or
removed from merge enforcement until it matches the new rule.

## Secret Name Findings

`node scripts/sync-secrets.mjs check` currently passes.

The manifest disallows these workflow secret names:

- `CLOUDFLARE_API_TOKEN_GS_CONTROL`
- `CLOUDFLARE_BUILD_API_TOKEN`
- `CF_WORKERS_BUILDS`

No disallowed workflow references were reported by the guard.

Non-canonical secret refs still appear in workflows and should be removed with
their retired workflows or added to the manifest intentionally:

- `CF_USER_TOKEN`
- `CF_AUTH_EMAIL`
- `CF_AUTH_KEY`
- `GH_PAT`
- `GS_DISPATCH_TOKEN`

`GITHUB_TOKEN` is GitHub-provided and does not need manifest sync.

## Highest-Risk Workflow

`.github/workflows/cf-worker-ops.yml` is risky under the new rule. It still
contains stale worker matrices and a manual cleanup job that can delete
Cloudflare Workers not present in its stale canonical list.

Do not run `audit-and-cleanup` with `dry_run=false` until this workflow is
rewritten for the two-app model.

## Recommended Cleanup Order

1. Create a fresh branch from latest `origin/main`.
2. Delete all local `deploy-*.yml` files except:
   - `.github/workflows/deploy-gs-api.yml`
   - `.github/workflows/deploy-gs-web.yml`
3. Rewrite `required-merge-checks.yml` to remove `gs-admin-build` and admin
   dry-run steps.
4. Rewrite `pnpm-workspace.yaml` to include only `apps/gs-web` and
   `apps/gs-api`.
5. Rewrite `scripts/configure-branch-protection.mjs` to require only the four
   live required checks.
6. Disable or delete legacy active GitHub workflows listed above.
7. Disable Cloudflare GitHub build integrations for retired services such as
   `gs-admin`, `gs-agent`, `gs-control`, `gs-gateway`, `gs-mail`,
   `gs-signals-prod`, and `gs-web-preview`.
8. Update stale docs/scripts that still describe satellite workers.
9. Re-run:

```powershell
node scripts\sync-secrets.mjs check
.\node_modules\.bin\tsx.cmd scripts\validate-worker-names.ts
gh api repos/marzton/goldshore-ai/branches/main/protection --jq '{required_status_checks:.required_status_checks.contexts,checks:.required_status_checks.checks}'
gh workflow list --repo marzton/goldshore-ai --all
```

## Apply Checklist

For the cleanup PR description, use:

```text
Merge Strategy: Squash

Consolidates GitHub Actions and workflow policy around the two-app monorepo:
apps/gs-web and apps/gs-api. Removes stale deploy surfaces for retired
satellite workers and aligns branch-protection source with live required merge
checks.
```
