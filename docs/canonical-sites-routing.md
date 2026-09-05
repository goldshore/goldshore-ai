# Canonical sites, workers, repos, and routing map

This is the single source of truth for:

- which domains are live now,
- which repo or service owns each one,
- where Cloudflare Workers / Pages / Sites / redirects should point,
- and where HostGator is allowed to participate.

## Canonical operating rules

1. Public brand sites should live on Sites when possible.
2. Cloudflare Workers / Pages / Access / Email Routing remain the home for
   service, auth, mail, admin, and internal routing surfaces.
3. HostGator is private infrastructure only: database, backups, mail tooling,
   prototype origins, WordPress fallback, and other backend use cases.
4. GitHub-backed repos are the source of truth for code and docs.
5. External/client-owned domains stay external unless the owner explicitly
   moves them.
6. The public site network should be interconnected by links, but not turned
   into a router homepage.

## Current live domains and their serving source

| Domain | Current source | Canonical target | Notes |
| --- | --- | --- | --- |
| `gearswipe.com`, `www.gearswipe.com` | Sites project `appgprj_6a68c49903888191a8599cb2e04b9096` | Keep on Sites | Gearswipe storefront |
| `goldshore.ai`, `www.goldshore.ai`, `goldshore.org`, `www.goldshore.org` | Sites project `appgprj_6a7641895758819188b3657008c18055` | Keep on Sites | Gold Shore brand and contract surface |
| `admin.goldshore.ai`, `admin.goldshore.org` | Sites project `appgprj_6a7667ce31208191b2962f93cf6c3504` | Keep on Sites | Admin dashboards |
| `banproof.me`, `www.banproof.me` | Sites project `appgprj_6a7671b8ce188191a16f4831f51ff616` | Keep on Sites | Banproof verification / proof surface |
| `armsway.com` | Sites project `appgprj_6a767419ed9081918b466ecd3dfedfb4` | Keep on Sites | Armsway public site |
| `www.armsway.com` | Sites project `appgprj_6a767419ed9081918b466ecd3dfedfb4` | Same Armsway project | Still settling validation |
| `rmarston.com`, `www.rmarston.com` | Sites project `appgprj_6a76758dfb3c8191af4e1632d55c14b7` | Keep on Sites | Portfolio / personal brand |
| `fortune-fund.com`, `www.fortune-fund.com` | Sites project `appgprj_6a76777f376481918867936ffe802c66` | Keep on Sites | Financial brand surface |
| `solefoodny.com`, `www.solefoodny.com` | Sites project `appgprj_6a76797537a08191be971c52e2f1b879` | Keep on Sites once DNS is changed | Still blocked by registrar-managed apex DNS |
| `partners-in-pools.com`, `www.partners-in-pools.com` | External/client-owned | Stay external | Not part of this Sites migration |

## Repo ownership

| Repo / working tree | Current role | Canonical ownership |
| --- | --- | --- |
| `E:\\GitHub\\marzton\\goldshore-ai` | Gold Shore monorepo and architecture source | Gold Shore services, docs, routing policy, internal tools |
| `E:\\OneDrive\\Documents\\Gearswipe.com` | Gearswipe storefront app in active development | Active working tree while editing |
| `E:\\GitHub\\marzton\\gearswipe-site` | GitHub-backed mirror of Gearswipe | Preferred sync mirror for GitHub and long-lived repo storage |
| `E:\\GitHub\\marzton\\armsway-site` | Independent site repo | Armsway site |
| `E:\\GitHub\\marzton\\banproof-site` | Independent site repo | Banproof site |
| `E:\\GitHub\\marzton\\fortune-fund-site` | Independent site repo | Fortune Fund site |
| `E:\\GitHub\\marzton\\rmarston-site` | Independent site repo | R. Marston portfolio site |
| `E:\\GitHub\\marzton\\solefoodny-site` | Independent site repo | Sole Food NY site once DNS is unblocked |
| `E:\\GitHub\\marzton\\goldclaw` | Supporting utility repo | Keep external / supporting |
| `E:\\GitHub\\marzton\\goldshore-ops` | Supporting ops repo | Keep external / supporting |
| `E:\\GitHub\\marzton\\gs-mcp-backup` | MCP backup / legacy utility | Keep external / supporting |

## Cloudflare workers and what they should do

| Worker / service | Current role | Canonical routing target |
| --- | --- | --- |
| `gs-web`, `gs-web-prod`, `gs-web-preview`, `gs-web-staging` | Public web surfaces | Public site layers and legacy web routing |
| `gs-api`, `gs-api-prod`, `gs-api-preview` | API layer | API routes, forms, internal integrations |
| `gs-gateway`, `gs-gateway-prod` | Gateway / auth / agent entry | Gateway and auth orchestration |
| `gs-admin` | Admin dashboard | Admin UI surface |
| `gs-control` | Build / ops control | Internal ops tooling |
| `gs-mail` | Transactional mail routing | Mail handlers and routing |
| `gs-agent`, `gs-agent-prod`, `gs-agent-preview` | Agent worker family | Agent orchestration or legacy migration target |
| `gs-platform` | Platform hub | Internal service-binding traffic |
| `gs-trading`, `gs-trading-prod` | Trading backend | Brokerage / risk backend only |
| `gs-core-worker`, `gs-core-worker-prod` | Legacy consumer / signal worker | Legacy queue / consumer logic |
| `banproof-me`, `banproof-me-prod`, `banproof-email-router` | Banproof app and routing | Banproof public surface and mail routing |
| `armsway-com`, `armsway-com-prod` | Armsway site worker family | Armsway public site |
| `rmarston-com` | Portfolio site worker | R. Marston public site |
| `partners-in-pools` | Client site worker | Stay external |
| `gs-www-redirect`, `gs-www-redirect-prod` | Redirect worker family | www-to-apex / alias behavior only |
| `goldclaw` | Supporting auth / monetization | Keep separate unless intentionally folded in |
| `gs-mcp` | MCP service | Keep separate unless explicitly integrated |

