# GoldShore Web (`apps/gs-web`)

Public marketing site, documentation hub, and customer-facing Astro app for GoldShore.

## Overview

`gs-web` is the public web surface for:

- marketing and contact flows,
- developer docs and API reference pages,
- lightweight authenticated customer routes,
- Cloudflare Pages Functions used by forms, search, and admin support tooling.

## Cloudflare configuration

- Pages project name: `gs-web` (production), `preview-web` (preview)
- Pages bindings config: `infra/cloudflare/goldshore-web.wrangler.toml`
- Preview runtime bindings commonly set by CI:
  - `PUBLIC_API=https://api-preview.goldshore.ai`
  - `PUBLIC_GATEWAY=https://gw-preview.goldshore.ai`
- Build diagnostics exposed on `/status`:
  - `PUBLIC_BUILD_TIMESTAMP`
  - `PUBLIC_COMMIT_HASH`
  - `PUBLIC_RELEASE_LABEL` (optional)
- Pages project: `gs-web`
- Local/app Wrangler config: `apps/gs-web/wrangler.jsonc`
- Canonical Cloudflare manifest: `infra/Cloudflare/gs-web.wrangler.toml`
- Preview and production deployments are driven by the live workflows under `.github/workflows/`.
- Preview environments commonly point browser-visible runtime variables at preview services such as `https://api-preview.goldshore.ai` and `https://gw-preview.goldshore.ai`.

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

- Production workflow: `.github/workflows/deploy-gs-web.yml`
- Preview workflow: `.github/workflows/preview-gs-web.yml`
- Cloudflare Pages root directory: `apps/gs-web`
- Build command: `pnpm build`
- Output directory: `dist`

- For domain, preview, and Access details, see [`docs/domains-and-auth.md`](../../docs/domains-and-auth.md).
- Production deploy: `.github/workflows/deploy-gs-web.yml`
- Preview deploy: `.github/workflows/preview-gs-web.yml`
- Domains, previews, and Access policy details: [`docs/domains-and-auth.md`](../../docs/domains-and-auth.md)

## Preview authentication

Preview environments are not public.

- Preview builds reuse the centralized GitHub App callback flow instead of per-branch callbacks.
- Cloudflare Access protects preview hostnames.
- Non-interactive checks against preview environments should use Cloudflare Access service-token headers.

## Contact form and mail delivery

`/api/contact` stores submissions in KV/D1 and can send email through MailChannels from Cloudflare Pages Functions.

Set these environment variables in the `gs-web` Pages project as needed:

- `MAILCHANNELS_SENDER_EMAIL`
- `MAILCHANNELS_SENDER_NAME`
- `CONTACT_NOTIFICATION_EMAILS`
- `MAILCHANNELS_API_URL`

Keep the existing `KV` and `DB` bindings so submissions still persist if mail delivery is degraded.

## Source of truth

For API behavior exposed through the public docs, treat the OpenAPI description and the actual route files as canonical. Update this README when app routes, workspace commands, or deployment workflows change.
