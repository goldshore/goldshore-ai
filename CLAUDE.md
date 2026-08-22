# CLAUDE.md — goldshore-ai

> Updated: 2026-08-14 · Active branch: `claude/mcp-gs-api-worker-migration-0g51br`

## Platform overview

Goldshore is a financial data intelligence and automated trading platform by Gold Shore Labs. Stack is 100% Cloudflare-native: Workers for compute, D1 for SQL, KV for config/sessions, R2 for assets, Queues for background jobs.

Two product domains — each with its own canonical monorepo:

| Domain | Monorepo | Purpose |
|--------|----------|---------|
| `goldshore.ai` | **this repo** (`goldshore-ai`) | Commercial AI product, platform app, admin, API |
| `goldshore.org` | `marzton/goldshore` | Data intelligence / research arm |

---

## Developer device map

| Device | OS | Terminal | SSH key label | Notes |
|--------|-----|----------|--------------|-------|
| Android phone | Android (Termux) | bash/zsh | `goldshore-termux` | ✅ key on GitHub |
| HP Laptop | Windows/Linux | VS Code terminal + Antigravity IDE | `goldshore-hp` | Run `scripts/setup-device.sh` |
| iPad Pro | iOS | Blink Shell / iSH / a-Shell | `goldshore-ipad` | See iPad SSH setup below |

### iPad Pro SSH key setup

**Blink Shell** (recommended — most capable iOS terminal):
```
config → Keys → + → Create new ED25519 key → name: goldshore-ipad
config → Keys → goldshore-ipad → Copy to Clipboard
```
Paste into github.com → Settings → SSH keys → New SSH key.

**iSH** (Alpine Linux):
```sh
apk add openssh
ssh-keygen -t ed25519 -C "goldshore-ipad"
cat ~/.ssh/id_ed25519.pub  # copy → GitHub SSH keys
```

**a-Shell**:
```sh
ssh-keygen -t ed25519 -C "goldshore-ipad"
cat .ssh/id_ed25519.pub
```

After adding key to GitHub, test with: `ssh -T git@github.com`

---

## Monorepo structure

pnpm 9 + Turborepo. This repository intentionally exposes only the two canonical apps below plus shared code in `packages/*`.

### Apps

**Per AGENTS.md:** this repo is a strict two-app monorepo. New frontend work → `apps/gs-web`; new backend work, including routing, cron jobs, DB operations, AI logic, queues, email receivers, and proxy code → `apps/gs-api`. Do not route any work to unsupported legacy app names such as `gs-admin`, `gs-mcp`, `gs-gateway`, `gs-cron`, or `gs-signals` in this repository.

| App | Worker name | Routes | Status |
|-----|-------------|--------|--------|
| `apps/gs-web` | `gs-web` | `goldshore.ai/*` | ✅ Canonical Astro frontend |
| `apps/gs-api` | `gs-api` | `api.goldshore.ai/*` | ✅ Canonical unified API Worker |

If a task appears to require a separate admin, gateway, MCP, cron, mail, signals, or agent worker, implement it as a sub-route, handler, queue consumer, or scheduled flow inside `apps/gs-api`, or as a page/sub-route inside `apps/gs-web`.

### Shared packages

`packages/ui`, `packages/theme`, `packages/auth`, `packages/config`, `packages/schema`, `packages/analytics`, `packages/assets`, `packages/utils`

---

## AI IDE context: Antigravity + VS Code

### Shared GitHub handoffs

Claude and Codex coordinate through GitHub issues rather than private local context. Use the same issue tags defined in `AGENTS.md`: `[agent:claude]`, `[agent:codex]`, `[env:local]`, `[env:preview]`, `[env:production]`, `[status:ready]`, `[status:blocked]`, and `[handoff:needed]`. Every handoff comment must include the remote branch and commit SHA, completed checks, deployment/run URLs, blockers, and the next owner/action.

**Antigravity** is the primary IDE used to build parts of goldshore and banproof-me. It is a Google IDE with multiple AI agents pre-integrated: Gemini, Codex, Claude, Copilot, and others. Think of it as VS Code with a built-in multi-agent AI layer.

When working in Antigravity or VS Code on this codebase:
- Root workspace file: `goldshore.code-workspace` (opens all apps + packages as a single workspace)
- TypeScript project references are per-app — each `apps/*` has its own `tsconfig.json`
- pnpm is the package manager — do NOT use npm or yarn at the monorepo root
- Wrangler (`wrangler dev`) is the local dev server for each Worker app
- Astro dev (`pnpm --filter gs-web dev`) for the marketing site

