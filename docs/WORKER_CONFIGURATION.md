# Worker Configuration Guide

This document describes the Cloudflare configuration for the GoldShore two-app monorepo.

## Source of truth

- Canonical binding registry: `infra/Cloudflare/BINDINGS_MAP.md`.
- Queue matrix: `docs/ops/queue-contract-matrix.md`.
- Runtime apps: `apps/gs-api` and `apps/gs-web` only.

Do not add new app workers or deploy workflows for retired services. All backend, cron, queue, auth, data, and AI logic belongs in `apps/gs-api`; all frontend routes and visual code belongs in `apps/gs-web`.

## `gs-api` (`apps/gs-api`)

- **Wrangler:** `apps/gs-api/wrangler.toml`
- **Production routes:** `api.goldshore.ai/*`, `api.goldshore.org/*`
- **Preview:** `workers_dev = true`
- **Canonical bindings:**
  - KV: `KV`, `CONTROL_LOGS`
  - D1: `PLATFORM_DB`, `AUDIT_DB`, `SIGNALS_DB`, `JOBS_DB`
  - R2: `GS_ASSETS`, `TELEMETRY`
  - AI: `AI`
  - Durable Object: `AUTH_SESSION`
  - Queues produced: `JOBS_QUEUE`, `EVENTS_QUEUE`, `MAIL_JOBS_QUEUE`, `DEAD_LETTER_QUEUE`
  - Secrets Store: `SECRETS`
- **Retired aliases:** `DB`, `ASSETS`, `TELEMETRY_DB`, `AGENT`, `GS_MAIL`, `GS_WEB`, `API_SERVICE`, and `GOLDSHORE_AI` must not be used as `gs-api` bindings.

## `gs-web` (`apps/gs-web`)

- **Wrangler:** `apps/gs-web/wrangler.toml`
- **Production routes:** `goldshore.ai/*`, `goldshore.org/*`
- **Preview route:** `preview.goldshore.ai`
- **Canonical bindings:**
  - Worker Assets: `ASSETS`
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
