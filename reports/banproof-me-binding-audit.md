# banproof-me production binding audit

Source date: 2026-04-29. Updated to match the current on-repo `apps/banproof-me/wrangler.toml`.

| binding key | wrangler value | dashboard value | expected canonical value | remediation |
|---|---|---|---|---|
| `BAN_DB` (D1) | Present in `apps/banproof-me/wrangler.toml` | Unknown (dashboard value not captured in repo) | Current repo binding key for the app's D1 database | Verify the Cloudflare dashboard uses the same binding key and attached database as Wrangler. |
| `GOLDSHORE_KV` (KV namespace) | Present in `apps/banproof-me/wrangler.toml` | Unknown | Current repo KV namespace binding key | Verify the Cloudflare dashboard KV binding matches the Wrangler binding name and namespace. |
| `BAN_EVENTS` (Queue producer/consumer binding) | Present in `apps/banproof-me/wrangler.toml` | Unknown | Current repo queue binding key | Verify the Cloudflare dashboard queue binding and queue name match the Wrangler configuration. |
| `API_SERVICE` (Service binding) | Present in `apps/banproof-me/wrangler.toml` | Unknown | Current repo service binding key | Verify the Cloudflare dashboard service binding matches the Wrangler binding name and target service. |
| `OPENAI_API_KEY` (secret) | Not verifiable from this report snippet | Unknown | Secret exists in production worker settings if required by runtime code | Confirm whether the application expects this secret at runtime, then provision and document it in deployment runbooks as needed. |
| `POA_TOKEN` (secret) | Not verifiable from this report snippet | Unknown | Secret exists in production worker settings if required by runtime code | Confirm whether the application expects this secret at runtime, then provision and document it in deployment runbooks as needed. |
| `AUDIT_TOKEN` (secret) | Not verifiable from this report snippet | Unknown | Secret exists in production worker settings if required by runtime code | Confirm whether the application expects this secret at runtime, then provision and document it in deployment runbooks as needed. |

Note: the previously referenced bindings `PLATFORM_DB`, `BANPROOF_KV`, `AI_CACHE`, `BANPROOF_JOBS`, and `GS_API` do not match the current on-repo Wrangler configuration. Treat those names as describing an older or different environment unless separate evidence is provided.
Source date: 2026-04-29.

| binding key | wrangler value | dashboard value | expected canonical value | remediation |
|---|---|---|---|---|
| `PLATFORM_DB` (D1) | `Not declared` in checked-in `apps/banproof-me/wrangler.toml` (the file exists; production bindings in the checked-in config include `BANPROOF_KV`, `GOLDSHORE_KV`, `BAN_DB`, `API_SERVICE`, and `BAN_EVENTS`) | Unknown (dashboard value not captured in repo) | `gs_platform_db` | If `PLATFORM_DB` is still required, add `[[env.prod.d1_databases]] binding = "PLATFORM_DB" database_name = "gs_platform_db"` to the existing `apps/banproof-me/wrangler.toml`; otherwise update the audit to the current canonical D1 binding name. |
| `BANPROOF_KV` (KV namespace) | Declared in checked-in production Wrangler config | Unknown | `BANPROOF_KV` namespace binding key in `env.prod.kv_namespaces` | Verify the binding key and namespace ID in the Cloudflare dashboard match the checked-in Wrangler configuration. |
| `AI_CACHE` (KV namespace) | `Not declared` in checked-in production Wrangler config | Unknown | `AI_CACHE` namespace binding key in `env.prod.kv_namespaces` | Add the `AI_CACHE` KV binding if it is still required, or remove/update this audit row if `GOLDSHORE_KV` / `BANPROOF_KV` superseded it. |
| `BANPROOF_JOBS` (Queue producer/consumer binding) | `Not declared` in checked-in production Wrangler config; checked-in queue binding is `BAN_EVENTS` | Unknown | `BANPROOF_JOBS` queue binding key in `env.prod.queues` | Reconcile the expected queue binding name with the checked-in `BAN_EVENTS` binding, or add `BANPROOF_JOBS` if both are required. |
| `GS_API` (Service binding) | `Not declared` in checked-in production Wrangler config; checked-in service binding is `API_SERVICE` | Unknown | Service `gs-api` via binding key `GS_API` | Reconcile the expected service binding key with the checked-in `API_SERVICE` binding, or add `GS_API` if the worker still expects that name. |
| `OPENAI_API_KEY` (secret) | `Not declared` | Unknown | Secret exists in production worker settings | Add secret expectation to worker config and provision in Cloudflare secrets. |
| `POA_TOKEN` (secret) | `Not declared` | Unknown | Secret exists in production worker settings | Add secret expectation to worker config and provision in Cloudflare secrets. |
| `AUDIT_TOKEN` (secret) | `Not declared` | Unknown | Secret exists in production worker settings | Add secret expectation to worker config and provision in Cloudflare secrets. |

