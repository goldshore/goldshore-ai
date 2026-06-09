# Platform Pipelines

Last updated: 2026-05-29

## Canonical pipelines

| Pipeline | Purpose | Inputs | Output |
| --- | --- | --- | --- |
| `domain-audit` | Validate DNS, routes, redirects, TLS, stale records | domain registry + HTTP probes + Cloudflare metadata | ownership and drift report |
| `deployment-audit` | Verify latest Pages/Worker deployment state, failed builds, and commit drift | GitHub Actions + Cloudflare deployment data | deployment status matrix |
| `site-publish` | Publish approved site/page revisions | `site_pages`, `page_revisions`, content blocks | updated production site state |
| `asset-sync` | Sync uploaded media to managed storage | `assets` metadata + object storage events | normalized media availability |
| `lead-routing` | Convert form submissions to leads and notifications | `form_submissions` | `leads`, notifications, audit entries |
| `api-health` | Check API uptime and namespace compatibility | `/health` and `/v1/*` probes | service health report |
| `service-worker-audit` | Detect stale service workers/manifests and cache risk | live app HTML/assets | PWA/cache risk findings |
| `supabase-schema-check` | Verify migrations, RLS, indexes, and policy coverage | migration SQL + database introspection | schema compliance report |
| `client-site-onboarding` | Provision org/site/domain defaults for new customer | org profile + domain/site config | initialized managed site workspace |
