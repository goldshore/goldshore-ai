# Deployment / Routing Audit Report

Date: 2026-05-29

## Scope

- GearSwipe migration/deploy readiness
- Gold Shore API CORS/interoperability
- Route ownership matrix
- Direct health probes
- Service-worker/manifest review status
- Stale worker risk list

## Direct HTTP probe evidence

Probe script: `scripts/deployment-audit.sh`

Environment result: this sandbox cannot resolve external hostnames, so direct probe data is blocked at DNS resolution level.

| URL | Status | Final URL | Redirects | TLS verify | Notes |
| --- | --- | --- | --- | --- | --- |
| `https://goldshore.ai` | `000` | `https://goldshore.ai/` | `0` | `0` | `Could not resolve host` |
| `https://www.goldshore.ai` | `000` | `https://www.goldshore.ai/` | `0` | `0` | `Could not resolve host` |
| `https://goldshore.org` | `000` | `https://goldshore.org/` | `0` | `0` | `Could not resolve host` |
| `https://www.goldshore.org` | `000` | `https://www.goldshore.org/` | `0` | `0` | `Could not resolve host` |
| `https://gearswipe.com` | `000` | `https://gearswipe.com/` | `0` | `0` | `Could not resolve host` |
| `https://www.gearswipe.com` | `000` | `https://www.gearswipe.com/` | `0` | `0` | `Could not resolve host` |
| `https://api.goldshore.ai/health` | `000` | `https://api.goldshore.ai/health` | `0` | `0` | `Could not resolve host` |
| `https://gw.goldshore.ai/health` | `000` | `https://gw.goldshore.ai/health` | `0` | `0` | `Could not resolve host` |
| `https://radar.goldshore.ai` | `000` | `https://radar.goldshore.ai/` | `0` | `0` | `Could not resolve host` |
| `https://goldshore.github.io` | `000` | `https://goldshore.github.io/` | `0` | `0` | `Could not resolve host` |
| `https://goldshore.github.io/apps/risk-radar/` | `000` | `https://goldshore.github.io/apps/risk-radar/` | `0` | `0` | `Could not resolve host` |

## Repo-state interoperability updates completed

- Added canonical domain registry in `packages/shared/src/domain-registry.ts`.
- Added centralized CORS policy helper in `packages/shared/src/cors.ts`.
- Added first-party CORS allowlist including Gold Shore, GearSwipe, rmarston, ArmsWay, BanProof.
- Added API namespace route files in `apps/gs-api/src/routes/`:
  - `health.ts` (already present)
  - `domains.ts`
  - `sites.ts`
  - `forms.ts`
  - `deployments.ts`
  - `gearswipe.ts`
- Added `/version.json` endpoint in `apps/gs-api/src/index.ts` for deployment metadata.

## GearSwipe migration/deploy readiness checklist

- Source-of-truth target documented as GitHub repo `marzton/gearswipe`.
- Production target documented as Cloudflare Pages project `gearswipe`.
- Required redirect documented: `www.gearswipe.com` -> `https://gearswipe.com` (301).
- Required API base documented: `https://api.goldshore.ai`.
- Frontend env contract documented:
  - `VITE_GOLDSHORE_API_BASE=https://api.goldshore.ai` (Vite)
  - `NEXT_PUBLIC_GOLDSHORE_API_BASE=https://api.goldshore.ai` (Next.js)
- Recommended client header documented: `X-Goldshore-Client: gearswipe-web`.

## Cloudflare route ownership reference

See `docs/ROUTE_OWNERSHIP.md` and `docs/DOMAIN_REGISTRY.md`.

## Stale worker / artifact list to verify before deletion

- `goldshore-ai`
- `gs-dynamic-worker`
- `gs-platform`
- `goldshore-web`
- `goldshore-org`

## Service worker / manifest state

Live verification is blocked in this sandbox due DNS resolution failure. Run this in a network-enabled environment per hostname:

- check `/service-worker.js`, `/sw.js`, `/manifest.json`, `/site.webmanifest`
- inspect HTML for `navigator.serviceWorker.register(...)`
- verify cache strategy does not cache HTML/API/admin routes by default

## Remaining manual Cloudflare/Supabase actions

1. Confirm all hostname DNS records and proxy mode in Cloudflare dashboard.
2. Confirm Pages custom-domain bindings and Worker route ownership for each hostname.
3. Enforce `www.gearswipe.com -> https://gearswipe.com` as strict 301.
4. Confirm no production DNS points to `*.picard.replit.dev`.
5. Validate `api.goldshore.ai/health` and `gw.goldshore.ai/health` from an externally connected runner.
6. Apply and verify Supabase migrations in target project.
7. Verify RLS behavior with organization admin/owner/editor/viewer test users.
8. Confirm deployment metadata exposure (`/version.json`) on all web properties.
