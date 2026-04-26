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

The legacy `infra/Cloudflare/legacy/goldshore-api.wrangler.toml` file remains for reference only; production tooling should target the canonical `gs-api` manifest and `apps/gs-api` worker sources.

## Selection policy

Do **not** glob `infra/Cloudflare/*.wrangler.toml` in scripts/docs. Use the explicit canonical paths above.
