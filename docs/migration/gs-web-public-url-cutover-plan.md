# Future gs-web Pages migration gate

`apps/gs-web` currently deploys only as the `gs-web-prod` Astro SSR Cloudflare
Worker with Assets. A Pages deployment must not be introduced beside it.

A future Pages migration is an explicit architecture change and is blocked until:

1. Every dynamic route in `apps/gs-web` is inventoried.
2. Forms, search, auth callbacks, admin endpoints, catch-all rendering, and all
   other request-time behavior move into `apps/gs-api`.
3. Browser callers use the corresponding `gs-api` endpoints.
4. The Worker routes for `goldshore.ai`, `goldshore.org`, `admin.goldshore.ai`,
   and `admin.goldshore.org` can be cut over atomically to one static release.
5. CI and infrastructure guards are intentionally updated in the same PR.

Until all gates pass, `apps/gs-web/wrangler.toml` and the Cloudflare Workers Build
integration remain the only production deployment path.
