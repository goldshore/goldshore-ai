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

## Monorepo structure

pnpm 9 + Turborepo. All apps in `apps/*`, shared code in `packages/*`.

### Apps

| App | Worker name | Routes | Status |
|-----|-------------|--------|--------|
| `apps/gs-web` | `gs-web` | `goldshore.ai/*` | ✅ Astro + Cloudflare Workers |
| `apps/gs-api` | `gs-api` | `api.goldshore.ai/*` | ✅ Active |
| `apps/gs-admin` | `gs-admin` | `admin.goldshore.ai/*` | ✅ Full KV/D1/R2/service bindings |
| `apps/gs-mcp` | `gs-mcp` | `mcp.goldshore.ai/*` | ✅ Model Context Protocol server |
| `apps/gs-gateway` | `gs-platform` | `gw/gateway/ops/agent/api.goldshore.ai/*` | ⚠️ **STUB** — real code in `marzton/goldshore-gateway` |
| `apps/gs-cron` | `gs-cron` | (scheduled) | ✅ Active |
| `apps/gs-signals` | `gs-signals` | internal | ✅ Active |

The gateway stub at `apps/gs-gateway/wrangler.toml` is intentional — it satisfies workspace validation and `scripts/validate-worker-names.ts` without owning deployment. Keep it.

### Shared packages

`packages/ui`, `packages/theme`, `packages/auth`, `packages/config`, `packages/schema`, `packages/analytics`, `packages/assets`, `packages/utils`

---

## Standalone repos still running production code

These are **not** stubs — they deploy real workers outside this monorepo:

| Repo | Deploys | Notes |
|------|---------|-------|
| `marzton/goldshore-gateway` | `gs-platform` worker | Platform front door; routes all subdomain traffic |
| `marzton/goldshore-admin` | `admin.goldshore.org` (Pages) | Older admin, being superseded by `apps/gs-admin` |
| `marzton/goldshore-core` → `apps/banproof-me` | `banproof-me` worker | Security/ban-check layer; gateway calls it on every request |

---

## Key Cloudflare bindings

### gs-admin
- KV: `GS_CONFIG` (`d02c0c7951a244a7987e23d8af16b7b2`), `KV_SESSIONS`
- D1: `PLATFORM_DB` (`9703574e-adb7-481e-8d98-96f8ce5f8a90`), `GS_AUDIT_DB` (`1ae71d76-188f-481b-91d9-db2d39013f68`)
- R2: `GS_ASSETS`
- Services: `gs-trading-prod`, `gs-control`, `gs-api`

---

## Active branch: `claude/risk-radar-fra-epo-2wk5mk`

What's on this branch:
- `apps/gs-web/src/pages/index.astro` — nav links → real page routes, access modal (`<dialog>`), hamburger nav toggle, contact form fields + JS
- `apps/gs-web/src/styles/home-theme.css` — mobile nav, modal, honeypot CSS
- `.github/workflows/manage-cf-tokens.yml` — dual Cloudflare auth (Bearer token + Global API Key), verify step

---

## CI / deployment

- GitHub Actions: Lighthouse CI threshold `LH_MIN_PERFORMANCE: 0.60`
- Deploy token: `CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN` GitHub secret (renew via `manage-cf-tokens.yml` workflow if expired)
- Workers deploy per-app via `wrangler deploy`

### Renewing the Cloudflare deploy token

Run the `manage-cf-tokens` workflow dispatch with:
- `action: create`
- `token_name: goldshore-ai-deploy`
- `cf_auth_email`: your Cloudflare account email
- `cf_auth_key`: your Global API Key (Cloudflare dashboard → My Profile → API Tokens → Global API Key)

Copy the printed `Value:` → update the `CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN` secret.

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

Goal: all production code inside monorepo apps, standalone repos archived.

| Priority | Repo | Action |
|----------|------|---------|
| 1 | `goldshore-ops` | Archive — KV template stub, never built out |
| 2 | `goldshore-web` | Already deprecated/archived — remove from CI |
| 3 | `goldshore-core` | Migrate `banproof-me` → `apps/gs-security`; archive rest |
| 4 | `goldshore-api` | Confirm `goldshore/apps/goldshore-api` at parity → archive standalone |
| 5 | `goldshore-admin` | Confirm `apps/gs-admin` at parity → archive standalone |
| 6 | `goldshore-gateway` | Replace stub with real gateway code → archive standalone |

---

## Sister monorepo: `marzton/goldshore`

Owns the `.org` domain. Apps: `goldshore-agent` (gs-agent worker), `goldshore-api`, `goldshore-mcp`, `goldshore-web`. Packages include brokerage integrations: `broker-fidelity`, `broker-robinhood`, `broker-tos` (thinkorswim/Schwab), plus `execution`, `rules`, `research`.

Do not develop `.ai` features in that repo — keep the domain boundary clean.
