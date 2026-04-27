# GoldShore Web (Astro)

Public marketing site and content hub for GoldShore.

## Goals

- Keep **navbars, menus, and responsive containers** in shared layouts.
- Keep **page content** in `src/pages` to remain lightweight.
- Keep **search** as a reusable component that can be embedded in marketing, docs, and portals.

## Template Page

Use the template page as the default starting point for new marketing or campaign pages:

- `src/pages/templates/index.astro`

The template demonstrates:

- Layout-driven navigation + menus.
- Grid containers for desktop/tablet/mobile.
- Search module integration.
- CTA cards and campaign-ready sections.

## Key Layouts + Components

- `src/layouts/WebLayout.astro`: Global nav, menu toggle, and footer.
- `src/layouts/MarketingLayout.astro`: Thin wrapper for marketing content.
- `src/components/DocsSearch.astro`: Independent search widget.
- `src/components/Hero.astro`, `FeatureGrid.astro`: Reusable marketing sections.

## SEO + Marketing Guidance

- Use descriptive `title` and `description` props on layouts.
- Keep CTA blocks consistent with `@goldshore/ui` buttons.
- Make every page responsive using `gs-grid` and `gs-section` helpers.

## Integrations to Plan

- AI: Google Gemini, ChatGPT, Jules, Cloudflare AI Gateway.
- Marketing + CRM: HubSpot, Mailchimp, Salesforce.
- Commerce: Stripe, Shopify, invoicing portals.
- Market data landing pages: Alpaca, Thinkorswim, Polygon, Tradier.

## Development

# apps/gs-web

## Overview

The public GoldShore website and user portal built with Astro and shared theme/UI packages. It deploys to Cloudflare Pages.

Cloudflare metadata:

- Pages project name: `gs-web` (production), `preview-web` (preview)
- Pages bindings config: `infra/cloudflare/goldshore-web.wrangler.toml`
- Connected services for preview builds: `PUBLIC_API=https://api-preview.goldshore.ai`, `PUBLIC_GATEWAY=https://gw-preview.goldshore.ai`
- Public diagnostics metadata injected during GitHub Actions builds:
  - `PUBLIC_BUILD_TIMESTAMP` = `${{ github.run_started_at }}` (ISO timestamp for the workflow run)
  - `PUBLIC_COMMIT_HASH` = `${{ github.sha }}` (full commit SHA used for the build)
- `/status` renders this metadata plus runtime counts for stylesheet links and scripts, and the layout logo asset path from `meta[name="gs-logo-src"]`.

## CSP compatibility

Approved outbound `connect-src` origins for browser runtime network calls in `src`:

- `'self'` for same-origin endpoints (for example `/api/contact` and `/api/docs-search`).
- `https://api.goldshore.ai` for production API calls (for example docs "Try it" console requests via `PUBLIC_API`).
- `https://api-preview.goldshore.ai` for preview API calls in preview deployments.

Keep `connect-src` scoped to these explicit hosts unless a new client-side integration is added and reviewed.

## CSP compatibility

Approved outbound `connect-src` origins for browser runtime network calls in `src`:

- `'self'` for same-origin endpoints (for example `/api/contact` and `/api/docs-search`).
- `https://api.goldshore.ai` for production API calls (for example docs "Try it" console requests via `PUBLIC_API`).
- `https://api-preview.goldshore.ai` for preview API calls in preview deployments.

Keep `connect-src` scoped to these explicit hosts unless a new client-side integration is added and reviewed.

## Routes/Endpoints

Routing & access policy: [`docs/security-scope.md`](../../docs/security-scope.md).

Public routes:

- `/`
- `/about`
- `/pricing`
- `/legal/privacy`
- `/legal/terms`
- `/contact`

Authenticated user portal:

- `/app/dashboard`
- `/app/profile`
- `/app/logs`
- `/app/settings`

## Local Dev

```bash
pnpm install
pnpm --filter ./apps/gs-web dev
pnpm --filter ./apps/gs-web build
pnpm --filter ./apps/gs-web preview
```

## Contact form + Cloudflare mail delivery

`/api/contact` stores submissions in KV/D1 and can send emails through MailChannels from Cloudflare Pages Functions.

Set these environment variables in the `gs-web` Pages project:

- `MAILCHANNELS_SENDER_EMAIL` (required for email send)
- `MAILCHANNELS_SENDER_NAME` (optional, defaults to `GoldShore`)
- `CONTACT_NOTIFICATION_EMAILS` (comma-separated recipient list for new submissions)
- `MAILCHANNELS_API_URL` (optional override, defaults to `https://api.mailchannels.net/tx/v1/send`)

Keep the existing bindings for `KV` and `DB` so submissions continue to persist even if email delivery is temporarily unavailable.

## Live deployment (with themes)

The live web deployment (`gs-web`) already includes GoldShore theme styling because the app imports `@goldshore/theme` in both layout and global styles.