Agents that have worked on this codebase: Claude Code (primary), Codex (wrangler config, banproof), Copilot (inline), Gemini (Antigravity sessions).

---

## Google Business / API integrations

Gold Shore Labs has Google Business Admin configured. Active or planned API integrations:

| API | Purpose | Status |
|-----|---------|--------|
| Google Ads API | Ad campaign management + monetization | Enabling |
| AdSense API | Revenue / publisher monetization | Enabling |
| Google Analytics Data API | Traffic + conversion tracking | Planned |
| Google My Business API | Business profile management | Active |
| Google Cloud APIs | Auth, storage, AI (Vertex) | As needed |

OAuth credentials and service account keys live in Google Cloud Console → goldshore project. Never commit these to git. Store as Cloudflare Worker secrets or GitHub Actions secrets.

For Claude/Codex assistance with Google API integration: provide the API name, scope, and what endpoint you're trying to hit — agents can write the OAuth flow, the Worker proxy, and the API client code.

---

## Standalone repos still running production code

| Repo | Deploys | Notes |
|------|---------|-------|
| `marzton/goldshore-gateway` | `gs-platform` worker | Platform front door; routes all subdomain traffic |
| `marzton/goldshore-admin` | `admin.goldshore.org` (Pages) | Older admin; any replacement UI belongs under `apps/gs-web` sub-routes |
| `marzton/goldshore-core` | `banproof-me` worker | Security/ban-check; future integration must route through `apps/gs-api` queues/routes (or stay external) and must not create `apps/gs-security`. |

---

## Key Cloudflare bindings (gs-api)

`apps/gs-api/wrangler.toml` is the canonical config for `gs-api` bindings. Cross-check any future binding edits against the registry in [`infra/Cloudflare/BINDINGS_MAP.md`](infra/Cloudflare/BINDINGS_MAP.md) before changing this summary.

- Environment names: `prod` and `preview`. `production` is a historical alias and should not be used in `apps/gs-api/wrangler.toml` or package scripts.
- KV: `KV` (`e0b8b807191346c3b0afc25fe716d2cd` in `prod`; `d4d20cee39094b999dea3f7e5f4c533a` in `preview`), `CONTROL_LOGS` (`a52e94cb331c4e3db08f2aa507e6df09` in `prod`; `09e43cb8bd4749fdaaed0dc9d4ff2284` in `preview`), and `RISK_RADAR_CACHE`. Legacy historical aliases only: `GS_CONFIG`, `KV_SESSIONS`.
- D1: `PLATFORM_DB` (`9703574e-adb7-481e-8d98-96f8ce5f8a90`), `AUDIT_DB` (`1ae71d76-188f-481b-91d9-db2d39013f68`), `SIGNALS_DB` (`76af4653-7f44-417b-b46e-250143d906fd`), `RISK_RADAR_DB`, and `JOBS_DB` (`750c469c-788d-49e8-9254-77231cffd70f`). Legacy historical aliases only: `DB` and `GS_AUDIT_DB`.
- R2: `GS_ASSETS` (`gs-assets` in `prod`; `gs-assets-preview` in `preview`), `TELEMETRY` (`gs-telemetry-storage`), and `RISK_RADAR_R2`.
- AI and Durable Objects: `AI`; `AUTH_SESSION` (`AuthSession`).
- Queues: `JOBS_QUEUE` (`goldshore-jobs`), `EVENTS_QUEUE` (`gs-events`), `MAIL_JOBS_QUEUE` (`gs-mail-jobs`), `DEAD_LETTER_QUEUE` (`gs-mail-dead-letter`). `gs-api` also consumes the consolidated backend queues in `prod`.
- Workflows: `GS_SIGNALS` → `signals-evaluator`.
- Secrets Store: `INTEGRATION_MASTER_KEY` is bound as a per-secret Secrets Store binding from store `b9824d3280c54573a24137c7e7143b33`. Do not use the historical `SECRETS.get(...)` store-object shape in Wrangler config.
- Unclear/live Cloudflare note: if the dashboard still shows legacy service bindings such as `AGENT`, `GS_MAIL`, `GS_WEB PROD`, `API_SERVICE`, or `GOLDSHORE_AI`, treat them as stale until a human confirms a live dependency; do not re-add them to repo-managed `gs-api` config without updating this file and `docs/WORKER_CONFIGURATION.md`.

> **`KV` means a different namespace in each app.** In `gs-api` the `KV` binding
> resolves to `GS_API_KV` (`e0b8b807…`); in `gs-web` it resolves to
> `GOLDSHORE-AI` (`5f133705…`). The binding name is identical, the store is not.
> Any key that both apps need — `PRODUCT_CATALOG` is the one that got this wrong —
> must have exactly one owning app, with the other reaching it over HTTP. Reading
> or writing the same key from `env.KV` in both apps forks it into two stores that
> diverge silently, with no error at build or deploy time.

