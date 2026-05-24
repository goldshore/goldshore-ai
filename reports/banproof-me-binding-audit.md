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
