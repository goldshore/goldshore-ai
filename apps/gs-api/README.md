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

Pull requests use Cloudflare Worker Version URLs generated from the production
manifest. Version URLs are read-only and do not own custom DNS, event triggers,
or separate preview resources.

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

## Controlled operations

- `.github/workflows/deploy-gs-api.yml` builds and tests pull requests without
  mutating Cloudflare. Pushes to `main` apply the production migration ledger and
  deploy `env.prod`. Secret values remain dashboard-managed.
- `db/migrations/manifest.json` is the ordered D1 ledger. The production deploy
  applies its declared migrations before publishing the Worker; recovery and
  backfills remain explicit operator actions.
- `secret-contract.json` contains names and operational metadata only. Secret values
  must be created and rotated in the Cloudflare dashboard or an approved Secrets
  Store. `.github/workflows/audit-gs-api-secrets.yml` only lists remote names and
  reports required-name drift; it never reads or writes values.

Repository administrators must protect the production GitHub environment and require
reviewers for deployment. Pull requests never mutate production D1.

## Binding rules

`gs-api` is the only backend app in the canonical two-app monorepo, so route ownership remains direct even when it binds Cloudflare platform resources.

Allowed platform bindings include:

- `PLATFORM_DB` → `gs_platform_db`
- `AUDIT_DB` → `gs_audit_db`
- `SIGNALS_DB` → `gs_signals_db`
- `JOBS_DB` → `gs_jobs_db`
- `GS_ASSETS` → `gs-assets`
- `MAIL_ARCHIVE` → `gs-assets` under the `mail/inbound/` prefix
- `EMAIL` → native Cloudflare Email Sending binding
- `MAIL_JOBS_QUEUE` → `gs-mail-jobs`

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
- `GET /health` — dependency-free liveness probe
- `GET /ready` — dependency readiness probe
- `GET /admin/system/dependencies` — authenticated dependency detail

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

### Anthropic provider path

All product Anthropic calls must go through `src/lib/anthropic-provider.ts`; GitHub
workflows must not exchange OIDC tokens or pass provider credentials as outputs.
Cloudflare documents the Anthropic provider-native endpoint as
`AI.gateway(id).getUrl("anthropic")` from a Worker binding. Worker-binding calls
are pre-authenticated to AI Gateway, while Anthropic authenticates its Messages
API with `x-api-key`. There is no documented GitHub workload-identity exchange.

Official protocol references:

- [Cloudflare Anthropic provider](https://developers.cloudflare.com/ai-gateway/usage/providers/anthropic/)
- [Cloudflare authenticated gateways](https://developers.cloudflare.com/ai-gateway/configuration/authentication/)
- [Cloudflare Workers AI Gateway binding](https://developers.cloudflare.com/ai-gateway/usage/worker-binding-methods/)
- [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages)

Provision the credential as a `gs-api` Worker secret, not a GitHub output:

```bash
pnpm --filter @goldshore/gs-api exec wrangler secret put ANTHROPIC_API_KEY --env preview --name gs-api
pnpm --filter @goldshore/gs-api exec wrangler secret put ANTHROPIC_API_KEY --env prod --name gs-api
```

`ANTHROPIC_GATEWAY_ID` selects the gateway. The adapter permits a direct
Anthropic endpoint only in preview while `ANTHROPIC_GATEWAY_VERIFIED` is not
`true`. After an operator validates a preview request and its AI Gateway log,
set the flag to `true`; production already fails closed when the gateway is not
configured. The adapter enforces model, message, token and tool limits; JSON
Schema tool definitions; prompt/data boundaries; common PII redaction;
timeouts and bounded retries; token/cost telemetry; and route-level audit logs.
