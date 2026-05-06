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

- `src/layouts/AdminLayout.astro`: Admin shell (sidebar + topbar).
- `src/components/Sidebar.astro`: Navigation tree.
- `src/components/Topbar.astro`: Global actions + page title.
- `src/components/StatCard.astro`: KPI tiles.
- `src/components/Table.astro`: Structured tabular data.

## Operations + HITL Guidance

- Track PRs, issues, and workflows in admin table views.
- Pair with gateway + agent template endpoints for real-time status.
- Plan future staffing dashboards for human-in-the-loop approvals.
- Reference the [agent integration policy](../../docs/agent-integration.md) for when to use Jules/Agent and required approvals.

# apps/gs-admin

## Overview
The GoldShore admin cockpit is an Astro SSR dashboard protected by Cloudflare Access, built on the shared UI kit and theme.

Cloudflare metadata:
- Pages project name: `gs-admin` (production), `preview-admin` (preview)
- Pages bindings config: `infra/cloudflare/goldshore-admin.wrangler.toml`
- Connected services for preview builds: `PUBLIC_API=https://api-preview.goldshore.ai`, `PUBLIC_GATEWAY=https://gw-preview.goldshore.ai`

Documentation:
- [Integrations hub (docs + admin config)](../../docs/integrations.md)
- [Agent integration policy](../../docs/agent-integration.md)

## Routes/Endpoints
Routing & access policy: [`docs/security-scope.md`](../../docs/security-scope.md).

Admin sections:
- `/admin/analytics`
- `/admin/monetization`
- `/admin/forms`
- `/admin/media`
- `/admin/page-editor`
- `/admin/pages`
- `/admin/pii-scans`
- `/admin/logs`
- `/admin/settings`
- `/admin/overview`
- `/admin/api-logs`
- `/admin/workers/status`
- `/admin/workers/bindings`
- `/admin/workers/routes`
- `/admin/users/list`
- `/admin/users/sessions`
- `/admin/users/permissions`
- `/admin/system/dns`
- `/admin/system/pages`
- `/admin/system/storage`
- `/admin/system/secrets`

## Local Dev
```bash
pnpm install
pnpm --filter ./apps/gs-admin dev
pnpm --filter ./apps/gs-admin build
pnpm --filter ./apps/gs-admin preview
```

## Deploy
- Production deploy: `.github/workflows/deploy-admin.yml`
- Preview deploy: `.github/workflows/preview-admin.yml`
- Domains, previews, and Access policies: see [`docs/domains-and-auth.md`](../../docs/domains-and-auth.md).

## Preview Authentication
- Preview builds reuse the centralized GitHub App callback handler; OAuth completes in the shared callback service, which redirects back to the preview hostname instead of registering per-branch callbacks.
- Cloudflare Access is enforced by the shared Access application and policy set, with preview hostnames allowlisted alongside production domains.
- See the centralized guide: [`docs/domains-and-auth.md`](../../docs/domains-and-auth.md).
