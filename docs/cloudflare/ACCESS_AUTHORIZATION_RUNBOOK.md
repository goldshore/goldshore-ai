# Cloudflare Access and application authorization

The desired state is `infra/cloudflare/access-apps.desired.json`. It defines four
independent Access applications and audience tags: production admin, preview
admin, production API, and production machine-to-machine service access.

## Identity providers

Create distinct GitHub and Google OAuth applications for production and preview.
Store every client secret in Cloudflare; do not commit it. Configure only the two
production IdPs on production applications and only the two preview IdPs on the
preview application. One-time PIN is intentionally **not permitted**.

## Owner policy

The owner allow policy contains exactly `marstonr6@gmail.com` and
`admin@goldshore.org`. Do not add `email_domain` rules. If workforce access is
needed, create a later, lower-privilege policy and map each admitted employee to
an internal role independently.

## Defense in depth

Apply `apps/gs-api/db/migrations/0005_access_authorization.sql` to `PLATFORM_DB`
before deploying. Each protected request must pass Access JWT issuer, audience,
signature and expiration validation, present an Access-signed IdP email (and
must not contain `email_verified: false` when that optional claim is emitted), and
resolve to an active user plus a role for the current application. Access edge
admission alone is never authorization.

Audience values are not interchangeable. Copy the audience generated for each
application into only its matching Wrangler environment variable. Provision the
service application and token separately; browser IdPs and one-time PIN must not
be enabled for it.
