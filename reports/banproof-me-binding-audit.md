# banproof-me production binding audit

Source date: 2026-04-29.

| binding key | wrangler value | dashboard value | expected canonical value | remediation |
|---|---|---|---|---|
| `BAN_DB` (D1) | Declared in `apps/banproof-me/wrangler.toml` as D1 binding `BAN_DB` | Unknown (dashboard value not captured in repo) | `BAN_DB` binding key in `env.prod.d1_databases` | Reconcile `scripts/check-banproof-bindings.mjs` and any prior `PLATFORM_DB` references to the actual Wrangler binding `BAN_DB`; verify the production database name separately in dashboard/Wrangler config. |
| `BANPROOF_KV` (KV namespace) | Declared in `apps/banproof-me/wrangler.toml` as KV binding `BANPROOF_KV` | Unknown | `BANPROOF_KV` namespace binding key in `env.prod.kv_namespaces` | Keep `BANPROOF_KV` as the canonical KV binding and verify the namespace ID/value in the Cloudflare dashboard. |
| `GOLDSHORE_KV` (KV namespace) | Declared in `apps/banproof-me/wrangler.toml` as KV binding `GOLDSHORE_KV` | Unknown | `GOLDSHORE_KV` namespace binding key in `env.prod.kv_namespaces` | Reconcile any prior `AI_CACHE` references in the script/report to the actual Wrangler binding `GOLDSHORE_KV`; verify the namespace ID/value in the Cloudflare dashboard. |
| `BAN_EVENTS` (Queue producer/consumer binding) | Declared in `apps/banproof-me/wrangler.toml` as queue binding `BAN_EVENTS` | Unknown | `BAN_EVENTS` queue binding key in `env.prod.queues` | Reconcile `scripts/check-banproof-bindings.mjs` and any prior `BANPROOF_JOBS` references to the actual Wrangler binding `BAN_EVENTS`; verify the queue name in the Cloudflare dashboard. |
| `API_SERVICE` (Service binding) | Declared in `apps/banproof-me/wrangler.toml` as service binding `API_SERVICE` | Unknown | Service binding key `API_SERVICE` in `env.prod.services` | Reconcile `scripts/check-banproof-bindings.mjs` and any prior `GS_API` references to the actual Wrangler binding `API_SERVICE`; verify the target service name in the Cloudflare dashboard. |
| `OPENAI_API_KEY` (secret) | Not declared in Wrangler file (expected for secret material) | Unknown | Secret exists in production worker settings | Verify the secret is provisioned in Cloudflare production settings and document it separately from Wrangler-managed bindings if that is the project convention. |
| `POA_TOKEN` (secret) | Not declared in Wrangler file (expected for secret material) | Unknown | Secret exists in production worker settings | Verify the secret is provisioned in Cloudflare production settings and document it separately from Wrangler-managed bindings if that is the project convention. |
| `AUDIT_TOKEN` (secret) | Not declared in Wrangler file (expected for secret material) | Unknown | Secret exists in production worker settings | Verify the secret is provisioned in Cloudflare production settings and document it separately from Wrangler-managed bindings if that is the project convention. |

