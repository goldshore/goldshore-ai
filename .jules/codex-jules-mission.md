# Jules Mission: GoldShore Consolidation Guard

Last updated: 2026-07-21

## Publishing Rule

By default, completed repair work should be committed to a branch, pushed, and opened as a pull request unless the operator explicitly asks for local-only work.

## Current Repository Contract

GoldShore is a two-app monorepo:

- `apps/gs-web` is the only frontend application.
- `apps/gs-api` is the only Cloudflare Worker/API application.

Do not create or revive satellite app directories such as `apps/gs-admin`, `apps/gs-agent`, `apps/gs-gateway`, `apps/gs-control`, `apps/gs-mail`, or `apps/risk-radar`. Admin, docs, settings, and internal UI surfaces belong under routes in `apps/gs-web`. Backend routing, cron, email handlers, queue consumers, auth, proxy logic, AI orchestration, and control endpoints belong in `apps/gs-api`.

## Jules Responsibilities

1. Preserve the two-app structure.
2. Keep active deploy workflows limited to:
   - `.github/workflows/deploy-gs-web.yml`
   - `.github/workflows/deploy-gs-api.yml`
3. Keep preview/staging workflows aligned with the two app names:
   - `.github/workflows/preview-gs-web.yml`
   - `.github/workflows/preview-gs-api.yml`
4. Validate that `pnpm-workspace.yaml` only includes the active app roots and shared package roots.
5. Treat Cloudflare Worker Builds for API services as requiring the `gs-control` build token.
6. Never commit local Claude settings or secrets. `.claude/settings.local.json` must stay ignored.
7. Use commit and PR descriptions that start with a merge strategy line:
   - `Merge Strategy: Squash`
   - `Merge Strategy: Merge Commit`

## Recent Claude Fixes To Preserve

- Reverted preview DNS workflow sprawl. Do not reintroduce setup-preview-dns workflows or ad hoc Cloudflare deploy workflows.
- Added `.claude/settings.local.json` ignore hygiene. Do not expose Claude local settings.
- Hardened theme and hero work around the Penrose mark, parallax hero, and production theme. Do not overwrite those assets with older archive copies.
- Renamed web preview workflow to staging semantics while keeping the file name canonical.
- Documented the GoldShore domain portfolio, existing Cloudflare project reuse, and HostGator VPS integration model in `docs/cloudflare-routing-plan.md`.
- Confirmed routing cleanup needs:
  - Cloudflare Pages should own the public web surface.
  - Worker custom domains should own API surfaces when the Worker is the origin.
  - GitHub Pages custom domains should not conflict with Cloudflare Pages ownership.
  - `api.goldshore.ai/health` must be fixed before any API extraction cutover.

## Required Sweep

Run these checks before proposing changes:

```bash
pnpm validate
pnpm lint
pnpm test
pnpm build
```

If a check fails, report the failing command, the relevant log excerpt, and the exact files involved. Apply only safe, scoped fixes.

## Safe Fix Scope

Jules may automatically fix:

- Broken `.Jules` runner scripts.
- Stale references that revive pre-consolidation app names.
- Workspace and validation guard drift.
- Missing ignore rules for local settings, caches, and generated artifacts.
- Mechanical formatting or lint issues when configured.

Jules must not automatically:

- Delete real user-authored application code without a clear consolidation plan.
- Rotate secrets or edit production credentials.
- Deploy to Cloudflare production.
- Add new app directories or new `deploy-*.yml` workflows.
- Replace current `gs-web` or `gs-api` source with archived code.

## Cloudflare Routing Rule

Use the current routing plan in `docs/cloudflare-routing-plan.md` when changing DNS, Pages domains, Worker routes, or custom domains. If Cloudflare MCP is unavailable, document the limitation and use Wrangler, repo config, and dashboard/API evidence instead of guessing.

Do not delete existing Cloudflare Pages or Workers projects just because they are legacy. Assign them explicit roles, keep one owner per hostname, and use the HostGator VPS only as a private/protected origin for database, email, or non-Worker features.