From repo root, deploy the current web build to Cloudflare Pages production:

```bash
pnpm --filter @goldshore/gs-web build
```

This builds `@goldshore/gs-web` and produces `apps/gs-web/dist` for deployment to the `gs-web` Pages project on `main`.

Cloudflare Pages settings for monorepo correctness:
- **Root directory:** `apps/gs-web`
- **Build command:** `pnpm build`
- **Output directory:** `dist`

If root is left at repository root, Pages looks for `/dist` and fails with `Output directory "dist" not found`.

## Deploy

- Production deploy: `.github/workflows/deploy-web.yml`
- Preview deploy: `.github/workflows/preview-web.yml`
- Domains, previews, and Access policies: see [`docs/domains-and-auth.md`](../../docs/domains-and-auth.md).

## Preview Authentication

- Preview builds reuse the centralized GitHub App callback handler; OAuth completes in the shared callback service, which redirects back to the preview hostname instead of registering per-branch callbacks.
- Cloudflare Access is enforced by the shared Access application and policy set, with preview hostnames allowlisted alongside production domains.
- See the centralized guide: [`docs/domains-and-auth.md`](../../docs/domains-and-auth.md).

<!-- // [AUTO-UPDATE] Updated by Jules AI on 2026-01-23 01:43 -->

# GoldShore Web (Astro)

Public marketing site and content hub for GoldShore.

## Goals

- Keep **navbars, menus, and responsive containers** in shared layouts.
- Keep **page content** in `src/pages` to remain lightweight.
- Keep **search** as a reusable component that can be embedded in marketing, docs, and portals.

## Template Page

Use the template page as the default starting point for new marketing or campaign pages:

- `src/pages/templates/index.astro`

The template demonstrates:

- Layout-driven navigation + menus.
- Grid containers for desktop/tablet/mobile.
- Search module integration.
- CTA cards and campaign-ready sections.

## Key Layouts + Components

- `src/layouts/WebLayout.astro`: Global nav, menu toggle, and footer.
- `src/layouts/MarketingLayout.astro`: Thin wrapper for marketing content.
- `src/components/DocsSearch.astro`: Independent search widget.
- `src/components/Hero.astro`, `FeatureGrid.astro`: Reusable marketing sections.

## SEO + Marketing Guidance

- Use descriptive `title` and `description` props on layouts.
- Keep CTA blocks consistent with `@goldshore/ui` buttons.
- Make every page responsive using `gs-grid` and `gs-section` helpers.

## Integrations to Plan

- AI: Google Gemini, ChatGPT, Jules, Cloudflare AI Gateway.
- Marketing + CRM: HubSpot, Mailchimp, Salesforce.
- Commerce: Stripe, Shopify, invoicing portals.
- Market data landing pages: Alpaca, Thinkorswim, Polygon, Tradier.

## Development

```bash
pnpm --filter @goldshore/gs-web dev
```

# apps/gs-web

## Overview

The public GoldShore website and user portal built with Astro, shared theme, and UI components. It deploys to Cloudflare Pages as the primary marketing and customer-facing experience.

## Routes/Endpoints

Routing & access policy: [`docs/security-scope.md`](../../docs/security-scope.md).

Public routes:

- `/`
- `/about`
- `/pricing`
- `/legal/privacy`
- `/legal/terms`
- `/contact`

Authenticated user portal:

- `/app/dashboard`
- `/app/profile`
- `/app/logs`
- `/app/settings`

## Local Dev

```bash
pnpm install
pnpm --filter ./apps/gs-web dev
pnpm --filter ./apps/gs-web build
pnpm --filter ./apps/gs-web preview
```

## Live deployment (with themes)

The live web deployment (`gs-web`) already includes GoldShore theme styling because the app imports `@goldshore/theme` in both layout and global styles.

From repo root, deploy the current web build to Cloudflare Pages production:

```bash
pnpm --filter @goldshore/gs-web build
```

This builds `@goldshore/gs-web` and produces `apps/gs-web/dist` for deployment to the `gs-web` Pages project on `main`.

Cloudflare Pages settings for monorepo correctness:
- **Root directory:** `apps/gs-web`
- **Build command:** `pnpm build`
- **Output directory:** `dist`

If root is left at repository root, Pages looks for `/dist` and fails with `Output directory "dist" not found`.

## Deploy

Cloudflare Pages deploys via GitHub Actions. Domains, previews, and Access policies: see [`docs/domains-and-auth.md`](../../docs/domains-and-auth.md).

## Preview Authentication

- Preview builds reuse the centralized GitHub App callback handler; OAuth completes in the shared callback service, which redirects back to the preview hostname instead of registering per-branch callbacks.
- Cloudflare Access is enforced by the shared Access application and policy set, with preview hostnames allowlisted alongside production domains.
- See the centralized guide: [`docs/domains-and-auth.md`](../../docs/domains-and-auth.md).
