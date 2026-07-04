# CLAUDE.md — goldshore-ai

> Updated: 2026-07-03 · Active branch: `claude/risk-radar-fra-epo-2wk5mk`

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

pnpm 9 + Turborepo. All apps in `apps/*`, shared code in `packages/*`.

### Apps

**Per AGENTS.md:** this repo is a two-app monorepo. New frontend work → `apps/gs-web`; new backend work → `apps/gs-api`. All other apps are legacy stubs retained for workspace validation only — do not route new tasks there.

| App | Worker name | Routes | Status |
|-----|-------------|--------|--------|
| `apps/gs-web` | `gs-web` | `goldshore.ai/*` | ✅ Astro + Cloudflare Workers |
| `apps/gs-api` | `gs-api` | `api.goldshore.ai/*` | ✅ Active |
| `apps/gs-admin` | `gs-admin` | `admin.goldshore.ai/*` | ⚠️ Legacy — do not route new work here |
| `apps/gs-mcp` | `gs-mcp` | `mcp.goldshore.ai/*` | ⚠️ Legacy — do not route new work here |
| `apps/gs-gateway` | `gs-platform` | `gw/gateway/ops/agent/api.goldshore.ai/*` | ⚠️ STUB — real code in `marzton/goldshore-gateway` |
| `apps/gs-cron` | `gs-cron` | (scheduled) | ⚠️ Legacy — do not route new work here |
| `apps/gs-signals` | `gs-signals` | internal | ⚠️ Legacy — do not route new work here |

The gateway stub at `apps/gs-gateway/wrangler.toml` is intentional — it satisfies workspace validation without owning deployment.

### Shared packages

`packages/ui`, `packages/theme`, `packages/auth`, `packages/config`, `packages/schema`, `packages/analytics`, `packages/assets`, `packages/utils`

---

## AI IDE context: Antigravity + VS Code

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
| `marzton/goldshore-admin` | `admin.goldshore.org` (Pages) | Older admin, being superseded by `apps/gs-admin` |
| `marzton/goldshore-core` → `apps/banproof-me` | `banproof-me` worker | Security/ban-check; called by gateway on every request. Built with Antigravity + Codex. |

---

## Key Cloudflare bindings (gs-admin)

- KV: `GS_CONFIG` (`d02c0c7951a244a7987e23d8af16b7b2`), `KV_SESSIONS`
- D1: `PLATFORM_DB` (`9703574e-adb7-481e-8d98-96f8ce5f8a90`), `GS_AUDIT_DB` (`1ae71d76-188f-481b-91d9-db2d39013f68`)
- R2: `GS_ASSETS`
- Services: `gs-trading-prod`, `gs-control`, `gs-api`

---

## Active branch: `claude/risk-radar-fra-epo-2wk5mk`

What's on this branch:
- `apps/gs-web/src/pages/index.astro` — nav links → real page routes, access modal (`<dialog>`), hamburger nav toggle, contact form fix
- `apps/gs-web/src/styles/home-theme.css` — mobile nav, modal, honeypot CSS
- `.github/workflows/manage-cf-tokens.yml` — dual Cloudflare auth (Bearer token + Global API Key), verify step

---

## CI / deployment

- GitHub Actions: Lighthouse CI threshold `LH_MIN_PERFORMANCE: 0.60`
- Deploy token: `CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN` GitHub secret (renew via `manage-cf-tokens.yml` if expired)
- Workers deploy per-app via `wrangler deploy`

---

## Common commands

```bash
pnpm install
pnpm build
pnpm --filter gs-web dev
pnpm --filter gs-admin dev
pnpm turbo run build --filter=gs-web
```

---

## Repo migration plan

| Priority | Repo | Action |
|----------|------|--------|
| 1 | `goldshore-ops` | Archive — KV template stub, never built |
| 2 | `goldshore-web` | Already deprecated — remove from CI |
| 3 | `goldshore-core` | Migrate `banproof-me` → `apps/gs-security`; archive rest |
| 4 | `goldshore-api` | Confirm `goldshore/apps/goldshore-api` at parity → archive standalone |
| 5 | `goldshore-admin` | Confirm `apps/gs-admin` at parity → archive standalone |
| 6 | `goldshore-gateway` | Replace stub with real gateway code → archive standalone |

---

## Sister monorepo: `marzton/goldshore`

Owns the `.org` domain. Apps: `goldshore-agent` (gs-agent), `goldshore-api`, `goldshore-mcp`, `goldshore-web`. Packages include brokerage integrations: `broker-fidelity`, `broker-robinhood`, `broker-tos` (thinkorswim/Schwab), plus `execution`, `rules`, `research`.
