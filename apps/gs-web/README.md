# GoldShore Web (`apps/gs-web`)

Public marketing site, documentation hub, and customer-facing Astro app for GoldShore.

## Overview

`gs-web` is the public web surface for:

- marketing and contact flows,
- developer docs and API reference pages,
- lightweight authenticated customer routes,
- SSR endpoints used by forms, search, and admin support tooling.

## Cloudflare configuration

`gs-web` has exactly one deployment model: an Astro SSR Cloudflare Worker with
Assets. `astro.config.mjs` keeps `output: 'server'` and the Cloudflare adapter;
`src/worker.ts` is the Wrangler `main`; and `wrangler.toml` uploads `dist` through
the `ASSETS` binding. Selecting `env.prod` produces the `gs-web-prod` release.
Astro sessions are disabled: admin identity comes from Cloudflare Access and all
durable application state is owned by `gs-api`.

The same production release owns these four canonical UI hosts:

- `goldshore.ai`
- `goldshore.org`
- `admin.goldshore.ai`
- `admin.goldshore.org`

Runtime variables include `PUBLIC_API`, build diagnostics, Cloudflare Access
settings, and public provider identifiers. Secrets belong in Cloudflare secrets,
not this repository. `gs-web` does not currently read `GS_CONFIG` directly; do
not add that binding without a concrete request-time consumer.

## Routes and endpoints

Routing and access policy: [`docs/security-scope.md`](../../docs/security-scope.md).

### Public pages

- `/`
- `/about`
- `/contact`
- `/intake`
- `/legal`
- `/legal/privacy`
- `/legal/terms`
- `/pricing`
- `/services`
- `/status`
- `/team`
- `/thank-you`
- `/apps/risk-radar`
- `/templates`
- `/developer`
- `/developer/sdk`
- `/developer/docs`
- `/developer/docs/*`
- `/developer/api/*`
- `/*` via `src/pages/[...path].astro` for CMS-backed page slugs served from the API

### Protected or operator-facing pages in this app

- `/app/dashboard`
- `/app/logs`
- `/app/profile`
- `/app/settings`
- `/admin/lead-submissions`
- `/page-builder-preview`

### API routes served from `gs-web`

- `GET /api/contact` — health/introspection response for the contact endpoint
- `POST /api/contact` — stores and optionally emails contact submissions
- `GET /api/docs-search` — local docs search index query endpoint
- `GET /api/forms` — lists form configurations for authorized operators
- `POST /api/forms` — creates a form configuration
- `GET /api/forms/:slug` — reads one form configuration
- `PUT /api/forms/:slug` — updates one form configuration
- `PATCH /api/forms/:slug` — alias of the update route
- `GET /api/admin/lead-submissions` — returns lead submissions, optionally as CSV
- `POST /api/admin/lead-submissions` — updates lead-submission status

## Development

Install dependencies once from the repo root, then run app-specific commands:

```bash
pnpm install
pnpm --filter @goldshore/gs-web dev
pnpm --filter @goldshore/gs-web build
pnpm --filter @goldshore/gs-web preview
```

Useful additional checks:

```bash
pnpm --filter @goldshore/gs-web check
pnpm --filter @goldshore/gs-web test:unit
pnpm --filter @goldshore/gs-web test:e2e
```

## Deployment

- Build verification workflow: `.github/workflows/deploy-gs-web.yml`.
- Authoritative deployer: the Cloudflare Workers Build git integration.
- Production command: `wrangler deploy --env prod` from `apps/gs-web` after the
  Astro production build.
- Output directory: `dist` (SSR server output plus static assets).
- Deployable manifest: `apps/gs-web/wrangler.toml`.
- Reference manifest: `infra/Cloudflare/gs-web.wrangler.toml`.

For domain, preview, and Access details, see
[`docs/domains-and-auth.md`](../../docs/domains-and-auth.md).

## Pull-request previews

Pull requests build the same production manifest without a dedicated preview Worker,
custom preview hostname, or preview storage. Cloudflare Worker Version URLs may be
used for read-only visual review; mutation paths remain disabled there.

## Contact form and lead administration

`gs-web` does not hold runtime KV, D1, or R2 data bindings. `/api/contact`, `/api/admin/lead-submissions`, and `/api/forms/*` are thin same-origin compatibility proxies that forward request-time storage operations to `gs-api` under `/v1/forms/*`.

Set `PUBLIC_API` in the `gs-web` Worker environment to the matching API origin:

- Production: `https://api.goldshore.ai`

Do not add `GS_CONFIG` or other data bindings to `gs-web` unless a specific SSR endpoint needs a public, request-time, read-only lookup that cannot be served by `gs-api`.

## Future Pages migration

Moving `gs-web` to Cloudflare Pages would be an explicit architecture change,
not an additional deployment target. Every dynamic web endpoint—including
forms, search, authentication callbacks, admin endpoints, and catch-all server
rendering—must first move into `apps/gs-api`. Only after that migration may the
Worker entry point and Worker routes be replaced by one Pages deployment.

## Source of truth

For API behavior exposed through the public docs, treat the OpenAPI description and the actual route files as canonical. Update this README when app routes, workspace commands, or deployment workflows change.
