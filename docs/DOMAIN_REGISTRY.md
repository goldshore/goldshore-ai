# Gold Shore Canonical Domain Registry

Last updated: 2026-05-29

## Platform policy

- GitHub is source control and CI.
- Cloudflare is production DNS, TLS, Pages, Workers, and redirects.
- GitHub Pages (`goldshore.github.io`) is fallback/archive only.
- Replit preview URLs are dev-only and must never be production DNS origins.

## Canonical mapping

| Domain/Host | Role | Repo | Runtime | Owner | Canonical |
| --- | --- | --- | --- | --- | --- |
| `goldshore.ai` | Parent lab/technical brand | `marzton/goldshore-ai` | Cloudflare Pages/Worker route | `gs-web` | Yes |
| `www.goldshore.ai` | Alias | `marzton/goldshore-ai` | Cloudflare redirect | redirect rule | No |
| `goldshore.org` | Business website management hub (Wix-style managed services layer) | `marzton/goldshore-org` or `marzton/goldshore-ai` | Cloudflare Pages | `goldshore-org` or `gs-web` | Yes |
| `www.goldshore.org` | Alias | same | Cloudflare redirect | redirect rule | No |
| `api.goldshore.ai` | Shared first-party API | `marzton/goldshore-ai` | Cloudflare Worker | `gs-api` | Yes |
| `gw.goldshore.ai` | API gateway/auth routing | `marzton/goldshore-ai` | Cloudflare Worker | `gs-gateway` | Yes |
| `gateway.goldshore.ai` | Gateway alias | `marzton/goldshore-ai` | Redirect/Worker alias | `gs-gateway` | No |
| `admin.goldshore.ai` | Internal admin UI | `marzton/goldshore-ai` | Cloudflare Pages | `gs-admin` | Internal |
| `ops.goldshore.ai` | Internal control plane | `marzton/goldshore-ai` | Cloudflare Worker | `gs-control` | Internal |
| `agent.goldshore.ai` | Agent endpoint | `marzton/goldshore-ai` | Cloudflare Worker | `gs-agent`/`gs-gateway` | Internal |
| `mail.goldshore.ai` | Mail/form routing | `marzton/goldshore-ai` | Cloudflare Worker | `gs-mail` | Service |
| `radar.goldshore.ai` | Risk Radar | `marzton/goldshore-ai` | Cloudflare Pages | `gs-web` | Product |
| `gearswipe.com` | GearSwipe app | `marzton/gearswipe` | Cloudflare Pages | `gearswipe` | Yes |
| `www.gearswipe.com` | GearSwipe alias | `marzton/gearswipe` | Cloudflare redirect | redirect rule | No |
| `rmarston.com` | Personal profile | `marzton/rmarston-com` | Cloudflare Pages | `rmarston-com` | Independent |
| `www.rmarston.com` | Alias | same | Cloudflare redirect | redirect rule | No |
| `armsway.com` | Product/content site | `marzton/armsway-com` | Cloudflare Pages | `armsway-com` | Yes |
| `www.armsway.com` | Alias | same | Cloudflare redirect | redirect rule | No |
| `banproof.me` | Product lane | `marzton/banproof-me` | Worker/Pages (verify active) | `banproof-me` | Yes |
| `www.banproof.me` | Alias | same | Cloudflare redirect | redirect rule | No |
| `disposable-bp-cuff-sleeves` | Product microsite project slug (DNS pending) | `marzton/disposable-bp-cuff-sleeves` | Cloudflare Pages target | project slug | Pending |
| `goldshore.github.io` | Legacy fallback | `marzton/goldshore.github.io` | GitHub Pages | fallback only | No |

## API interoperability origin allowlist

- https://goldshore.ai
- https://www.goldshore.ai
- https://goldshore.org
- https://www.goldshore.org
- https://rmarston.com
- https://www.rmarston.com
- https://armsway.com
- https://www.armsway.com
- https://gearswipe.com
- https://www.gearswipe.com
- https://banproof.me
- https://www.banproof.me

CORS is not authentication. Protected routes still require explicit auth/trust controls.
