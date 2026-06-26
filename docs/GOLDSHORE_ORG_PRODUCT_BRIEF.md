# Goldshore.org Product Brief

Last updated: 2026-05-29

## Product role

`goldshore.org` is the business-facing website management platform under Gold Shore control.

`goldshore.ai` remains the technical/lab/API brand layer.

## Product direction

Gold Shore provides managed website infrastructure for businesses across domains, pages, forms, analytics, AI-assisted content, deployment status, and operational support from one controlled platform.

## Core capabilities

- Managed business websites
- Client dashboard and account views
- Page/content editor and reusable templates
- Domain and DNS tracking
- Contact forms, submissions, and lead inbox
- Analytics summaries
- Asset/media library
- Deployment status and checks
- Client approvals and revision history
- SEO metadata management
- Business profile and service-request intake

## Operating model

- GitHub repositories are source control and CI.
- Cloudflare hosts production Pages/Workers and DNS.
- Supabase stores platform entities and operational logs with RLS.
- Shared API entrypoint remains `https://api.goldshore.ai`.
