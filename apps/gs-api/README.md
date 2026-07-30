# gs-api

Canonical Cloudflare Worker for the GoldShore API surface.

## Ownership

- Repo: `marzton/goldshore-ai`
- App path: `apps/gs-api`
- Worker name: `gs-api`
- Package name: `@goldshore/gs-api`
- Wrangler config: `apps/gs-api/wrangler.toml`

## Routes

Production:

- `api.goldshore.ai/*`
- `api.goldshore.org/*`

Preview:

- `workers.dev` preview unless a dedicated `api-preview.goldshore.ai/*` route is intentionally added.

`gs-api` owns API routes directly. It is not proxied through `gs-gateway` or any other satellite worker.

## Do not claim

- `goldshore.ai/*`
- `www.goldshore.ai/*`
- `gw.goldshore.ai/*`
- `agent.goldshore.ai/*`
- `admin.goldshore.ai`
- `ops.goldshore.ai/*`

## Build

From repo root:

```bash
pnpm --filter @goldshore/gs-api build
```

This runs:

```bash
wrangler deploy --env prod --dry-run --outdir=dist
```

## Deploy

From repo root:

```bash
pnpm --filter @goldshore/gs-api deploy
```

This runs:

```bash
wrangler deploy --env prod
```

## Required GitHub Actions secrets

Use the repository-specific canonical deploy token:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN`

In CI, map:

```yaml
CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN }}
```

Do not use:

- `CLOUDFLARE_BUILD_API_TOKEN`
- A generic repository-level `CLOUDFLARE_API_TOKEN` secret
- `CLOUDFLARE_API_TOKEN_GS_CONTROL`
- Fallback expressions such as `secretA || secretB`

Cloudflare Worker Builds for API services must use the `gs-control` build token in the Cloudflare Dashboard, but GitHub Actions deployments should use `CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN` as shown above.

## Binding rules

`gs-api` is the only backend app in the canonical two-app monorepo, so route ownership remains direct even when it binds Cloudflare platform resources.

Allowed platform bindings include:

- `PLATFORM_DB` → `gs_platform_db`
- `AUDIT_DB` → `gs_audit_db`
- `SIGNALS_DB` → `gs_signals_db`
- `JOBS_DB` → `gs_jobs_db`
- `GS_ASSETS` → `gs-assets`

Do not add service bindings to retired or satellite workers such as `gs-agent`, `gs-gateway`, `gs-mail`, `gs-control`, or `gs-platform`. Route, cron, queue, email, auth, and AI logic belongs in `apps/gs-api`.

Do not bind `GS_WEB` unless a Worker service named `gs-web` exists. If `gs-web` is Cloudflare Pages, remove the service binding.

## Validation

Before deploy:

```bash
pnpm validate:workers
pnpm --filter @goldshore/gs-api build
```

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
