# Routing & Access Policy

This document defines the routing and access policy for GoldShore properties. It clarifies which routes are public-facing and which require authentication via Cloudflare Access or application middleware.

## Public routes (no authentication required)

Public routes are marketing- or engagement-focused and should remain accessible without authentication. Examples include:

- Marketing pages (home, about, pricing, legal)
- Contact flows (contact form, support entry points)
- Engagement content (campaign landing pages, newsletters, announcements)
- Risk-radar demo experiences (public demo/preview routes)

## Private routes (authentication required)

Private routes are restricted to staff or authenticated users and must be protected by Cloudflare Access and/or application middleware.

- Admin interfaces (all `/admin/*` sections)
- Internal dashboards (staff-only or authenticated user portals)
- Operational tooling (logs, workflow controls, user management)

## Enforcement

Private routes must enforce access at the edge or application layer:

- **Cloudflare Access config**: Configure Access policies to require identity verification for private route paths and preview environments.
- **Application middleware**: Ensure SSR middleware or edge handlers validate sessions before serving private content.
- **Service-token automation**: For synthetic checks and maintenance jobs that must reach Access-protected hosts, use Cloudflare Access service-token headers (`CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`) rather than weakening the Access policy.

When introducing new routes, update this policy and ensure enforcement is in place before deployment.
