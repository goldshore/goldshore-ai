# Cloudflare routing plan

The repository has two canonical deployable applications.

| Surface | Production hosts | Runtime | Source |
|---|---|---|---|
| Public/admin/docs UI | `goldshore.ai`, `goldshore.org`, `admin.goldshore.ai`, `admin.goldshore.org` | One `gs-web-prod` Astro SSR Worker with Assets | `apps/gs-web` |
| API/auth/jobs/integrations | `api.goldshore.ai` | `gs-api-prod` Worker | `apps/gs-api` |

`apps/gs-web/wrangler.toml` owns the UI routes. Static assets and the SSR entry
point ship in the same release; no workflow may deploy its client output as a
second project.

## Future static migration

Moving the UI to Pages is an architecture change. First move all dynamic web
routes and request-time behavior into `apps/gs-api`, then replace—not duplicate—
the Worker deployment and cut over all four production hosts atomically.
# Cloudflare Routing Plan

Last checked: 2026-07-21

## Active Source Rules

- Frontend source lives in `apps/gs-web`.
- API source lives in `apps/gs-api`.
- Do not add new app directories or deploy workflow files for satellite Workers.
- If `goldshore-api` is extracted to a separate repository, that repository should own only the API Worker deployment, not the frontend routes.
- Existing Cloudflare Pages/Workers projects that cannot be deleted should be repurposed deliberately, not treated as new application source roots.
- HostGator VPS may be used as a private origin for lower-cost database, email, or server-only features, but Cloudflare should remain the public routing, TLS, and access-control layer.

## Observed Public State

| Host | DNS/HTTP observation | Current concern |
| --- | --- | --- |
| `goldshore.ai` | Resolves to Cloudflare proxy IPs and returns `200`. | GitHub Pages also claims this custom domain. |
| `www.goldshore.ai` | Resolves to Cloudflare proxy IPs and redirects to `https://goldshore.ai/`. | Root `CNAME` file says `www.goldshore.ai`, but GitHub Pages API reports `goldshore.ai`. |
| `goldshore.org` | Resolves to Cloudflare proxy IPs and returns `200`. | Live dashboard context says this is attached to `gs-web`. Decide whether `.org` or `.ai` is canonical. |
| `preview.goldshore.org` | Resolves to Cloudflare proxy IPs and returns `200`. | Live dashboard context says this is attached to `gs-web-staging`. |
| `api.goldshore.ai` | Resolves to Cloudflare proxy IPs, `/health` returns `500`. | DNS/routing exists, Worker/runtime is unhealthy. |
| `api-preview.goldshore.ai` | No public DNS answer. | `apps/gs-api/wrangler.toml` declares this preview route, but DNS/custom domain is missing. |
| `preview.goldshore.ai` | No public DNS answer. | Docs mention this preview host, but DNS/custom domain is missing. |
| `admin.goldshore.ai` | No public DNS answer. | Legacy docs still mention admin, but repo rules say admin must be inside `gs-web`. |
| `mail.goldshore.ai` | Resolves to Cloudflare proxy IPs, HTTP returns `522`. | If mail is only Email Routing, it should not be treated as a normal HTTP app. |
| `mcp.goldshore.ai` | Resolves and redirects to Cloudflare Access. | Active Zero Trust/MCP surface. Keep separate from web/API routing. |
| `goldshore-api.pages.dev` | Existing Cloudflare Pages project. | Original website-template Pages project that should not be deleted; repurpose as a sandbox/archive/status surface or redirect-only utility, not the production API. |

## Recommended Canonical Topology

