# Gold Shore AI — Repository Operations Map

This repository contains the Gold Shore public web surface, Cloudflare Workers, routing configuration, and shared packages that support the Gold Shore web domains and operational subdomains.

## Purpose

This README is the repository-level map for humans and agents. Use it to find where domains, DNS, Workers, Pages-style assets, bindings, deploy workflows, layouts, styles, scripts, and public-route collision risks live.

## Production surface overview

| Surface | Source location | Runtime | Purpose |
| --- | --- | --- | --- |
| Public web app | `apps/gs-web` | Cloudflare Worker with Assets | Main Astro website |
| WWW redirect | `apps/gs-www-redirect` | Cloudflare Worker | Canonical `www` redirect handling |
| Shared packages | `packages/*` | Workspace packages | Shared code used by apps |
| GitHub Actions | `.github/workflows/*` | GitHub CI/CD | Build and deploy automation |

## Cloudflare Worker apps

### `apps/gs-web`

Primary Astro web app deployed as a Cloudflare Worker with Assets.

Important files:

- `apps/gs-web/src/pages/index.astro` — current homepage source.
- `apps/gs-web/src/styles/home-theme.css` — homepage GS LAB visual system.
- `apps/gs-web/src/layouts/WebLayout.astro` — current subpage layout.
- `apps/gs-web/src/styles/global.css` — current subpage/global style stack.
- `apps/gs-web/public/_headers` — static route security headers.
- `apps/gs-web/public/_routes.json` — static routing hints.
- `apps/gs-web/wrangler.toml` — Worker name, routes, KV, D1, R2, and environment variables.
- `.github/workflows/deploy-gs-web.yml` — production deploy workflow.

The production Worker route configuration is stored in `apps/gs-web/wrangler.toml` under the production environment.

Bindings to check in `wrangler.toml`:

- Worker assets binding.
- KV namespace binding.
- D1 database binding.
- R2 bucket binding.
- Environment variables.

Secrets must never be committed. Keep tokens, API keys, R2 credentials, dashboard secrets, and OpenAI keys only in Cloudflare secrets, GitHub Actions secrets, or the appropriate platform secret manager.

### `apps/gs-www-redirect`

Small redirect Worker for canonical `www` traffic.

Important files:

- `apps/gs-www-redirect/src/index.ts`
- `apps/gs-www-redirect/wrangler.toml`
- `.github/workflows/deploy-gs-www-redirect.yml`

Expected behavior:

```text
www primary domain   -> canonical apex domain
www secondary domain -> canonical apex domain
```

## GitHub Actions deployment

### Deploy `gs-web`

Workflow:

```text
.github/workflows/deploy-gs-web.yml
```

Manual deploy:

```bash
gh workflow run deploy-gs-web.yml --ref main
WEB=$(gh run list --workflow "Deploy gs-web" --branch main --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$WEB"
```

### Deploy `gs-www-redirect`

Workflow:

```text
.github/workflows/deploy-gs-www-redirect.yml
```

Manual deploy:

```bash
gh workflow run deploy-gs-www-redirect.yml --ref main
WWW=$(gh run list --workflow "Deploy gs-www-redirect" --branch main --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$WWW"
```

## Homepage vs subpage styling

The homepage and subpages currently use different layout systems.

### Homepage system

The homepage is a standalone Astro document:

```text
apps/gs-web/src/pages/index.astro
```

It imports:

```astro
import '../styles/home-theme.css';
```

This file owns the current GS LAB homepage experience:

- coordinates header
- GS LAB brand mark
- Applied Intelligence homepage hero
- homepage cards and telemetry
- marquee
- Risk Radar preview
- financial signals preview
- contact form
- homepage-specific CSS and JavaScript behavior

### Subpage system

Most subpages use `WebLayout.astro`.

Examples:

```astro
import WebLayout from '../layouts/WebLayout.astro';
```

or:

```astro
import WebLayout from '../../layouts/WebLayout.astro';
```

`WebLayout.astro` imports:

```astro
import '../styles/global.css';
```

This means subpages do not automatically inherit the homepage stylesheet, homepage nav, homepage footer, modals, starfield/cursor effects, or homepage interaction JavaScript.

Known areas to inspect:

- `apps/gs-web/src/pages/risk-radar.astro`
- `apps/gs-web/src/pages/platform/*.astro`
- `apps/gs-web/src/pages/services/*.astro`
- `apps/gs-web/src/layouts/BaseLayout.astro`
- `apps/gs-web/src/layouts/DocsLayout.astro`
- `apps/gs-web/src/layouts/MarketingLayout.astro`

## Static public-file override warning

Astro will skip a source page when a file with the same output path exists in `public/`.

Collision patterns to avoid:

```text
apps/gs-web/public/index.html
apps/gs-web/public/apps/risk-radar/index.html
```

These can override Astro routes and cause the deployed site to serve stale static HTML instead of current Astro pages.

Archive old static files under a non-colliding location such as:

```text
apps/gs-web/public/_archived-static/
```

## Recommended UI architecture

Create a shared shell for all public pages:

```text
apps/gs-web/src/layouts/GoldShoreShell.astro
apps/gs-web/src/styles/gs-shell.css
apps/gs-web/src/scripts/gs-shell.js
```

Move shared UI into that shell:

- coordinates header
- brand mark
- primary nav
- Access modal
- Request Briefing CTA
- shared footer
- reveal animation
- magnetic hover
- starfield or cursor behavior
- modal open and close behavior

Then migrate subpages from `WebLayout` to `GoldShoreShell` gradually.

Recommended first migration target:

```text
apps/gs-web/src/pages/risk-radar.astro
```

## Audit commands

Find subpages still using the old layout:

```bash
grep -R "import WebLayout" -n apps/gs-web/src/pages apps/gs-web/src/layouts
```

Find public files that may override Astro routes:

```bash
find apps/gs-web/public -type f | sort
```

Check build logs for route collisions:

```bash
gh run view <RUN_ID> --log | grep -Ei 'Skipping src/pages|public folder|index.html|risk-radar'
```

Compare homepage and subpage imports:

```bash
grep -nE "import .*css|import .*Layout|WebLayout|home-theme" \
  apps/gs-web/src/pages/index.astro \
  apps/gs-web/src/pages/risk-radar.astro \
  apps/gs-web/src/layouts/WebLayout.astro
```

## Live verification commands

```bash
for u in \
  https://goldshore.ai/ \
  https://goldshore.org/ \
  https://www.goldshore.ai/ \
  https://www.goldshore.org/ \
  https://goldshore.ai/developer/mcp/
do
  echo "$u"
  curl -I -A "Mozilla/5.0 GoldShoreAudit" "$u" | grep -Ei 'HTTP/|location:|server:|cf-ray|content-type'
  echo
done
```

## OpenAI Platform guidance

No browser page should expose an OpenAI API key.

If AI Oracle, MCP, admin, dashboard, or other features call OpenAI-backed systems, route those calls through server-side Workers or API endpoints and store secrets only in:

- Cloudflare Worker secrets.
- GitHub Actions secrets.
- OpenAI Platform key management.

Never commit API tokens, R2 access keys, dashboard/admin secrets, or OpenAI keys.

## Immediate next PRs

1. Add a CI guard for public/Astro route collisions.
2. Create `GoldShoreShell.astro` from the homepage shell.
3. Move shared homepage effects into `gs-shell.css` and `gs-shell.js`.
4. Migrate `risk-radar.astro` to `GoldShoreShell`.
5. Normalize admin, dashboard, API, MCP, and core link targets.
6. Review CSP for static routes and modal/API behavior.
