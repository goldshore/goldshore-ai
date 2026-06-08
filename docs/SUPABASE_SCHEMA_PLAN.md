# Supabase Schema Plan

Last updated: 2026-05-29

## Scope

This schema supports Gold Shore's managed website platform, domain registry, deployment audits, and shared API client trust.

## Migration files

- `supabase/migrations/0001_core_identity.sql`
- `supabase/migrations/0002_domain_registry.sql`
- `supabase/migrations/0003_sites_cms.sql`
- `supabase/migrations/0004_forms_leads_assets.sql`
- `supabase/migrations/0005_deployments_pipelines.sql`
- `supabase/migrations/0006_api_clients_integrations.sql`
- `supabase/migrations/0007_audit_logs_rls.sql`

## Required entities covered

- organizations
- profiles
- domains
- dns_records
- sites
- site_pages
- page_revisions
- content_blocks
- assets
- forms
- form_submissions
- leads
- deployments
- deployment_checks
- api_clients
- api_keys (hashed only)
- integrations
- pipelines
- pipeline_runs
- pipeline_steps
- webhooks
- audit_logs

## RLS model

- RLS enabled on all platform tables.
- Gold Shore admin can manage all org data.
- Organization owner/editor can manage org-owned records.
- Organization viewer gets read-only access.
- Public has no direct table read access except explicit public-safe view (`public_domain_health`) and controlled submission endpoints.

## Security notes

- Do not expose `service_role` keys to frontend apps.
- Keep API key material hashed (`api_keys.key_hash`) and only show prefixes.
- CORS is not auth; protected endpoints still require auth/trust checks.