| Purpose | Production host | Staging/preview host | Cloudflare product | Source owner |
| --- | --- | --- | --- | --- |
| Public website | `goldshore.ai` or `goldshore.org`, choose one | `preview.<canonical-domain>` | Cloudflare Pages | `apps/gs-web` |
| Website alias | Other apex plus `www` | None or redirect only | Redirect rule or Pages alias | `apps/gs-web`/Cloudflare |
| API Worker | `api.goldshore.ai` | `api-preview.goldshore.ai` | Cloudflare Worker custom domain, preferred | `apps/gs-api` or extracted `goldshore-api` |
| Admin UI | `<canonical>/admin` | preview Pages branch or protected preview host | Cloudflare Pages + Access | `apps/gs-web` |
| Internal API/admin endpoints | `api.goldshore.ai/admin/*`, `/internal/*` | `api-preview.goldshore.ai/*` | `gs-api` Worker + Access where needed | `apps/gs-api` |
| Mail receiving | Cloudflare Email Routing for `goldshore.ai` | None | Email Routing/Email Worker handler in `gs-api` if needed | `apps/gs-api` |
| MCP portal | `mcp.goldshore.ai` | Optional | Cloudflare Zero Trust/MCP Portal | Cloudflare dashboard |
| Legacy/template Pages | `goldshore-api.pages.dev` only, or a low-risk utility hostname | None | Cloudflare Pages | Repurposed existing project |
| VPS-backed private origin | Internal-only hostname, protected by Access/Tunnel | Optional | Cloudflare Tunnel, Access, DNS, or Worker proxy | HostGator VPS |

## Domain Portfolio

Primary GoldShore domains:

| Domain | Recommended role |
| --- | --- |
| `goldshore.org` | Business-facing public website domain. Keep mirrored to `goldshore.ai` for now if needed. |
| `goldshore.ai` | AI/product/subscription/service domain for integrations, AI search, account views, and tool surfaces. |
| `api.goldshore.ai` | Public API Worker hostname. |
| `api-preview.goldshore.ai` | API staging/preview Worker hostname. |
| `preview.goldshore.org` | Current website staging/preview hostname. |

Associated business or project domains:

| Domain | Recommended Cloudflare use |
| --- | --- |
| `banproof.me` | Product/marketing site or redirect into the relevant `gs-web` route until it has a dedicated repo. |
| `gearswipe.com` | Product/marketing site or redirect into the relevant `gs-web` route. |
| `tangentmachine.com` | Product/marketing site or redirect into the relevant `gs-web` route. |
| `solefoodny.com` | Business site/email routing candidate; keep mail routing separate from GoldShore API routing. |
| `armsway.com` | Business site/email routing candidate; fix Cloudflare email misconfiguration before production use. |
| `fortune-fund.com` | Finance/project site; use Cloudflare Access for private dashboards. |
| `partnersinpools.com` | Product/business site or redirect into `gs-web`. |
| `rmarston.com` | Personal/profile domain; good candidate for a profile route or static Pages alias. |
| `nickburzo.com` | Personal/profile or collaborator domain; keep ownership and routing explicit. |
| `doyouwanttobeonmypodcast.com` | Campaign/lead-capture site; route forms through `gs-api`. |

Do not attach every domain directly to every Pages project. Pick one owner per hostname:

- Cloudflare Pages custom domains for static/public web surfaces.
- Worker custom domains/routes for API and dynamic edge functions.
- Cloudflare Email Routing or VPS mail for mailbox/SMTP concerns.
- Redirect rules for parked aliases and campaign domains.

## Existing Pages And Workers Reuse

Existing Cloudflare applications should be assigned stable roles:

| Existing project | Recommended use |
| --- | --- |
| `gs-web` Pages | Production website for `goldshore.org` / `goldshore.ai` mirror. |
| `gs-web-staging` Pages | Preview/staging website. |
| `goldshore-api.pages.dev` Pages | Preserve as template archive, internal demo, status page, documentation preview, or redirect-only project. Do not use as production API unless it is intentionally converted and renamed. |
| `gs-api` Worker | Current unified API Worker while still in this monorepo. |
| `gs-api-preview` Worker | API preview/staging Worker. |
| Retired Workers such as `gs-agent`, `gs-admin`, `gs-mail` | Keep only as dashboard artifacts or migration references unless deliberately repurposed behind Access; do not recreate repo app roots for them. |

