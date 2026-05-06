# banproof-me production binding audit

Source date: 2026-04-29.

| binding key | wrangler value | dashboard value | expected canonical value | remediation |
|---|---|---|---|---|
| `PLATFORM_DB` (D1) | `MISSING` (`apps/banproof-me/wrangler.toml` not present) | Unknown (dashboard value not captured in repo) | `gs_platform_db` | Add `apps/banproof-me/wrangler.toml` with `[[env.prod.d1_databases]] binding = "PLATFORM_DB" database_name = "gs_platform_db"`. |
| `BANPROOF_KV` (KV namespace) | `MISSING` | Unknown | `BANPROOF_KV` namespace binding key in `env.prod.kv_namespaces` | Declare KV binding in Wrangler and verify key is unchanged in Cloudflare dashboard. |
| `AI_CACHE` (KV namespace) | `MISSING` | Unknown | `AI_CACHE` namespace binding key in `env.prod.kv_namespaces` | Declare KV binding in Wrangler and verify key is unchanged in Cloudflare dashboard. |
| `BANPROOF_JOBS` (Queue producer/consumer binding) | `MISSING` | Unknown | `BANPROOF_JOBS` queue binding key in `env.prod.queues` | Declare queue binding in Wrangler and align queue name in dashboard. |
| `GS_API` (Service binding) | `MISSING` | Unknown | Service `gs-api` via binding key `GS_API` | Add `[[env.prod.services]] binding = "GS_API" service = "gs-api"` and reconcile dashboard key/value. |
| `OPENAI_API_KEY` (secret) | `Not declared` | Unknown | Secret exists in production worker settings | Add secret expectation to worker config and provision in Cloudflare secrets. |
| `POA_TOKEN` (secret) | `Not declared` | Unknown | Secret exists in production worker settings | Add secret expectation to worker config and provision in Cloudflare secrets. |
| `AUDIT_TOKEN` (secret) | `Not declared` | Unknown | Secret exists in production worker settings | Add secret expectation to worker config and provision in Cloudflare secrets. |

