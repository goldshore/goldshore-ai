# apps/gs-api

## Overview
The `gs-api` worker is the primary Hono-based API layer for GoldShore, served from `https://api.goldshore.ai/*` on Cloudflare Workers.

Cloudflare metadata (from `wrangler.toml`):
- Worker name: `gs-api`
- Route: `api.goldshore.ai/*`
- Compatibility date: `2025-01-10`
- Bindings: `API_KV` (KV), `ASSETS` (R2), `DB` (D1), `AI` (AI Gateway)
- Environment variable: `ENV=production`
The `gs-api` worker is the primary Hono-based API layer for GoldShore, served from `https://api.goldshore.ai/*` on Cloudflare Workers. It uses KV, R2, D1, and the AI Gateway bindings configured in `wrangler.toml`.

Configuration highlights (from `wrangler.toml`):
- `ENV=production`
- KV binding: `API_KV`
- R2 binding: `ASSETS`
- D1 binding: `DB`
- AI binding: `AI`

## Routes/Endpoints
These are API endpoints handled by the worker in `src/index.ts` and the route files in `src/routes` (not HTML pages). The router files are the source of truth.
- `GET /` (status page)
- `GET /health`
- `GET /ai`
- `POST /ai/analysis`
- `GET /users`
- `GET /user/:id`
- `GET /system/info`
- `GET /templates`
- `GET /v1/users`
- `GET /v1/agents`
- `GET /v1/models`
- `GET /v1/logs`

## Local Dev
```bash
pnpm install
pnpm --filter ./apps/gs-api dev
pnpm --filter ./apps/gs-api build
```

## Deploy
- Production deploy: `.github/workflows/deploy-api-worker.yml`
- Preview deploy: `.github/workflows/preview-api-worker.yml`
- Uses `wrangler deploy` with `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets

<!-- // [AUTO-UPDATE] Updated by Jules AI on 2026-01-23 01:43 -->
```bash
pnpm --filter ./apps/gs-api deploy
```