If an existing Worker or Pages project is repurposed, document the new role here and update the relevant Cloudflare dashboard description. The repo should still remain two-app only unless `goldshore-api` is explicitly extracted.

## HostGator VPS Integration

Use the VPS for capabilities that are expensive, unsupported, or operationally simpler outside Cloudflare:

| Capability | Recommended pattern |
| --- | --- |
| Database workloads not ready for D1/managed storage | Keep the database private on the VPS; expose only narrow APIs through `gs-api` or a protected origin service. |
| Email sending/receiving not covered by Cloudflare Email Routing | Use VPS mail services behind DNS records with explicit SPF/DKIM/DMARC. Do not proxy SMTP/IMAP through orange-cloud DNS. |
| Long-running jobs or server features outside Worker limits | Run on VPS behind Cloudflare Tunnel or Access; trigger through `gs-api` queues/webhooks. |
| Admin-only tools | Protect with Cloudflare Access and avoid public unauthenticated hostnames. |

Recommended public pattern:

- Public traffic enters Cloudflare first.
- `gs-web` serves public pages and lead capture UI.
- `gs-api` handles public API, forms, auth, AI/tool integrations, queue ingress, and Worker-compatible jobs.
- VPS services stay private and are reached through Cloudflare Tunnel, Access-protected hostnames, or server-to-server calls from `gs-api`.
- DNS records for VPS origins should be gray-cloud where the protocol is not HTTP(S), or proxied only when Cloudflare supports the protocol and the origin behavior is intended.

## DNS And Routing Rules

- Do not point Cloudflare-proxied app hostnames at arbitrary origin IPs unless there is a real origin server.
- For Pages custom domains, attach the hostname to the Pages project and let Cloudflare manage the necessary routing/certificates.
- For API-only Worker hostnames, prefer Worker custom domains when the Worker is the origin:
  - `api.goldshore.ai` -> `gs-api` or extracted `goldshore-api`
  - `api-preview.goldshore.ai` -> preview Worker/environment
- Use Worker routes like `api.goldshore.ai/*` only when there is an existing proxied DNS hostname/origin in front of which the Worker should run.
- Cloudflare-proxied DNS returns Cloudflare IPs publicly; that is not the origin IP and should not be copied as an origin target.

## Required Cleanup

1. Pick canonical website domain:
   - Current preference: mirror `goldshore.org` and `goldshore.ai` for now.
   - Longer-term split: `.org` remains the business-facing site; `.ai` becomes AI integrations, tools, subscriptions, services, AI search, account views, and API-adjacent product surfaces.
2. Remove GitHub Pages custom domain from `marzton/goldshore-ai` unless GitHub Pages is intentionally hosting the public site.
3. Remove or update root `CNAME`; it currently conflicts with Cloudflare Pages ownership.
4. Create/attach missing preview hostnames:
   - `api-preview.goldshore.ai`
   - chosen web preview host, likely `preview.goldshore.org` if `.org` remains canonical.
5. Fix `api.goldshore.ai/health` returning `500` before cutting over any extracted `goldshore-api` repo.
6. Update stale docs that mention `gs-admin`, `gs-gateway`, `gs-control`, or `gs-mail` as separate deployable apps unless they refer explicitly to historical/archive state.
7. Assign explicit roles to existing non-deletable Cloudflare projects before attaching additional custom domains.
8. Inventory HostGator VPS IPs, services, mail records, and database ports before adding Cloudflare DNS records.

## GitHub Settings

- Repo URL: `https://github.com/marzton/goldshore-ai`
- GitHub Pages API currently reports:
  - `html_url`: `http://goldshore.ai/`
  - `cname`: `goldshore.ai`
  - `source`: `feat/copper-theme-main` at `/docs`
  - `https_enforced`: `false`
- Recommended action: disable GitHub Pages custom domain for this repo if Cloudflare Pages is authoritative.
