# apps/gs-gateway

## Overview
The `gs-gateway` worker is the routing and queue ingress layer for GoldShore, served from the gateway hostname documented in [`docs/domains-and-auth.md`](../../docs/domains-and-auth.md). It handles proxying to the API, rate limiting, and preflight authorization checks. It is managed alongside the control worker as part of the Edge Workers deployment group.

Cloudflare metadata (from `wrangler.toml`):
- Worker name: `gs-gateway`
- Route: see [`docs/domains-and-auth.md`](../../docs/domains-and-auth.md)
- Compatibility date: `2025-01-10`
- Bindings: `gs-kv`, `GATEWAY_KV` (KV), `JOB_QUEUE` (Queues producer), `AI` (AI Gateway)
- Environment variables: `ENV=production`, `API_ORIGIN=https://api.goldshore.ai`, `CLOUDFLARE_ACCESS_AUDIENCE`, `CLOUDFLARE_TEAM_DOMAIN`

Configuration highlights (from `wrangler.toml`):
- `ENV=production`
- `API_ORIGIN=https://api.goldshore.ai`
- `CLOUDFLARE_ACCESS_AUDIENCE` (required for Access verification)
- `CLOUDFLARE_TEAM_DOMAIN` (required for Access verification)
- KV bindings: `gs-kv`, `GATEWAY_KV`
- Queue producer: `JOB_QUEUE`
- AI binding: `AI`

## Routes/Endpoints
These are worker API endpoints implemented in `src/index.ts` (not HTML pages). Route handlers are defined in `src/index.ts`.
- `https://gw.goldshore.ai/*` (proxy + routing entrypoint)
- `GET /` (status page)
- `GET /health`
- `GET /templates`
- `GET /user/login`
- `POST /v1/chat`
- `/api/*` (proxy passthrough to `gs-api` when no matching route)

## Local Dev
```bash
pnpm install
pnpm --filter ./apps/gs-gateway dev
pnpm --filter ./apps/gs-gateway build
```

## Deploy
- Production deploy: `.github/workflows/deploy-gs-gateway.yml.disabled` (currently disabled on disk)
- Preview deploy: `.github/workflows/preview-gs-gateway.yml`
- Uses `wrangler deploy` with `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets
- Domains, previews, and Access policies: see [`docs/domains-and-auth.md`](../../docs/domains-and-auth.md).

## Workflow conventions
Gateway workflows run from the repository root for install/validation, then switch to `working-directory: apps/gs-gateway` only for `wrangler deploy`. Keep this convention for new jobs to avoid root/subdirectory drift in CI behavior.
