# Google Business Profile integration specification

**Status:** write-disabled pending human verification
**Runtime owner:** `apps/gs-api`
**Last repository review:** 2026-08-09

This is the deployment contract for the Google Business Profile integration. Console-only facts are deliberately marked **unverified** rather than inferred from an OAuth client ID or an old planning note. An operator must attach dated Google Cloud Console and Business Profile Manager evidence to the deployment change before changing either write gate to `true`.

## Google Cloud and OAuth inventory

| Item | Required value / repository evidence | Verification status |
| --- | --- | --- |
| Google Cloud project display name | `goldshore` (historical repository record) | **Unverified in Google Cloud Console** |
| Google Cloud project ID | Record the exact immutable project ID here after console verification | **Unknown / deployment blocker** |
| Google Cloud project number | `1054833139648` is inferred from the configured OAuth client ID and must not be treated as proof of project ownership | **Unverified** |
| OAuth client type | Web application | **Unverified in console** |
| OAuth consent publishing status | Production / In production | **Not verified; writes remain disabled** |
| App verification | Google verification completed for the requested sensitive/restricted scopes, if Google requires it | **Not verified** |
| Verified domains | `goldshore.ai`; `goldshore.org` only if shown on the consent screen | **Not verified** |
| Production redirect URI | `https://api.goldshore.ai/admin/google/oauth/callback` | Declared in `wrangler.toml`; must be an exact console entry |
| Preview redirect URI | `https://api-preview.goldshore.ai/admin/google/oauth/callback` | Declared in `wrangler.toml`; must be an exact console entry |

Redirect URIs are environment-specific and compared byte-for-byte by the Worker. Do not use wildcards, a user-provided redirect, or a fallback derived from an untrusted host. Preview and production should use separate OAuth clients when operationally possible; if the current shared client is retained, both exact URIs must be registered.

## Enabled Business Profile APIs

The owning project must have all APIs needed by the allowlisted operation set enabled. Record the console enablement date and verifier for each item before deployment.

| Google service | Service name | Used for | Status |
| --- | --- | --- | --- |
| Business Profile Account Management API | `mybusinessaccountmanagement.googleapis.com` | Account reads and account management | **Unverified** |
| Business Profile Business Information API | `mybusinessbusinessinformation.googleapis.com` | Location reads and management | **Unverified** |
| My Business API v4 | `mybusiness.googleapis.com` | Local-post publishing and review reads/replies in the current adapter | **Unverified** |
| Business Profile Performance API | `businessprofileperformance.googleapis.com` | Performance reads (not exposed until separately allowlisted) | **Unverified / not currently exposed** |

No endpoint may be added merely because an API is enabled. It must also be explicitly allowlisted in code, mapped to a distinct local RBAC permission, and covered by audit logging.

## Scopes and permissions

The integration requests only:

```text
https://www.googleapis.com/auth/business.manage
```

Google exposes Business Profile management through this broad scope, so local RBAC supplies the least-privilege boundary that the provider scope does not. The API separates these local permissions:

| Local permission | Allowed class |
| --- | --- |
| `google-business:read` | Account, location, and review reads |
| `google-business:publish` | Local-post publishing |
| `google-business:locations:manage` | Location mutations |
| `google-business:reviews:manage` | Review replies/management |
| `google-business:accounts:manage` | OAuth connection/revocation and account mutations |

Only the `admin` role receives these permissions by default. Every request must satisfy both its local permission and the granted Google scope. Write classes additionally require `GOOGLE_BUSINESS_OWNERSHIP_VERIFIED=true` and `GOOGLE_OAUTH_PRODUCTION_APPROVED=true`; both default to `false` in every deployed manifest.

## Quota ownership

The Google Cloud project identified above owns and is billed for API quota. Quota increases, quota-user attribution, and abuse remediation belong to the Gold Shore Google Cloud project owner; they must not be shifted to a customer project implicitly. Record the responsible Google Cloud IAM principal/group and approved limits here after verification:

- **Quota owner IAM principal/group:** unknown — human action required.
- **Approved per-API quota and alert thresholds:** unknown — human action required.
- **Operational owner:** Gold Shore platform administrator (named owner required before writes).

## Authorized Business Profile targets

Provider authorization alone is insufficient. `GOOGLE_BUSINESS_ACCOUNT_IDS` and `GOOGLE_BUSINESS_LOCATION_IDS` are comma-separated Worker configuration values containing only targets whose ownership was manually verified. They are intentionally unset until verification.

| Target | Authorized ID | Ownership evidence | Status |
| --- | --- | --- | --- |
| Business Profile account | None recorded | Add Business Profile Manager screenshot/audit reference, verifier, and date | **No account authorized** |
| Business Profile location | None recorded | Add location ownership screenshot/audit reference, verifier, and date | **No location authorized** |

Never place access tokens, refresh tokens, client secrets, or private ownership evidence in this document. Client secrets and the token-encryption key are Worker secrets. Provider tokens are AES-GCM encrypted before storage in `PLATFORM_DB`; KV contains only single-use OAuth state and PKCE verifier data with a ten-minute TTL.

## OAuth and lifecycle controls

1. An authenticated administrator starts authorization. The Worker generates 256-bit random state and a random PKCE verifier, stores them for ten minutes, and sends an S256 challenge.
2. The callback consumes state before token exchange, rejects expired state and any redirect mismatch, then exchanges the code using the exact stored redirect and verifier.
3. Tokens are encrypted at rest in D1. No provider token is stored in plain KV or returned by status/administrative responses.
4. An expiring access token is refreshed server-side. If Google returns a replacement refresh token, the encrypted record is atomically replaced; otherwise the existing refresh token is retained.
5. Revocation calls Google's revocation endpoint and tombstones the local credential. Reauthorization is required afterward.
6. Every provider operation records actor, account/location target, requested operation, Google request ID when returned, HTTP result, and outcome in `AUDIT_DB`.

## Human enablement checklist

- [ ] Confirm immutable project ID and project number in Google Cloud Console.
- [ ] Confirm every required API is enabled in that same project.
- [ ] Confirm consent is published to production and any required Google app verification is complete.
- [ ] Confirm both exact redirect URIs on the intended OAuth client(s).
- [ ] Confirm consent-screen verified domains.
- [ ] Name the quota owner and configure quota alerts.
- [ ] Verify Business Profile ownership and record authorized account/location IDs.
- [ ] Set the ID allowlists using deployment configuration or secrets-management procedure.
- [ ] After two-person review, set both write gates to `true` in the target environment and retain the approval evidence.

Before deploying the route, apply `db/migrations/0005_google_business_integration.sql` to `PLATFORM_DB` and `db/audit-migrations/0001_google_business_audit.sql` explicitly to `AUDIT_DB`. Verify both tables exist remotely before starting OAuth; do not silently fall back to KV if either database is unavailable.
