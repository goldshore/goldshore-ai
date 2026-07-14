# GitHub Actions and Workflow Audit - 2026-07-13

This audit compares the current repository workflow surface against the
replacement `AGENTS.md` rule: GoldShore is now a two-app monorepo with only
`apps/gs-web` and `apps/gs-api`.

No secret values were inspected or recorded.

## Current Merge State

Open PRs are blocked primarily by branch-protection review/update rules and
stale external Cloudflare checks, not by the four currently required GitHub
Actions checks.

Live `main` branch protection currently requires:

- `Required Merge Checks / workspace-install`
- `Required Merge Checks / gs-api-build-test`
- `Required Merge Checks / gs-web-build`
- `Required Merge Checks / deployment-dry-run`

It also enforces:

- strict up-to-date status checks
- one approving review
- CODEOWNER review
- stale review dismissal
- conversation resolution
- linear history
- admin enforcement

Repository rulesets currently do not explain the close/merge blockage; the only
reported active ruleset is `Copilot review for default branch`.

## Blocking Findings

### 1. Deploy workflow sprawl violates the two-app rule

Only these production deploy workflows are allowed by the replacement
`AGENTS.md`:

- `.github/workflows/deploy-gs-web.yml`
- `.github/workflows/deploy-gs-api.yml`

The repository still contains deploy workflows that should be removed,
disabled, or folded into `gs-web`/`gs-api`:

- `.github/workflows/deploy-admin.yml`
- `.github/workflows/deploy-dispatch.yml`
- `.github/workflows/deploy-gs-mail.yml`
- `.github/workflows/deploy-gs-www-redirect.yml`
- `.github/workflows/deploy-platform.yml`

These are likely to keep recreating obsolete Cloudflare deployment checks and
confusing merge decisions.

### 2. Required Merge Checks still references `gs-admin`

`.github/workflows/required-merge-checks.yml` still defines a `gs-admin-build`
job and includes it in the deployment dry-run dependency chain. That conflicts
with the rule that admin routes must live under `apps/gs-web`.

Even though live branch protection does not currently require `gs-admin-build`,
the workflow itself still preserves the old app model.

### 3. Branch-protection sources disagree with live GitHub protection

Three branch-protection sources currently disagree:

- Live GitHub branch protection requires the four `Required Merge Checks / ...`
  contexts listed above.
- `scripts/configure-branch-protection.mjs` would require those four plus
  `Required Merge Checks / gs-admin-build`.
- `infra/branch-protection.json` still lists old infrastructure guard contexts:
  `Manifest integrity check` and `Cloudflare live state audit`.

If `.github/workflows/enforce-branch-protection.yml` runs after edits to the
branch-protection script, it can push the repo back into an inconsistent merge
gate.

### 4. Workspace guard is not consolidated

`pnpm-workspace.yaml` still includes many retired app folders:

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

This directly conflicts with the new workspace guard and allows CI/jobs to keep
discovering retired surfaces.

### 5. Cloudflare worker ops still encodes retired workers

`.github/workflows/cf-worker-ops.yml` still dry-runs or audits old worker names
such as `gs-gateway`, `gs-control`, `gs-mail`, `gs-agent`, `gs-trading`,
`gs-admin`, `goldshore-ai`, and `goldshore-org`.

The manual cleanup job can delete live Workers not present in its stale
canonical array. This should not be used until the canonical set is rewritten
for the two-app model.

### 6. External Cloudflare checks are stale/noisy on open PRs

Open PR rollups show repeated failures from external Cloudflare integrations,
especially:

- `Cloudflare Pages` / `Cloudflare Pages: gs-admin`
- `Workers Builds: gs-signals-prod`
- `Workers Builds: gs-web-preview`

These are not listed in live required status checks, but they create red PR
surfaces and likely drive confusion around what is mergeable. Disable or
retarget the Cloudflare GitHub build integrations for retired services.

## Secret-Name Findings

`node scripts/sync-secrets.mjs check` currently passes.

Important nuance: the check only enforces `policy.disallowedWorkflowSecrets`,
not a strict rule that every `secrets.X` reference must be declared in
`infra/secrets/secret-sync.manifest.yaml`.

Workflow secret refs not declared as canonical manifest names include:

- `CF_USER_TOKEN`
- `CF_AUTH_EMAIL`
- `CF_AUTH_KEY`
- `GH_PAT`
- `GS_DISPATCH_TOKEN`

`GITHUB_TOKEN` is GitHub-provided and does not need to be synced as a repo
secret. The others should either be added to the manifest intentionally,
renamed to canonical names, or removed with their retired workflows.

## Recommended Cleanup Order

1. Create one consolidation PR from latest `main`.
2. Remove or disable all non-allowed `deploy-*.yml` workflows except
   `deploy-gs-web.yml` and `deploy-gs-api.yml`.
3. Remove `gs-admin-build` from `required-merge-checks.yml` and remove admin
   dry-run build steps.
4. Update `scripts/configure-branch-protection.mjs` and
   `infra/branch-protection.json` to the same four live two-app contexts.
5. Consolidate `pnpm-workspace.yaml` to the allowed app set.
6. Rewrite or temporarily disable `cf-worker-ops.yml` until its canonical
   worker list only reflects the consolidated deployment model.
7. Disable Cloudflare GitHub build integrations for retired services
   (`gs-admin`, `gs-signals-prod`, `gs-web-preview`, and any other satellite
   services no longer deployed from this repo).
8. Rebase or update open PR branches after the workflow cleanup merges, then
   rerun checks.

## Verification Commands

```powershell
node scripts/sync-secrets.mjs check
gh api repos/marzton/goldshore-ai/branches/main/protection --jq '{required_status_checks: .required_status_checks, required_pull_request_reviews: .required_pull_request_reviews, required_conversation_resolution: .required_conversation_resolution, required_linear_history: .required_linear_history}'
gh pr list --state open --limit 50 --json number,title,headRefName,mergeStateStatus,isDraft,reviewDecision,statusCheckRollup
```

