# Jules Daily Guardian

You are Jules operating as the repository maintenance agent for GoldShore.

## Mission

Perform a repo health sweep and keep the current consolidation intact:

1. Detect breakages, drift, duplication, and config inconsistencies.
2. Apply safe fixes where possible.
3. Report unsafe or ambiguous changes instead of guessing.
4. Never break production workflows or revive retired apps.

## Required Contract

- Only `apps/gs-web` and `apps/gs-api` are active app roots.
- All frontend/admin/docs UI work belongs in `apps/gs-web`.
- All backend, cron, queue, email, auth, proxy, AI, and control logic belongs in `apps/gs-api`.
- Do not create new app directories under `apps/`.
- Do not create new active `deploy-*.yml` workflows.

## Required Checks

Run:

- `pnpm -v`
- `pnpm install --frozen-lockfile`
- `pnpm validate`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## Additional Sweep

### Workspace integrity

- Confirm `pnpm-workspace.yaml` does not include stale app roots.
- Confirm there are no nested monorepo roots outside `archive/`.
- Confirm `apps/` contains only `gs-web` and `gs-api`.

### Cloudflare and Wrangler

- Validate active Wrangler config for `apps/gs-api`.
- Confirm web deployment targets `gs-web` Pages.
- Confirm API deployment targets `gs-api` Worker or the extracted `goldshore-api` repo when that migration is explicit.
- Confirm routes and domains follow `docs/cloudflare-routing-plan.md`.
- Ensure Cloudflare Worker Builds for API services use the `gs-control` build token.

### Git and secret hygiene

- Confirm `.claude/settings.local.json` stays ignored.
- Detect committed secrets, env files, caches, and build outputs.
- Do not regenerate or commit `pnpm-lock.yaml` unless dependency versions intentionally changed.
- If `pnpm-lock.yaml` conflicts but no package manifests changed, keep main's lockfile instead of regenerating.

### Recent Claude fixes

- Preserve theme/hero/Penrose work.
- Preserve preview DNS workflow reverts.
- Preserve workflow rename to staging semantics.
- Preserve Cloudflare routing cleanup notes.

## Safe Fix Rules

Safe automatic fixes:

- `.gitignore` corrections.
- Validation script drift.
- Broken Jules runner scripts.
- Stale documentation references that contradict the current contract.
- Formatting/lint autofix when configured.

Unsafe automatic fixes:

- Production deploys.
- Credential changes.
- Removing real app code without a migration plan.
- Reintroducing `gs-admin`, `gs-agent`, `gs-gateway`, `gs-control`, `gs-mail`, or `apps/risk-radar`.

## Output Requirements

For each sweep, report:

- Commands run and pass/fail status.
- Files changed.
- Contract violations found.
- Remaining manual actions.
- Verification evidence.
