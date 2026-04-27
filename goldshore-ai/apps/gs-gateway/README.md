# apps/gs-gateway

## Overview
The `gs-gateway` worker is the routing and queue ingress layer for GoldShore on Cloudflare Workers. It is managed alongside the control worker as part of the Edge Workers deployment group.

Cloudflare metadata (from `wrangler.toml`):
- Worker name: `gs-gateway`
- Route: see [`docs/domains-and-auth.md`](../../docs/domains-and-auth.md)
- Compatibility date: `2025-01-10`
- Bindings: `gs-kv`, `GATEWAY_KV` (KV), `JOB_QUEUE` (Queues producer), `AI` (AI Gateway)
- Environment variables: `ENV=production`, `API_ORIGIN=https://api.goldshore.ai`, `CLOUDFLARE_ACCESS_AUDIENCE`, `CLOUDFLARE_TEAM_DOMAIN`

## Routes/Endpoints
These are worker API endpoints implemented in `src/index.ts` (not HTML pages). The router file is the source of truth.
- `https://gw.goldshore.ai/*` (proxy + routing entrypoint)
- `GET /` (status page)
- `GET /health`
- `GET /templates`
- `GET /user/login`
- `POST /v1/chat`
- `*` (proxy passthrough to `gs-api` when no matching route)
The `gs-gateway` worker is the routing and queue ingress layer for GoldShore, served from the gateway hostname documented in [`docs/domains-and-auth.md`](../../docs/domains-and-auth.md). It handles proxying to the API, rate limiting, and preflight authorization checks.

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

## Local Dev
```bash
pnpm install
pnpm --filter ./apps/gs-gateway dev
pnpm --filter ./apps/gs-gateway build
```

## Deploy
- Production deploy: `.github/workflows/deploy-gateway.yml`
- Preview deploy: `.github/workflows/preview-gateway.yml`
- Uses `wrangler deploy` with `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets
- Domains, previews, and Access policies: see [`docs/domains-and-auth.md`](../../docs/domains-and-auth.md).

<!-- // [AUTO-UPDATE] Updated by Jules AI on 2026-01-23 01:43 -->
```bash
pnpm --filter ./apps/gs-gateway deploy
```
