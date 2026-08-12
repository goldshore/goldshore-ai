# Domain Ownership

Last updated: 2026-08-09

Current code, `pnpm-workspace.yaml`, and app-local Wrangler manifests are the
authority. Gold Shore has two deployable applications: `gs-web` and `gs-api`.

## Canonical owners

| Domain / route          | Owner         | Cloudflare type             | Purpose                                         |
| ----------------------- | ------------- | --------------------------- | ----------------------------------------------- |
| `goldshore.ai/*`        | `gs-web-prod` | Worker with Assets          | Public website                                  |
| `goldshore.org/*`       | `gs-web-prod` | Worker with Assets          | Public website alias                            |
| `admin.goldshore.ai/*`  | `gs-web-prod` | Worker with Assets + Access | Admin UI                                        |
| `admin.goldshore.org/*` | `gs-web-prod` | Worker with Assets + Access | Admin UI alias                                  |
| `api.goldshore.ai/*`    | `gs-api-prod` | Worker                      | API, auth, jobs, queues, mail, and integrations |

The four web hosts are routes on the same `env.prod` deployment declared in
`apps/gs-web/wrangler.toml`. They are not separate projects or releases.

## Rules

1. One hostname or wildcard route has one owner.
2. `gs-web` is one Astro SSR Worker-with-Assets deployment for public, admin,
   and docs UI; it is not also deployed as a static site.
3. All backend and server integration work belongs in `gs-api`.
4. Reference manifests under `infra/Cloudflare/` must remain aligned with the
   deployable app manifests.
5. Verify live Cloudflare ownership before deleting any legacy resource.

## Deployment source of truth

```text
apps/gs-web/astro.config.mjs
apps/gs-web/src/worker.ts
apps/gs-web/wrangler.toml
apps/gs-api/wrangler.toml
.github/workflows/deploy-gs-web.yml
.github/workflows/deploy-gs-api.yml
```

## Future Pages migration

A future move of `gs-web` to Cloudflare Pages is an explicit architecture
change, not a parallel deployment. It requires every dynamic web endpoint,
auth callback, form/search handler, admin endpoint, and SSR/catch-all route to
move into `gs-api` first. The Worker-with-Assets release and its four routes may
only be replaced after that prerequisite is complete.
