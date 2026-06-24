# Cloudflare Route Ownership Matrix

Last updated: 2026-05-29

| Hostname | DNS record (expected) | Proxy | Intended owner | Binding | Redirect | Deployment marker |
| --- | --- | --- | --- | --- | --- | --- |
| `goldshore.ai` | CNAME/flattened | Proxied | `gs-web` | Pages custom domain or worker route | none | `/version.json` preferred |
| `www.goldshore.ai` | CNAME | Proxied | redirect rule | Cloudflare rule | `301 -> https://goldshore.ai` | n/a |
| `goldshore.org` | CNAME/flattened | Proxied | `goldshore-org` or `gs-web` | Pages custom domain | none | `/version.json` preferred |
| `www.goldshore.org` | CNAME | Proxied | redirect rule | Cloudflare rule | `301 -> https://goldshore.org` | n/a |
| `api.goldshore.ai` | CNAME/A | Proxied | `gs-api` | Worker route `api.goldshore.ai/*` | none | `/health`, `/version`, `/version.json` |
| `gw.goldshore.ai` | CNAME/A | Proxied | `gs-gateway` | Worker route `gw.goldshore.ai/*` | none | `/health` and `/version` (may be protected) |
| `gateway.goldshore.ai` | CNAME | Proxied | `gs-gateway` alias | redirect or alias route | ideally to `gw` | same as gw |
| `admin.goldshore.ai` | CNAME | Proxied | `gs-admin` | Pages custom domain | none | `/version.json` preferred |
| `ops.goldshore.ai` | CNAME/A | Proxied | `gs-control` | Worker route | none | `/health`/`/version` |
| `agent.goldshore.ai` | CNAME/A | Proxied | `gs-agent`/`gs-gateway` | Worker route | none | `/health`/`/version` |
| `mail.goldshore.ai` | CNAME/A | Proxied | `gs-mail` | Worker route | none | `/health`/`/version` |
| `radar.goldshore.ai` | CNAME | Proxied | `gs-web` app route | Pages custom domain | none | `/version.json` preferred |
| `gearswipe.com` | CNAME/flattened | Proxied | `gearswipe` | Pages custom domain | none | `/version.json` preferred |
| `www.gearswipe.com` | CNAME | Proxied | redirect rule | Cloudflare rule | `301 -> https://gearswipe.com` | n/a |
| `rmarston.com` | CNAME/flattened | Proxied | `rmarston-com` | Pages custom domain | none | `/version.json` preferred |
| `www.rmarston.com` | CNAME | Proxied | redirect rule | Cloudflare rule | `301 -> https://rmarston.com` | n/a |
| `banproof.me` | CNAME/A | Proxied | `banproof-me` (verify) | Worker/Pages | none | `/version` or `/version.json` |
| `www.banproof.me` | CNAME | Proxied | redirect rule | Cloudflare rule | `301 -> https://banproof.me` | n/a |

## Legacy/stale worker verification list

- `goldshore-ai`
- `gs-dynamic-worker`
- `gs-platform`
- `goldshore-web`
- `goldshore-org`

Do not delete until route bindings are confirmed in Cloudflare dashboard.
