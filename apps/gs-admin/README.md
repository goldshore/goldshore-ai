# GoldShore Admin (`apps/gs-admin`)

Secure Astro-based operations console for GoldShore teams.

## Overview

`gs-admin` is the internal dashboard for operations, content, user, and system workflows. It is protected with Cloudflare Access and uses shared workspace packages for auth, config, schema, theme, UI, and utilities.

Documentation:

- [Integrations hub](../../docs/integrations.md)
- [Agent integration policy](../../docs/agent-integration.md)
- [Domains and auth](../../docs/domains-and-auth.md)

## Cloudflare configuration

- Pages project: `gs-admin`
- App-local Wrangler config: `apps/gs-admin/wrangler.toml`
- Canonical Cloudflare manifest: `infra/Cloudflare/gs-admin.wrangler.toml`
- Preview and production deployments are handled by the live workflows under `.github/workflows/`.

## Routes and endpoints

Routing and access policy: [`docs/security-scope.md`](../../docs/security-scope.md).

Cloudflare metadata:
- Pages project name: `gs-admin` (production), `preview-admin` (preview)
- Pages bindings config: `infra/Cloudflare/gs-admin.wrangler.toml`
- Connected services for preview builds: `PUBLIC_API=https://api-preview.goldshore.ai`, `PUBLIC_GATEWAY=https://gw-preview.goldshore.ai`
- Standard build metadata injected by CI: `PUBLIC_BUILD_TIMESTAMP`, `PUBLIC_COMMIT_HASH`, and optional `PUBLIC_RELEASE_LABEL`

- `/`
- `/ai`
- `/api-logs`
- `/appearance/hero`
- `/dashboard`
- `/deployments`
- `/domain`
- `/logs`
- `/settings`
- `/systems`
- `/templates`
- `/trading`
- `/users`

### Admin pages

- `/admin/overview`
- `/admin/analytics`
- `/admin/api-logs`
- `/admin/content`
- `/admin/forms`
- `/admin/forms/:slug`
- `/admin/logs`
- `/admin/media`
- `/admin/monetization`
- `/admin/page-editor`
- `/admin/pages`
- `/admin/pages/new`
- `/admin/pages/editor`
- `/admin/pages/:id`
- `/admin/pii-scans`
- `/admin/settings`
- `/admin/system`
- `/admin/system/dns`
- `/admin/system/pages`
- `/admin/system/secrets`
- `/admin/system/storage`
- `/admin/systems`
- `/admin/users`
- `/admin/users/list`
- `/admin/users/permissions`
- `/admin/users/sessions`
- `/admin/workers`
- `/admin/workers/bindings`
- `/admin/workers/routes`
- `/admin/workers/status`

## Local Dev
```bash
pnpm install
pnpm --filter ./apps/gs-admin dev
pnpm --filter ./apps/gs-admin build
pnpm --filter ./apps/gs-admin preview
```

## Deploy
- Production deploy: `.github/workflows/deploy-gs-admin.yml`
- Preview deploy: `.github/workflows/preview-gs-admin.yml`
- Domains, previews, and Access policies: see [`docs/domains-and-auth.md`](../../docs/domains-and-auth.md).

## Preview Authentication
- Preview builds reuse the centralized GitHub App callback handler; OAuth completes in the shared callback service, which redirects back to the preview hostname instead of registering per-branch callbacks.
- Cloudflare Access is enforced by the shared Access application and policy set, with preview hostnames allowlisted alongside production domains.
- See the centralized guide: [`docs/domains-and-auth.md`](../../docs/domains-and-auth.md).

<!-- // [AUTO-UPDATE] Updated by Jules AI on 2026-01-23 01:43 -->
# GoldShore Admin (Astro)

Secure operational console for GoldShore teams.

## Goals

- Keep **navigation, menus, and layout shell** in `AdminLayout`.
- Keep **dashboard modules** (tables, cards, charts) as reusable components.
- Ensure templates make it easy to extend operations, staffing, and workflow views.

## Template Page

Use the admin template to scaffold new operational modules:

- `src/pages/templates/index.astro`

The template demonstrates:

- Layout shell with sidebar + topbar.
- Stats cards for KPI summaries.
- Table patterns for logs, runs, and staffing.

## Key Layouts + Components

- `GET /api/admin/hero`
- `POST /api/admin/hero`
- `GET /api/gs-api/health`
- `GET /api/gs-api/status`
- `GET /api/gs-api/version`
- `GET /api/gs-api/config`
- `PUT /api/gs-api/config`
- `GET /api/gs-api/dns-sync-status`
- `GET /api/gs-api/inbox-status`
- `GET /api/gs-api/sync-runs`

## Development

```bash
pnpm install
pnpm --filter @goldshore/gs-admin dev
pnpm --filter @goldshore/gs-admin build
pnpm --filter @goldshore/gs-admin preview
```

Useful checks:

```bash
pnpm --filter @goldshore/gs-admin test
pnpm --filter @goldshore/gs-admin test:unit
```

## Deployment

- Production workflow: `.github/workflows/deploy-gs-admin.yml`
- Preview workflow: `.github/workflows/preview-gs-admin.yml`
- Cloudflare Pages root directory: `apps/gs-admin`
- Build command: `pnpm build`
- Output directory: `dist`

See [`docs/domains-and-auth.md`](../../docs/domains-and-auth.md) for Access and preview-host details.

## Admin UI structure

Key reusable building blocks:

- `src/layouts/AdminLayout.astro`
- `src/components/Sidebar.astro`
- `src/components/Topbar.astro`
- `src/components/StatCard.astro`
- `src/components/Table.astro`
- `src/pages/templates/index.astro` for scaffolding new operational pages

## Operational guidance

- Keep navigation and layout concerns in `AdminLayout`.
- Prefer reusable modules for tables, cards, and workflow dashboards.
- Coordinate admin changes with the API and agent surfaces when dashboards depend on live service data.