---

## Active branch: `claude/mcp-gs-api-worker-migration-0g51br`

### Initiative: Enterprise Admin Platform Build-Out

**Objective**: Build comprehensive admin dashboard with 30+ features for operations, automation, and infrastructure management.

**Phase 1 (Current Sprint — In Progress)**:
- ✅ App-level CF Access auth verified (middleware.ts, api-proxy.ts, gs-api handlers all correct)
- ⚠️ Edge-level CF Access Application for admin.goldshore.ai **pending manual dashboard configuration** (see `docs/ADMIN_DASHBOARD_FIX.md`)
- ✅ Database schema: `github_webhooks` table created for AUDIT_DB (migration: `0002_github_webhooks.sql`)
- ✅ D1 migration automation: GitHub Actions workflow for applying remote D1 migrations (`apply-d1-migration.yml`)
- ✅ Admin dashboard diagnostics: Root cause analysis of ~13 failing admin pages documented (CF Access Application missing at edge)
- 🔄 Core admin infrastructure:
  - Email management (queue, logs, templates)
  - Worker management (bindings, routes, secrets UI)
  - Contact forms & leads CRUD (entries display, pagination)
  - User sign-up management
  - Settings panel
  - API routes: `/api/admin/{email,workers,entries,users,settings}/*`
  - Frontend pages: `/admin/{dashboard,email,workers,entries,users,settings}`

**Secondary issues identified (separate investigation)**:
- API Workflows: `/api/admin/workflows` endpoint missing from gs-api (404)
- Repo Health: Client fetches HTML instead of JSON response
- Lead Submissions: goldshore.ai returns 522; missing error boundary
- Dashboard: Stricter CF Access policy required (separate from main admin auth)

**Phase 2 (Week 2)**: WYSIWYG editors, secret creator, API key rotator, permission updater

**Phase 3 (Week 3)**: Workflows (leads generator, list scraper, data collector, email sender, CF Tunnel manager)

**Phase 4 (Week 4+)**: Enterprise features (PR manager, AI search, ad integrator, site builder, plugin installer, SQL sync, mailbox management)

**Tech Stack**:
- Backend: Hono (gs-api)
- Frontend: Astro + React (gs-web)
- Storage: D1 (schema), KV (cache), R2 (uploads)
- Auth: Cloudflare Access + session tokens

**Next**: Manual Cloudflare dashboard action required — create CF Access Application for `admin.goldshore.ai` subdomain (documented in `docs/ADMIN_DASHBOARD_FIX.md`)

---

## CI / deployment

- GitHub Actions: Lighthouse CI threshold `LH_MIN_PERFORMANCE: 0.60`
- GitHub Actions deploy token: `CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN`
- Cloudflare Worker Builds token: `CLOUDFLARE_BUILD_API_TOKEN` (managed separately)
- Workers deploy only through `.github/workflows/deploy-gs-web.yml` and `.github/workflows/deploy-gs-api.yml`, behind the GitHub `production` environment approval gate. Local Wrangler use is dry-run validation only.

---

## Common commands

```bash
pnpm install
pnpm build
pnpm --filter gs-web dev
pnpm --filter gs-api dev
pnpm turbo run build --filter=gs-web
```

---

## Repo migration plan

| Priority | Repo | Action |
|----------|------|--------|
| 1 | `goldshore-ops` | Archive — KV template stub, never built |
| 2 | `goldshore-web` | Already deprecated — remove from CI |
| 3 | `goldshore-core` | Route `banproof-me` security logic into `apps/gs-api` queues/routes (or keep it external); do **not** create `apps/gs-security` or any other new Worker under `apps/`; archive standalone |
| 4 | `goldshore-api` | Confirm `goldshore/apps/goldshore-api` at parity → archive standalone |
| 5 | `goldshore-admin` | Move replacement admin UX into `apps/gs-web` sub-routes, then archive standalone |
| 6 | `goldshore-gateway` | Route gateway responsibilities through `apps/gs-api`, then archive standalone |

---

## Sister monorepo: `marzton/goldshore`

Owns the `.org` domain. Apps: `goldshore-agent` (gs-agent), `goldshore-api`, `goldshore-mcp`, `goldshore-web`. Packages include brokerage integrations: `broker-fidelity`, `broker-robinhood`, `broker-tos` (thinkorswim/Schwab), plus `execution`, `rules`, `research`.
