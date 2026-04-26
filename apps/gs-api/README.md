# GoldShore API (`apps/gs-api`)

Primary Hono-based API worker for GoldShore.

## Overview

`gs-api` serves the core API surface behind `api.goldshore.ai`, including health checks, AI analysis, user/admin endpoints, content management, media delivery, templates, and internal system telemetry.

## Cloudflare configuration

- App-local Wrangler config: `apps/gs-api/wrangler.toml`
- Canonical Cloudflare manifest: `infra/Cloudflare/gs-api.wrangler.toml`
- Live deploy workflows: `.github/workflows/deploy-gs-api.yml` and `.github/workflows/preview-gs-api.yml`
- Worker Builds for this service must use the `gs-control` build token.

App-local `wrangler.toml` currently defines the production and preview routes:

- `api.goldshore.ai/*`
- `api-preview.goldshore.ai/*`

## Routes and endpoints

The router in `src/index.ts` and the route files in `src/routes/` are the source of truth.

### Public routes

- `GET /` — HTML service status page
- `GET /health` — shallow or deep health probe via `?type=deep`

### Authenticated API modules

- `GET /ai`
- `POST /ai/analysis`
- `GET /users`
- `GET /users/:id`
- `GET /user/:id` — legacy redirect to `/users/:id`
- `GET /system/status`
- `GET /system/routing`
- `GET /system/config`
- `PUT /system/config`
- `GET /system/version`
- `GET /templates`
- `GET /admin/users`
- `POST /admin/users`
- `PATCH /admin/users/:id`
- `GET /admin/audit`
- `GET /media`
- `GET /media/:id`
- `POST /media/upload`
- `GET /pages`
- `GET /pages/slug/:slug`
- `GET /pages/:id`
- `POST /pages`
- `PUT /pages/:id`
- `PATCH /pages/:id/status`
- `DELETE /pages/:id`
- `GET /internal/inbox-status`
- `GET /internal/dns-sync-status`

### Versioned compatibility routes

- `GET /v1/users`
- `GET /v1/users/:id`
- `GET /v1/agents`
- `GET /v1/models`
- `GET /v1/logs`

## Development

```bash
pnpm install
pnpm --filter @goldshore/gs-api dev
pnpm --filter @goldshore/gs-api build
pnpm --filter @goldshore/gs-api test
```

Deployment-oriented scripts exposed by the package:

```bash
pnpm --filter @goldshore/gs-api deploy
pnpm --filter @goldshore/gs-api test:gateway
```

## Deployment

- Production workflow: `.github/workflows/deploy-gs-api.yml`
- Preview workflow: `.github/workflows/preview-gs-api.yml`
- Secrets used by GitHub Actions and Wrangler deployments include `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

### Worker Builds troubleshooting

If Cloudflare Worker Builds fails before dependency installation with a deleted or rolled build token error, fix the Worker Builds token in Cloudflare Dashboard for `gs-api`. Use an active build token associated with the `gs-control` service.

## AI Gateway local setup

Install dependencies and populate local secrets before running gateway validation.

```bash
cp apps/gs-api/.env.example apps/gs-api/.env
pnpm -C apps/gs-api wrangler secret put CF_AIG_TOKEN
pnpm -C apps/gs-api wrangler secret put CF_GATEWAY_URL
pnpm --filter @goldshore/gs-api test:gateway
```

Relevant environment variables:

- `CF_AIG_TOKEN`
- `CF_GATEWAY_URL`
