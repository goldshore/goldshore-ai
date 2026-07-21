# Worker Configuration Guide

This document describes the Cloudflare configuration for the GoldShore two-app monorepo.

## Source of truth

- Canonical binding registry: `infra/Cloudflare/BINDINGS_MAP.md`.
- Queue matrix: `docs/ops/queue-contract-matrix.md`.
- Runtime apps: `apps/gs-api` and `apps/gs-web` only.

Do not add new app workers or deploy workflows for retired services. All backend, cron, queue, auth, data, and AI logic belongs in `apps/gs-api`; all frontend routes and visual code belongs in `apps/gs-web`.

## `gs-api` (`apps/gs-api`)

- **Wrangler:** `apps/gs-api/wrangler.toml`
- **Production routes:** `api.goldshore.ai/*`, `api.goldshore.org/*`, plus consolidated backend hostnames `agent.goldshore.ai/*`, `mail.goldshore.ai/*`, `ops.goldshore.ai/*`, `trading.goldshore.ai/*`, `dashboard.goldshore.ai/*`, and `dash.goldshore.ai/*`
- **Preview:** `workers_dev = true`; preview API route `api-preview.goldshore.ai/*`
- **Canonical bindings:**
  - KV: `KV`, `CONTROL_LOGS`, `RISK_RADAR_CACHE`
  - D1: `PLATFORM_DB`, `AUDIT_DB`, `SIGNALS_DB`, `RISK_RADAR_DB`, `JOBS_DB`
  - R2: `GS_ASSETS`, `TELEMETRY`, `RISK_RADAR_R2`
  - AI: `AI`
  - Durable Object: `AUTH_SESSION`
  - Queues produced: `JOBS_QUEUE`, `EVENTS_QUEUE`, `MAIL_JOBS_QUEUE`, `DEAD_LETTER_QUEUE`; production queue consumers are not declared by `gs-api` while live Cloudflare routes `goldshore-jobs`/`gs-events` to `gs-mail` and `gs-mail-jobs` to an HTTP pull consumer
  - Worker secret: `INTEGRATION_MASTER_KEY` (provision with `wrangler secret put`; do not use a Secrets Store binding unless the store and secret already exist)
- **Retired aliases/service bindings:** `DB`, `ASSETS`, `TELEMETRY_DB`, `SECRETS`, `AGENT`, `GS_MAIL`, `GS_WEB`, `GS_WEB PROD`, `API_SERVICE`, and `GOLDSHORE_AI` must not be used as `gs-api` bindings. If Cloudflare still shows any of these in the dashboard, treat them as live-state cleanup candidates until a human confirms otherwise.

## `gs-web` (`apps/gs-web`)

- **Wrangler:** `apps/gs-web/wrangler.toml`
- **Production routes:** `goldshore.ai/*`, `goldshore.org/*`
- **Preview route:** `preview.goldshore.ai`
- **Canonical bindings:**
  - Worker Assets: `ASSETS`
  - Cloudflare Images: `IMAGES`
  - KV: `KV`
  - D1: `PLATFORM_DB`
  - R2: `GS_ASSETS`
- **Retired aliases:** `DB` must not be used for the web D1 binding; use `PLATFORM_DB` in Wrangler, TypeScript `Env`, Astro server routes, and docs.

## Validation checklist

When changing a binding, update these files together:

1. `infra/Cloudflare/BINDINGS_MAP.md`
2. The owning app's `wrangler.toml`
3. The owning app's TypeScript `Env` interface(s)
4. Runtime code that reads from `env.<BINDING>`
5. Tests and operational docs that mention the binding name

Run the app-level checks after each change. At minimum, run TypeScript checks or the relevant app tests plus a static search for retired aliases.
