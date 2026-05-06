# Frontend Integrity (gs-web)

This document defines the minimum checks that prevent unstyled or partially-loaded deploys for `apps/gs-web`.

## Canonical Cloudflare Pages settings

- Root directory: `apps/gs-web`
- Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @goldshore/gs-web build`
- Build output directory: `dist`

Framework preset is optional when command/output are explicitly set.

## Layout and asset rules

1. Pages should render through `src/layouts/WebLayout.astro` (directly or via wrappers).
2. Global styling is imported at layout level; avoid duplicate page-level global imports.
3. Prefer Astro/Vite asset imports for non-public assets:
   - `import logo from '../assets/logo.svg'`
   - `<img src={logo.src} />`
4. Only use hardcoded absolute paths for files that are guaranteed under `public/`.

## CSP rules

CSP must allow Astro-emitted bundles under `/_astro/*` and any approved external font/icon providers.

Minimum CSP baseline for gs-web:

- `default-src 'self'`
- `script-src 'self' 'unsafe-inline'`
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com`
- `font-src 'self' https://fonts.gstatic.com`
- `img-src 'self' data:`
- `connect-src 'self'`

If API calls require external origins, add explicit `connect-src` entries.

## Dist verification

Run after every build:

```bash
pnpm --filter @goldshore/gs-web build
node scripts/verify-web-dist.mjs
```

The verification script fails if:

- `apps/gs-web/dist/index.html` is missing
- `apps/gs-web/dist/_astro/*.css` is missing
- `apps/gs-web/dist/_astro/*.js` is missing
- `index.html` does not reference `/_astro/` assets
