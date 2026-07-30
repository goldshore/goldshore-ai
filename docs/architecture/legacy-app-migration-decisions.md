# Legacy app migration decisions

Merge Strategy: Squash

This repository follows the post-consolidation two-app monorepo contract in `AGENTS.md` and `CLAUDE.md`: deployable frontend work belongs in `apps/gs-web`, and deployable backend/runtime work belongs in `apps/gs-api`.

`pnpm-workspace.yaml` therefore includes only the canonical app workspaces, shared packages, and the intentionally retained non-deploy `infra/*` workspace glob.

## Decisions for non-canonical `apps/` entries

| Legacy app | Decision | Rationale / target |
| --- | --- | --- |
| `apps/gs-admin` | Migrate UI into `apps/gs-web` sub-routes before archival. | Admin is a frontend surface; replacement admin UX belongs under a `gs-web` route such as `/admin`. |
| `apps/gs-control` | Migrate runtime tasks into `apps/gs-api` service modules, scheduled handlers, or protected routes before archival. | Control-plane behavior is backend/runtime work and must use the unified API worker. |
| `apps/gs-gateway` | Migrate routing/proxy behavior into `apps/gs-api` routes or middleware before archival. | Gateway responsibilities are backend routing/proxy concerns and must not remain a satellite worker. |
| `apps/gs-platform` | Migrate platform front-door behavior into `apps/gs-api` routes or keep production behavior in the external standalone repository referenced by `CLAUDE.md`; then archive this in-repo legacy copy. | Platform routing is backend runtime behavior, and `CLAUDE.md` notes the production front door is owned outside this repo. |
| `apps/gs-agent` | Migrate AI/agent runtime behavior into `apps/gs-api` service modules and queue handlers before archival. | Heavy or asynchronous AI work belongs in `gs-api` queue handlers, not a separate agent worker. |
| `apps/gs-mail` | Migrate email receiver/webhook behavior into `apps/gs-api` routes and exported event handlers before archival. | Third-party entry points such as mail handlers are explicitly supported from `gs-api/src/index.ts`. |
| `apps/gs-www-redirect` | Replace with `apps/gs-web`/Cloudflare routing configuration or a minimal `apps/gs-api` redirect route before archival. | Redirects are edge routing behavior and do not justify a separate workspace app. |
| `apps/gs-core-worker` | Migrate security/core runtime behavior into `apps/gs-api` queues/routes, or keep it external if still owned by the standalone production repository; then archive this in-repo legacy copy. | `CLAUDE.md` says future security integration must route through `gs-api` and must not create a new worker. |
| `apps/armsway-com` | Archive/delete this in-repo app after confirming domain ownership and deploy responsibility are external or retired. | It is not part of the `goldshore.ai` two-app deploy surface. |
| `apps/banproof-me` | Migrate banproof/security logic into `apps/gs-api` queues/routes, or keep production behavior in the external standalone repository referenced by `CLAUDE.md`; then archive this in-repo legacy copy. | Security/ban-check behavior is backend runtime work and should not be a separate in-repo worker. |
| `apps/gs-trading` | Migrate trading routes, agents, broker adapters, and paper-trading runtime behavior into `apps/gs-api` routes/services/queues before archival. | Trading behavior is backend runtime work and belongs in the unified API worker. |

## Production deploy dependency check

The canonical production deploy workflows for this repo are `deploy-gs-web.yml` and `deploy-gs-api.yml`. Legacy deploy workflows that targeted removed app workspaces have been retired in this cleanup. Until each runtime/UI migration above is complete, the legacy directories remain in the tree as source archives, but they are no longer pnpm workspaces and must not be treated as deployable monorepo apps.