## DNS and where it should land

| Domain / subdomain | Current DNS / routing | Should land on |
| --- | --- | --- |
| `gearswipe.com`, `www.gearswipe.com` | Sites | Gearswipe Sites project |
| `goldshore.ai`, `www.goldshore.ai`, `goldshore.org`, `www.goldshore.org`, `admin.goldshore.ai`, `admin.goldshore.org`, `banproof.me`, `www.banproof.me`, `armsway.com`, `www.armsway.com`, `rmarston.com`, `www.rmarston.com`, `fortune-fund.com`, `www.fortune-fund.com` | Sites | Keep on Sites |
| `solefoodny.com`, `www.solefoodny.com` | Sites attached, but apex blocked | Sole Food NY Sites project after registrar-side DNS change |
| `api.goldshore.ai`, `gw.goldshore.ai`, `agent.goldshore.ai`, `ops.goldshore.ai`, `mail.goldshore.ai`, `radar.goldshore.ai`, `mcp.goldshore.ai` | Workers / Pages / Access / Email Routing | Keep on Cloudflare service surfaces |
| `partners-in-pools.com`, `www.partners-in-pools.com` | External/client-owned | Keep external |

## HostGator backend use cases

| Use case | Recommended fit |
| --- | --- |
| Private database backing | Use HostGator only if a managed Cloudflare-native backend is not the right fit |
| Legacy PHP / WordPress prototyping | Good fallback for fast visual experiments |
| Backup storage / restore staging | Good fit for snapshots, archives, and recovery copies |
| Mail tooling / internal relay | Only if needed for a protocol Cloudflare does not cover cleanly |
| Prototype origin for WYSIWYG / mobile editing | Fine for temporary or private development origins |
| Public routing | Not preferred; keep public entry on Sites / Workers / Pages / Access |

## Recommended framework split

| Surface | Recommended framework | Why |
| --- | --- | --- |
| Gearswipe storefront | Next.js / React | Durable, scalable, already aligned with the current app |
| Gold Shore admin / work / contracts | Next.js / React | Best fit for dashboard density and shared components |
| Portfolio / simple public pages | Astro or lightweight React/Vite | Fast, clean, low overhead |
| Internal utilities / small tools | Vite + React | Lightweight and easy to keep moving |
| WordPress fallback | WordPress only as a fallback | Keep for quick prototype assembly, not as the canonical system |

## Task trees

### Status legend

- Live: currently serving or usable
- Next: the next concrete build or routing step
- Blocked: needs an external fix or validation before the next step can land

### Gearswipe

- storefront
  - Live: hero, catalog, trust note, and product-led nav
  - Next: product detail pages and offer flows
  - Next: checkout or inquiry handoff
- back office
  - Live: admin shell and workspace toggle
  - Next: licensing outreach queue
  - Next: document upload and verification intake
  - Next: maintenance / backup tracking
- connectivity
  - Live: backlink to Gold Shore and R. Marston from the storefront footer
  - Next: shared trust copy without turning the site into a router

### Gold Shore

- work / contracts brand
  - Live: public brand pages
  - Live: admin/dashboard surfaces
  - Next: authenticated internal tools
- operations
  - Live: workers and APIs
  - Live: forms, mail, and auth routing
  - Next: internal docs and runbooks
- connectivity
  - Live: back-links to Gearswipe where product context matters
  - Live: back-links to R. Marston for trust and identity
  - Next: shared identity copy across work surfaces

### R. Marston

- portfolio
  - Live: biography
  - Next: case studies
  - Next: contact refinement
- connectivity
  - Live: links to Gold Shore for work context
  - Live: links to Gearswipe for product context

### Banproof

- trust / verification surface
  - Live: proof-of-agency or verification content
  - Next: contact / intake
  - Next: clear ownership signals

### Armsway

- independent client site
  - Live: own brand and repo ownership
  - Blocked: `www` validation is still pending

### Fortune Fund

- finance brand
  - Live: separate from Gearswipe
  - Next: use only the links and routing it needs

### Sole Food NY

- storefront / local business
  - Blocked: registrar-side DNS correction
  - Next: reattach to Sites and keep it isolated from the main brand graph

### Partners in Pools

- client-owned external site
  - Live: external
  - Next: stay external
  - Do not migrate into this Sites inventory

## Interlinking rule

The network should be interconnected by purposeful links, not by turning one site into a master router.

- Gearswipe links to Gold Shore only where the parent context helps trust.
- Gold Shore links to Gearswipe where the product context helps explain the portfolio.
- R. Marston links to both as the human trust layer.
- Client/external sites stay separate unless the owner wants cross-links.
