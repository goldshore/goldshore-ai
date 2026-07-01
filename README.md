# Gold Shore AI — Repository Operations Map

```text
             /\
            /__\        GOLD SHORE LABS
           /\  /\       Applied intelligence · digital systems · consulting
          /__\/__\      Penrose direction: impossible geometry, real routes

          GS·LAB·v2.84  40°42′N · 074°00′W · goldshore.ai
```

This README is the root map for humans, agents, and future Codex sessions working in `marzton/goldshore-ai`.

It should explain what is true in the repository today: where domains are routed, where Cloudflare Workers live, what deploys them, where visual styles are sourced, and which static files can silently override Astro pages.

## First rule

Do not guess the runtime owner of a domain. Check these sources in order:

1. `apps/*/wrangler.toml`
2. `.github/workflows/*`
3. `infra/INFRASTRUCTURE.md`
4. Cloudflare DNS and Worker routes
5. Deployed `curl -I` / `curl -sL` evidence

Secrets, API tokens, dashboard credentials, R2 keys, Access JWTs, and OpenAI keys do **not** belong in this repository.

## System sketch

```text
                               GitHub Actions
                                    │
                                    ▼
                            Cloudflare Deploys
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
   gs-web-app                gs-www-redirect             service Workers
   Astro + Worker Assets     canonical www redirects     api / gateway / mail / ops
          │                         │                         │
          ▼                         ▼                         ▼
 goldshore.ai              www.goldshore.ai             api.goldshore.ai
 goldshore.org             www.goldshore.org            gw.goldshore.ai
                                                     agent.goldshore.ai
                                                     trading.goldshore.ai
                                                     mail.goldshore.ai
                                                     ops.goldshore.ai
                                                     mcp.goldshore.ai
```

## Production surface overview

| Surface | Source location | Runtime | Purpose |
| --- | --- | --- | --- |
| Public web app | `apps/gs-web` | Cloudflare Worker with Assets | Main Astro website for `goldshore.ai` and `goldshore.org` |
| WWW redirect | `apps/gs-www-redirect` | Cloudflare Worker | Canonical `www` redirect handling |
| Admin app | `apps/gs-admin` | Cloudflare Pages / Worker-adjacent app | Protected operator UI |
| API | `apps/gs-api` | Cloudflare Worker | Core API surface |
| Gateway | `apps/gs-gateway` | Cloudflare Worker | Gateway, agent ingress, bindings |
| Agent | `apps/gs-agent` | Route-free Worker behind gateway binding | Agent service implementation |
| Trading | `apps/gs-trading` | Cloudflare Worker | Trading / OAuth / paper trading surface |
| Mail | `apps/gs-mail` | Cloudflare Worker | Mail/event handling |
| Ops / control | `apps/gs-control` | Cloudflare Worker | Operator control plane |
| Shared packages | `packages/*` | Workspace packages | Shared auth, engine, brand, and theme code |
| Infrastructure docs | `infra/*`, `docs/*` | Documentation | Desired state, domain/auth notes, operational gates |
| GitHub Actions | `.github/workflows/*` | GitHub CI/CD | Build and deploy automation |

## Canonical domain ownership

Current verified target model:

```text
goldshore.ai                 -> gs-web-app
goldshore.org                -> gs-web-app
www.goldshore.ai             -> gs-www-redirect-prod -> goldshore.ai
www.goldshore.org            -> gs-www-redirect-prod -> goldshore.ai

preview.goldshore.ai         -> gs-web preview / preview route as configured
admin.goldshore.ai           -> gs-admin / protected operator UI
admin-preview.goldshore.ai   -> gs-admin preview
api.goldshore.ai             -> gs-api
api-preview.goldshore.ai     -> gs-api preview
gw.goldshore.ai              -> gs-gateway-prod
agent.goldshore.ai           -> gs-gateway-prod service binding to gs-agent
mcp.goldshore.ai             -> gs-mcp / MCP surface
trading.goldshore.ai         -> gs-trading-prod
mail.goldshore.ai            -> gs-mail
ops.goldshore.ai             -> gs-control
dashboard.goldshore.ai       -> intended dashboard/admin redirect surface
```

When this table disagrees with live Cloudflare, Cloudflare is the current truth and the repo is drifted. Fix the repo after confirming live state.

## Cloudflare Worker apps

### `apps/gs-web`

Primary Astro web app deployed as a Cloudflare Worker with Assets.

Important files:

- `apps/gs-web/src/pages/index.astro` — current homepage source.
- `apps/gs-web/src/styles/home-theme.css` — current GS LAB homepage visual system.
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
Expected production deploy command:

```bash
pnpm --filter @goldshore/gs-web build
pnpm --filter @goldshore/gs-web exec wrangler deploy --env prod
```

The production environment is `env.prod`. Do not accidentally deploy a route-free or differently named environment and then assume the public route changed.

### `apps/gs-www-redirect`

Small redirect Worker for canonical `www` traffic.

Important files:

