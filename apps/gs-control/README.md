# apps/gs-control

## Overview
The `gs-control` worker handles infrastructure automation tasks (DNS updates, preview environment creation, secret rotation, and sync operations) and is served from `https://ops.goldshore.ai/*` on Cloudflare Workers. It is managed alongside the gateway worker as part of the Edge Workers deployment group.

Cloudflare metadata (from `wrangler.toml`):
- Worker name: `gs-control`
- Route: `ops.goldshore.ai/*`
- Compatibility date: `2025-01-10`
- Bindings: `CONTROL_LOGS` (KV), `STATE` (R2)
- Service bindings: `API` (`gs-api`), `GATEWAY` (`gs-gateway`)
- Environment variable: `ENV=production`

## Routes/Endpoints
These are worker API endpoints implemented in `src/index.ts` and `src/routes/cloudflare.ts` (not HTML pages). The router files are the source of truth.
- `GET /` (service health)
- `POST /dns/apply`
- `POST /workers/reconcile`
- `POST /pages/deploy`
- `POST /access/audit`
- `GET /cloudflare/dns/records`
- `PUT /cloudflare/dns/records/:recordId`
- `GET /cloudflare/workers/status`
- `GET /cloudflare/pages/projects`
- `GET /cloudflare/kv/namespaces`
- `GET /cloudflare/r2/buckets`
- `GET /cloudflare/d1/databases`
- `GET /cloudflare/access/policies`

Configuration highlights (from `wrangler.toml`):
- `ENV=production`
- KV binding: `CONTROL_LOGS`
- R2 binding: `STATE`
- Service bindings: `API` (`gs-api`), `GATEWAY` (`gs-gateway`)

## Local Dev
```bash
pnpm install
pnpm --filter ./apps/gs-control dev
pnpm --filter ./apps/gs-control run-task
```

## Deploy
- Production deploy workflow in repo: `.github/workflows/deploy-gs-control.yml.disabled` (currently disabled on disk)
- No dedicated preview control workflow exists in `.github/workflows`; treat `ops-preview.goldshore.ai` validation as a Cloudflare/dashboard verification step until one is added.
- Worker deploy jobs use `wrangler deploy` with `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`, and some jobs prefer `CLOUDFLARE_BUILD_API_TOKEN` when that override secret is present.
- Store runtime secrets with `wrangler secret put` rather than committing env values.

### Cloudflare token rotation notes

When rotating Worker Builds credentials for `gs-control`, keep these related services aligned at the same time:

- `gs-api`
- `gs-gateway`
- `gs-control`
- `gs-agent` preview jobs if they are being retried in the same maintenance window

Operational checklist:

1. Rotate the Worker Builds token in Cloudflare Dashboard for the affected service/project and save the new active token.
2. Update the matching GitHub repository secrets used by the deploy jobs: `CLOUDFLARE_API_TOKEN`, optional `CLOUDFLARE_BUILD_API_TOKEN`, and confirm `CLOUDFLARE_ACCOUNT_ID`.
3. Reconcile preview worker/service names in Cloudflare with the repo’s canonical `gs-*` naming before reruns. The repo still contains references that may need dashboard cleanup, including `gs-api-preview`, `gs-agent-preview`, and older service names such as `astro-gs-api`, `astro-gs-gateway`, and `goldshore-control-worker`.
4. Confirm the preview DNS/routes exist for `api-preview.goldshore.ai`, `gw-preview.goldshore.ai`, and `ops-preview.goldshore.ai` before rerunning failed preview jobs.
5. Rerun the affected GitHub Actions workflows, then run `.github/workflows/maintenance.yml` to verify the rotated credentials can still reconcile Cloudflare state.

For the full workflow/secret matrix, see `docs/ci/INFRA_SYNC_RUNBOOK.md`.
