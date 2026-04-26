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
The `gs-control` worker handles infrastructure automation tasks (DNS updates, preview environment creation, secret rotation, and sync operations) and is served from `https://ops.goldshore.ai/*` on Cloudflare Workers.

Configuration highlights (from `wrangler.toml`):
- `ENV=production`
- KV binding: `CONTROL_LOGS`
- R2 binding: `STATE`
- Service bindings: `API` (`gs-api`), `GATEWAY` (`gs-gateway`)

## Routes/Endpoints
These are worker API endpoints implemented in `src/index.ts` (not HTML pages). Route handlers are defined in `src/index.ts`.
- `POST /system/sync`
- `POST /dns/update`
- `POST /preview/create`

## Local Dev
```bash
pnpm install
pnpm --filter ./apps/gs-control dev
pnpm --filter ./apps/gs-control run-task
```

## Deploy
- Production deploy: `.github/workflows/deploy-control-worker.yml`
- Preview deploy: `.github/workflows/preview-control-worker.yml`
- Uses `wrangler deploy` with `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets
- Store `CLOUDFLARE_API_TOKEN` in Cloudflare secrets (via `wrangler secret put`) rather than committing env values

<!-- // [AUTO-UPDATE] Updated by Jules AI on 2026-01-23 01:43 -->
```bash
pnpm --filter ./apps/gs-control deploy
```
