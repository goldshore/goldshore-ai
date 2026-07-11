# GoldShore Cloudflare Binding Registry

This document is the canonical registry for Cloudflare bindings in the two-app monorepo. Binding names in Wrangler config, TypeScript `Env` interfaces, route handlers, and docs must match this table exactly.

Merge strategy: squash

## Binding rules

- Only `apps/gs-api` and `apps/gs-web` may own app bindings.
- Do not add Cloudflare bindings for retired satellite workers such as `gs-agent`, `gs-gateway`, `gs-mail`, `gs-control`, or `banproof-me` inside this monorepo.
- Prefer descriptive resource names (`PLATFORM_DB`, `GS_ASSETS`) over generic legacy aliases (`DB`, `ASSETS`) when a resource is shared or its purpose is not local-only.
- When removing a legacy alias, update all of these at the same time: `wrangler.toml`, TypeScript `Env`, application code, tests, and docs.

## Canonical binding table

| Canonical binding name | Cloudflare resource type | Cloudflare resource title/name | Resource ID | Allowed app owner | Allowed access mode | Legacy aliases to remove |
|---|---|---|---|---|---|---|
| `KV` | Workers KV namespace | Production API namespace: `gs_api_kv_001`; preview API namespace | Prod: `e0b8b807191346c3b0afc25fe716d2cd`; preview: `d4d20cee39094b999dea3f7e5f4c533a` | `apps/gs-api` | read-write | `API_KV`, `GS_CONFIG`, `goldshore-api-kv` |
| `CONTROL_LOGS` | Workers KV namespace | Production control logs namespace; preview control logs namespace | Prod: `a52e94cb331c4e3db08f2aa507e6df09`; preview: `09e43cb8bd4749fdaaed0dc9d4ff2284` | `apps/gs-api` | read-write | `LOGS_KV`, `CONTROL_KV` |
| `PLATFORM_DB` | D1 database | `gs_platform_db` | `9703574e-adb7-481e-8d98-96f8ce5f8a90` | `apps/gs-api`, `apps/gs-web` | `apps/gs-api`: read-write; `apps/gs-web`: read-write only for public form submissions and admin form management | `DB`, `BAN_DB`, `goldshore-api-db` |
| `AUDIT_DB` | D1 database | `gs_audit_db` | `1ae71d76-188f-481b-91d9-db2d39013f68` | `apps/gs-api` | read-write | `AUDIT_LOG_DB`, `TELEMETRY_DB` |
| `SIGNALS_DB` | D1 database | `gs_signals_db` | `76af4653-7f44-417b-b46e-250143d906fd` | `apps/gs-api` | read-write | `SIGNAL_DB`, `SIGNALS` |
| `JOBS_DB` | D1 database | `gs_jobs_db` | `750c469c-788d-49e8-9254-77231cffd70f` | `apps/gs-api` | read-write | `QUEUE_DB`, `JOB_DB` |
| `GS_ASSETS` | R2 bucket | Production: `gs-assets`; preview: `gs-assets-preview` | Not applicable | `apps/gs-api`, `apps/gs-web` | `apps/gs-api`: read-write; `apps/gs-web`: read-only unless explicitly serving build assets through the Worker Assets binding | `ASSETS`, `MEDIA`, `goldshore-api-assets` |
| `TELEMETRY` | R2 bucket | `gs-telemetry-storage` | Not applicable | `apps/gs-api` | producer | `TELEMETRY_BUCKET`, `TELEMETRY_STORAGE` |
| `AI` | Workers AI binding | Cloudflare Workers AI / AI Gateway-backed model access | Not applicable | `apps/gs-api` | service caller | `CF_AI`, `GOLDSHORE_AI`, `goldshore-ai-gateway` |
| `AUTH_SESSION` | Durable Object namespace | `AuthSession` | Not applicable | `apps/gs-api` | read-write | `SESSION_DO`, `AUTH_DO` |
| `SECRETS` | Secrets Store binding | GoldShore integration secrets store | `b9824d3280c54573a24137c7e7143b33` | `apps/gs-api` | read-only secret lookup | `SECRET_STORE`, `INTEGRATION_SECRETS` |
| `JOBS_QUEUE` | Queue producer | `goldshore-jobs` | Not applicable | `apps/gs-api` | producer | `JOB_QUEUE`, `AGENT_QUEUE` |
| `EVENTS_QUEUE` | Queue producer | `gs-events` | Not applicable | `apps/gs-api` | producer | `EVENT_QUEUE`, `PLATFORM_EVENTS` |
| `MAIL_JOBS_QUEUE` | Queue producer | `gs-mail-jobs` | Not applicable | `apps/gs-api` | producer | `MAIL_QUEUE`, `GS_MAIL_QUEUE` |
| `DEAD_LETTER_QUEUE` | Queue producer | `gs-mail-dead-letter` | Not applicable | `apps/gs-api` | producer | `DLQ`, `MAIL_DEAD_LETTER` |
| `KV` | Workers KV namespace | Web runtime namespace | `5f13370575784c9dacff522121104cb3` | `apps/gs-web` | read-write for form-submission fallback/cache only | `WEB_KV`, `GS_CONFIG` |
| `ASSETS` | Worker Assets binding | Astro build assets from `apps/gs-web/dist` | Not applicable | `apps/gs-web` | read-only asset serving | `STATIC_ASSETS`, `SITE_ASSETS` |

## Environment variable names

The following are vars/secrets rather than Cloudflare resource bindings and must not be represented as KV, D1, R2, or service bindings:

| Name | Owner | Purpose |
|---|---|---|
| `ENV` | `apps/gs-api`, `apps/gs-web` | Runtime environment label. |
| `CLOUDFLARE_ACCESS_AUDIENCE` | `apps/gs-api`, `apps/gs-web` | Cloudflare Access JWT audience. |
| `CLOUDFLARE_TEAM_DOMAIN` | `apps/gs-api`, `apps/gs-web` | Cloudflare Access team domain. |
| `GOOGLE_OAUTH_CLIENT_ID` | `apps/gs-api` | GoldClaw Google OAuth public client identifier. |
| `GOOGLE_OAUTH_REDIRECT_URI` | `apps/gs-api` | GoldClaw OAuth callback URL. |
| `CONTACT_NOTIFICATION_EMAILS` | `apps/gs-web` | Form notification recipients. |
| `MAILCHANNELS_SENDER_NAME` | `apps/gs-web` | Display name for form notification mail. |

## Retired binding families

These names are intentionally absent from the canonical tables and must not be reintroduced:

- Service bindings to retired app workers: `AGENT`, `GS_MAIL`, `GS_WEB`, `API_SERVICE`, `GATEWAY`, `SECURITY`, `SIGNALS`.
- Legacy app-local D1 aliases: `DB`, `BAN_DB`, `AUDIT_LOG_DB`, `TELEMETRY_DB`.
- Legacy R2 aliases: `ASSETS` in `apps/gs-api`; `MEDIA`; `TELEMETRY_BUCKET`.
- Legacy queue aliases: `MAIL_QUEUE`, `CHECKOUT_EVENTS_QUEUE`, `CONTACT_EVENTS_QUEUE`.
