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
