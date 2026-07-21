# Cloudflare Route Ownership Matrix

Last updated: 2026-05-29 (route intent) · Live-verified: 2026-07-17

## Live verification (2026-07-17)

Direct `curl` against every hostname below, from outside Cloudflare. Result is what's
actually live right now, independent of what any wrangler.toml/CLAUDE.md claims.

| Hostname | Result | Notes |
| --- | --- | --- |
| `goldshore.ai` | `200` | Healthy |
| `www.goldshore.ai` | `401` | Not a redirect — CF Access is gating this host directly. Confirm whether that's intended for a plain `www` redirect, or the Access policy is scoped too broadly. |
| `goldshore.org` | `200` | Healthy — served by `gs-web-prod` (per `apps/gs-web/wrangler.toml`'s `goldshore.org/*` route). The dedicated `goldshore-org` Worker declared in `marzton/goldshore/wrangler.toml` does **not exist live** in either Cloudflare account these credentials can reach — `goldshore.ai` is the one actually serving `.org` traffic today, not `goldshore-org`. |
| `www.goldshore.org` | `308` | Healthy redirect |
| `admin.goldshore.org` | `404` | DNS/proxy resolves but no Worker/Pages route matches — the `.org` alias for `gs-admin` (documented as "same app as admin.goldshore.ai") is **not actually wired up**, unlike the `.ai` version. |
| `api.goldshore.ai` | `401` | Live (Access-protected as expected) |
| `api.goldshore.org` | no route | `CONNECT tunnel failed` — no live DNS/route, despite being declared in `apps/gs-api/wrangler.toml`'s own `env.prod.routes` **and** `marzton/goldshore/apps/goldshore-api/wrangler.toml`. Config says two different repos serve this; live, neither actually does. |
| `api-preview.goldshore.org` | no route | Same — not live, despite **four** separate repos (`rmarston-com/goldshore-core/apps/api-worker`, `goldshore-api/apps/api-worker`, `goldshore-gateway/goldshore-api`, `goldshore/apps/goldshore-api`) all declaring this identical route in git. |
| `signals.goldshore.org` | no route | Not live |
| `gw.goldshore.ai` | `401` | Live |
| `gateway.goldshore.ai` | no route | `CONNECT tunnel failed` — declared in `goldshore-gateway/wrangler.jsonc` but not actually resolving |
| `agent.goldshore.ai` | `401` | Live — but see the conflicting-owner note below (config disagrees on whether this belongs to `gs-api` or `gs-gateway`) |
| `trading.goldshore.ai` | `401` | Live |
| `dashboard.goldshore.ai` | `401` | Live |
| `dash.goldshore.ai` | no route | Not live |
| `ops.goldshore.ai` | no route | Not live |
| `mail.goldshore.ai` | `401` | Live |
| `radar.goldshore.ai` | no route | Not live |
| `signals.goldshore.ai` | `401` | Live (no route declared in any accessible repo's config — dashboard-only binding, or the owning repo isn't in this session's scope) |
| `todo.goldshore.ai` | no route | Not live. `gs-todo` Worker exists (created 2026-04-24, never modified since) but has no live route — looks abandoned/never finished, not actively serving anything despite appearing in infra tables. |
| `admin.goldshore.ai` | `401` | Live |
| `banproof.me` | `522` | **Broken** — Cloudflare reached the edge but the origin didn't respond. Two repos (`marzton/banproof-me` and `marzton/goldshore-core/apps/banproof-me`) declare an identical Worker name (`banproof-me`) and identical routes; whichever deployed last likely clobbered the other, and this 522 is consistent with that collision leaving the Worker in a broken state. |
| `www.banproof.me` | `200` | Healthy (same declared Worker as the broken apex — worth checking why only one pattern is unhealthy) |
| `armsway.com` | no route | Not live — **both apex and www**, worse than previously documented (earlier this session only the apex was confirmed down; `www` now fails too). PR `armsway-com#172` fixed the CI guard that was silently passing on this, but the actual Cloudflare-side route/custom-domain binding is still missing. |
| `www.armsway.com` | no route | Not live, see above |
| `rmarston.com` | `200` | Healthy |
| `www.rmarston.com` | `200` | Healthy |
| `gearswipe.com` | `200` | Healthy — real "Coming Soon" content served via Cloudflare (Pages project, per `DOMAIN_REGISTRY.md`; not a Worker, so it doesn't show up in a Workers-only account listing). `marzton/gearswipe` repo doesn't exist yet, confirming this is Pages-only for now. |

"No route" = `curl` gets `CONNECT tunnel failed, response 502` at the TLS layer — i.e. no
Cloudflare proxy target exists for that hostname at all, not an app-level error.

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
| `trading.goldshore.ai` | CNAME | Proxied | `gs-trading-prod` | Worker route | none | `/health` and Access login wall |
| `dashboard.goldshore.ai` | CNAME | Proxied | `gs-trading-prod` | Worker route alias | none | Access login wall |
| `dash.goldshore.ai` | CNAME | Proxied | `gs-trading-prod` | Worker route alias | none | Access login wall |
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
