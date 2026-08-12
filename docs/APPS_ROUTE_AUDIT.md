# Applications and Cloudflare Route Audit

Audited: 2026-08-12

This is a repository-intent audit. It does not assert that a route, Worker,
Pages project, DNS record, or binding exists in the live Cloudflare account.
Live state must be verified separately in the Cloudflare dashboard before a
legacy service is removed.

## Canonical GoldShore applications

| Application | UI pages | Cloudflare ownership |
| --- | ---: | --- |
| `apps/gs-web` | 108 Astro route files at audit time | `goldshore.ai`, `goldshore.org`, both `www` hosts, both production admin hosts, risk hosts, and the `.ai` preview/admin-preview hosts |
| `apps/gs-api` | 0 Astro route files | API plus agent, mail, ops, trading, dashboard, dash, and gateway aliases; `.ai` API preview |

`gs-web` is an Astro SSR Worker with Static Assets, not a Cloudflare Pages
project. Public pages and the protected `/app` and `/admin` route trees belong
there. `admin.goldshore.ai` and `admin.goldshore.org` both resolve through the
same middleware and their `/` route redirects to `/app/dashboard`.

`gs-api` is the only canonical backend Worker. Mail handlers, queues, cron,
authentication-backed operations, integrations, storage, and API middleware
must be mounted there instead of reviving a satellite Worker.

## Retained source directories

| Directory | Repository route declaration | Audit classification |
| --- | --- | --- |
| `apps/armsway-com` | `armsway.com`, `www.armsway.com` | Standalone external product source; outside the GoldShore two-app workspace |
| `apps/banproof-me` | `banproof.me`, `www.banproof.me` | Standalone external product source; outside the GoldShore two-app workspace |
| `apps/goldclaw` | None | Integration source only; its HTTP API is mounted under `gs-api` |
| `apps/gs-agent` | Empty route arrays | Retired satellite backend; no canonical hostname ownership |
| `apps/gs-control` | Empty route arrays | Retired satellite backend; build-token name does not make it a production app |
| `apps/gs-core-worker` | None | Legacy source with no repository route declaration |
| `apps/gs-gateway` | Empty route arrays | Retired satellite backend; gateway aliases belong to `gs-api` |
| `apps/gs-mail` | None | Retired satellite backend; email handling belongs to `gs-api` |
| `apps/gs-platform` | Empty route arrays | Legacy service-binding source only |
| `apps/gs-trading` | Empty route arrays | Retired satellite backend; trading aliases belong to `gs-api` |
| `apps/gs-www-redirect` | Both `www.goldshore.*` hosts | Route conflict: `gs-web` also owns these hosts under the canonical contract |

None of these directories contains an Astro `src/pages` tree. Their presence
must not be interpreted as evidence that a website or admin page exists.

## Findings and follow-up

1. All visual GoldShore page files currently live in `apps/gs-web`; no
   `apps/gs-admin` page tree exists.
2. The repaired shared navigation contract has a unit test that fails when a
   main-header or footer destination lacks a concrete Astro route.
3. Compatibility routes now preserve old admin bookmarks for domains, leads,
   Meta, Stripe, and Zapier while directing them to the consolidated pages.
4. `apps/gs-www-redirect` duplicates the canonical `www` route ownership in
   `apps/gs-web`. Verify live traffic and redirect behavior in the dashboard,
   then remove the legacy Worker route declaration in a separate narrow change.
5. Treat the remaining `gs-*` satellite directories as migration sources until
   their required handlers are proven present in `gs-api`; do not deploy them
   or add new deploy workflows.
6. After merging repository repairs, verify dashboard custom routes for both
   admin TLDs point to `gs-web-prod`, confirm Cloudflare Access covers both,
   and only then retire any live `gs-admin` Pages project or Worker.
