# banproof-me production binding audit

Source date: 2026-04-29.

| binding key | wrangler value | dashboard value | expected canonical value | remediation |
|---|---|---|---|---|
| `BAN_DB` (D1) | Declared in `apps/banproof-me/wrangler.toml` | Unknown (dashboard value not captured in repo) | `BAN_DB` binding declared in Wrangler | Verify the production dashboard D1 binding matches the on-repo Wrangler configuration. |
| `BANPROOF_KV` (KV namespace) | Declared in `apps/banproof-me/wrangler.toml` | Unknown | `BANPROOF_KV` namespace binding key in Wrangler | Verify the Cloudflare dashboard KV binding matches the on-repo Wrangler configuration. |
| `GOLDSHORE_KV` (KV namespace) | Declared in `apps/banproof-me/wrangler.toml` | Unknown | `GOLDSHORE_KV` namespace binding key in Wrangler | Verify the Cloudflare dashboard KV binding matches the on-repo Wrangler configuration. |
| `BAN_EVENTS` (binding declared in Wrangler) | Declared in `apps/banproof-me/wrangler.toml` | Unknown | `BAN_EVENTS` binding declared in Wrangler | Verify the production dashboard binding type and value match the on-repo Wrangler configuration. |
| `API_SERVICE` (Service binding) | Declared in `apps/banproof-me/wrangler.toml` | Unknown | `API_SERVICE` service binding declared in Wrangler | Verify the production dashboard service binding matches the on-repo Wrangler configuration. |
| `OPENAI_API_KEY` (secret) | `Not declared` | Unknown | Secret exists in production worker settings | Add secret expectation to worker config and provision in Cloudflare secrets. |
| `POA_TOKEN` (secret) | `Not declared` | Unknown | Secret exists in production worker settings | Add secret expectation to worker config and provision in Cloudflare secrets. |
| `AUDIT_TOKEN` (secret) | `Not declared` | Unknown | Secret exists in production worker settings | Add secret expectation to worker config and provision in Cloudflare secrets. |