- `apps/gs-www-redirect/src/index.ts`
- `apps/gs-www-redirect/wrangler.toml`
- `.github/workflows/deploy-gs-www-redirect.yml`

Expected behavior:

```text
www.goldshore.ai   -> https://goldshore.ai/
www.goldshore.org  -> https://goldshore.ai/   after explicit route/custom-domain binding
```

## Bindings and runtime resources

Check bindings in each app's `wrangler.toml`, not from memory.

Typical resources in this repo include:

```text
KV     -> namespace bindings for app/cache/control state
D1     -> gs_platform_db, gs_audit_db, gs_signals_db, gs_jobs_db, trading DBs
R2     -> gs-assets, gs-assets-preview, telemetry/user upload buckets
DO     -> AuthSession and app-specific Durable Objects where configured
Queues -> app-specific event and signal processing queues where configured
```

Do not rename a binding casually. Application code expects exact binding names.

## Homepage visual identity

The preferred homepage direction is the GS LAB / Applied Intelligence page:

```text
GS·LAB·v2.84
Gold Shore Labs
Where
Strategy
Operates.
Applied intelligence for institutions that need clarity under pressure.
```

The homepage currently owns a standalone visual system:

```text
apps/gs-web/src/pages/index.astro
apps/gs-web/src/styles/home-theme.css
```

This is where the orange/gold and white hero typography, coordinates mark, GS LAB panel language, telemetry cards, marquee, cursor orb, reveal animations, magnetic CTA behavior, and Risk Radar / Financial Signals previews live.

## Penrose / brand asset direction

The historical brand direction includes Penrose-style impossible geometry. Repository history includes references such as:

```text
public/logo/gs-penrose.svg
public/assets/ui/penrose.svg
packages/theme/README.md
packages/theme/src/assets.js
docs/brand-asset-plan.md
```

Planning guidance found in repo history says the canonical brand asset source should be `packages/theme/assets`, with web consuming the asset by URL and admin preferring inline SVG for styling control.

That does **not** mean every current page already consumes the package correctly. Treat this as the intended migration direction until verified in current files.

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

Before every web deploy, run or confirm equivalent checks:

```bash
find apps/gs-web/public -type f | sort
gh run view <run-id> --log | grep -Ei 'Skipping src/pages|public folder|index.html'
```

## Recommended UI architecture

Create a shared shell for all public pages:

```text
apps/gs-web/src/layouts/GoldShoreShell.astro
apps/gs-web/src/styles/gs-shell.css
apps/gs-web/src/scripts/gs-shell.ts
apps/gs-web/src/config/navigation.ts
```

Move shared UI into that shell:

- coordinates header
- brand mark
- primary nav
- Access menu or modal
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
- cursor/starfield behavior
- consistent CTA link handling

Then migrate subpages from `WebLayout.astro` to `GoldShoreShell.astro` gradually. Do not rewrite every content page in one uncontrolled commit.

## Deployment commands

### Deploy `gs-web`

```bash
gh workflow run deploy-gs-web.yml --ref main
WEB=$(gh run list --workflow "Deploy gs-web" --branch main --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$WEB"
```

### Deploy `gs-www-redirect`

```bash
gh workflow run deploy-gs-www-redirect.yml --ref main
WWW=$(gh run list --workflow "Deploy gs-www-redirect" --branch main --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$WWW"
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
Content verification:

```bash
curl -sL "https://goldshore.ai/?v=$(date +%s)" \
  | grep -Ei 'Applied Intelligence|Where|Strategy|GS·LAB|Gold Shore Labs' \
  | head -40
```

If `curl` returns a Cloudflare challenge page, that is not proof the site is blank. Check from a browser session and check Cloudflare security rules separately.

## Agent handoff notes

When taking over this repository:

1. Read this README.
2. Check `git status --short`.
3. Check open PRs and active branches.
4. Check `apps/gs-web/public` for route collisions.
5. Check whether the homepage is generated from Astro or overridden by `public/index.html`.
6. Check whether subpages still import `WebLayout.astro`.
7. Check Cloudflare route ownership before changing DNS or Worker routes.
8. Never commit secrets.

## Merge safety checklist

Before merging UI or routing changes:

- [ ] `apps/gs-web/public/index.html` does not override `src/pages/index.astro`.
- [ ] Build logs show no unexpected `Skipping src/pages/... because public folder...` warnings.
- [ ] `deploy-gs-web.yml` deploys the routed production environment.
- [ ] `goldshore.ai` returns `HTTP/2 200`.
- [ ] `goldshore.org` returns expected canonical behavior.
- [ ] `www.goldshore.ai` redirects to canonical apex.
- [ ] `www.goldshore.org` redirects to canonical apex.
- [ ] Homepage content contains `Applied Intelligence`, `Where`, `Strategy`, and `GS·LAB`.
- [ ] Subpage layout migration is deliberate and not an accidental partial theme mix.
- [ ] Access-protected surfaces remain protected.
