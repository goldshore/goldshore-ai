# Cloudflare Deployment Checklist

Last updated: 2026-07-11

Use this checklist after any Cloudflare Pages or Worker deployment from `marzton/goldshore-ai`.

## Required GitHub secrets

Repository: `marzton/goldshore-ai`

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_BUILD_API_TOKEN`

Do not use fallback expressions such as `CLOUDFLARE_BUILD_API_TOKEN || CLOUDFLARE_API_TOKEN` in workflows.

## Cloudflare Pages build settings

For the `gs-web` Cloudflare Pages project, use these settings:

```text
Framework preset: Astro
Root directory: /
Build command: npm run build
Build output directory: apps/gs-web/dist
Node version: 22.22.2 or newer 22.x
PNPM version: 9.15.4
```

The repository pins Node through `.node-version` and `.nvmrc`. If the Cloudflare dashboard has a `NODE_VERSION` environment variable, it must be `22.22.2` or newer. Do not leave it at `20.20.0`; Astro 6 rejects Node 20.

The root `npm run build` script is intentionally Pages-safe. It builds OpenAPI content, builds only `@goldshore/gs-web`, and verifies `apps/gs-web/dist`. Full monorepo builds should use `pnpm build:all` instead.

Do not configure Cloudflare Pages to run `turbo run build` across the full monorepo. That causes Worker dry-runs, binding checks, and unrelated backend packages to execute during a public website build.

## Lockfile status

The current `pnpm-lock.yaml` contains a duplicated `apps/gs-gateway` importer. Until that lockfile is regenerated cleanly from a Node 22 environment, use:

```bash
pnpm install --no-frozen-lockfile
```

After the lockfile is repaired and committed, switch CI install commands back to:

```bash
pnpm install --frozen-lockfile
```

## Deploy order

1. Deploy `gs-api` Worker.
2. Deploy `gs-gateway` Worker.
3. Deploy `gs-web` Pages.
4. Deploy `gs-admin` Pages.
5. Deploy optional/backend workers: `gs-control`, `gs-mail`, `gs-agent`, `gs-trading`.

## Manual GitHub Actions deploy

Run `.github/workflows/deploy-cloudflare.yml` with:

- target: desired app/service
- environment: `prod` or `preview`

## Local deploy equivalents

```bash
pnpm install --no-frozen-lockfile

pnpm build
pnpm exec wrangler pages deploy apps/gs-web/dist --project-name=gs-web --branch=main

pnpm build:pages:admin
pnpm exec wrangler pages deploy apps/gs-admin/dist --project-name=gs-admin --branch=main

pnpm --filter @goldshore/gs-api deploy
pnpm --filter @goldshore/gs-gateway deploy
```

## Live Cloudflare checks

```bash
curl -I https://goldshore.ai
curl -I https://www.goldshore.ai
curl -I https://goldshore.org
curl -I https://www.goldshore.org
curl -I https://api.goldshore.ai/health
curl -I https://gw.goldshore.ai/health
curl -I https://admin.goldshore.ai
```

Expected:

- `goldshore.ai` and `www.goldshore.ai` return 200 or a clean canonical redirect.
- `goldshore.org` and `www.goldshore.org` return 200 or a clean canonical redirect through `gs-web`.
- `api.goldshore.ai/health` resolves through `gs-api`, not `gs-gateway`.
- `gw.goldshore.ai/health` resolves through `gs-gateway`.
- `admin.goldshore.ai` requires Cloudflare Access or redirects to auth.

## D1 migration verification

```bash
wrangler d1 execute gs_platform_db --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
wrangler d1 execute gs_audit_db --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

Both databases should return table names, not an empty result.

## Known non-canonical paths

- `goldshore-org` standalone repo is legacy/non-canonical while `goldshore.org` is owned by `gs-web`.
- `rmarston.com` must stay outside `gs-web`; it belongs to `rmarston-com`.
- Any `goldshore-ai` stub Worker custom-domain binding should be removed once `gs-web` Pages owns `goldshore.ai`.
