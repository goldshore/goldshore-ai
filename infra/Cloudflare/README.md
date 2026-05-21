# Cloudflare Wrangler Manifest Canonical Map

This directory previously contained both canonical `gs-*` Wrangler manifests and legacy `goldshore-*` variants.

## Inventory: legacy `goldshore-*.wrangler.toml`

The following legacy manifests were moved to `infra/Cloudflare/legacy/` and are **non-deployable references**:

- `goldshore-admin.wrangler.toml`
- `goldshore-api.wrangler.toml`
- `goldshore-web.wrangler.toml`

## Canonical Wrangler manifest path per live service

Use exactly one canonical path per live service:

| Service | Canonical manifest path |
|---|---|
| `gs-web` | `infra/Cloudflare/gs-web.wrangler.toml` |
| `gs-admin` | `infra/Cloudflare/gs-admin.wrangler.toml` |
| `gs-api` | `infra/Cloudflare/gs-api.wrangler.toml` |
| `gs-gateway` | `apps/gs-gateway/wrangler.toml` |
| `gs-control` | `apps/gs-control/wrangler.toml` |
| `gs-mail` | `apps/gs-mail/wrangler.toml` |
| `banproof-me` | `apps/banproof-me/wrangler.toml` |

The legacy `infra/Cloudflare/legacy/goldshore-api.wrangler.toml` file remains for reference only; production tooling should target the canonical `gs-api` manifest and `apps/gs-api` worker sources.


## Routing source of truth

For all Pages-vs-Workers route ownership and change workflow rules, use:

- `infra/Cloudflare/runbooks/ROUTING_SOURCE_OF_TRUTH.md`

## Selection policy

Do **not** glob `infra/Cloudflare/*.wrangler.toml` in scripts/docs. Use the explicit canonical paths above.

## CI Secret Contract (Canonical)

Cloudflare worker deploy workflows and infra guard checks use the following canonical GitHub Actions secrets:

| Secret name | Required for | Ownership |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | All worker deploy jobs and Cloudflare infra guard checks | Cloudflare account owner / platform ops |
| `CLOUDFLARE_BUILD_API_TOKEN` | All worker deploy jobs (`gs-api`, `gs-agent`, `gs-gateway`, `gs-control`, `gs-mail`, `banproof-me`) and Cloudflare infra guard API calls | `gs-control` service token owner (platform ops) |

Policy:

- `CLOUDFLARE_BUILD_API_TOKEN` is the single canonical deploy token secret for worker CI.
- Do not add fallback expressions (for example `secretA || secretB`) in worker deploy workflows unless a documented exception is added to Cloudflare runbooks.
