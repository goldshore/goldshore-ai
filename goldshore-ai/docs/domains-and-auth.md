# Domains and Auth (Cloudflare Access)

## Scope

This document captures the Cloudflare Access applications and policies that protect GoldShore Pages deployments, including preview domains for web and admin.

## Access applications and policies

| Access application | Policy name | Domain coverage | Notes |
| --- | --- | --- | --- |
| GoldShore Admin | GoldShore-Admin-ZT | `admin.goldshore.ai`, `admin-preview.goldshore.ai`, `*-preview.goldshore.ai` (admin preview branches), `{branch}.goldshore-pages.dev` (admin preview pages) | Admin cockpit is protected by Access with an email allowlist + identity provider requirement. Preview domains should be attached to the same application to match production enforcement. |
| GoldShore Web (Preview) | GoldShore-Web-Preview | `preview.goldshore.ai`, `*-preview.goldshore.ai` (web preview branches), `{branch}.goldshore-pages.dev` (web preview pages) | Web production (`goldshore.ai`, `www.goldshore.ai`) is public, but preview domains must be gated behind Access. |

## Identity providers and session policy alignment

Preview applications should mirror production configuration wherever Access is enforced:

- **Identity providers:** Use the same IdPs as production (currently the admin Access policy requires GitHub as the identity provider).
- **Session policy:** Keep session duration, re-authentication, and device posture requirements aligned with production to avoid preview-only auth drift.

## Source-of-truth references

- Cloudflare desired state for Access policy naming and domain ownership lives in `infra/cloudflare/desired-state.yaml`.
- Pages custom domains for admin and web are documented in `infra/cloudflare/BINDINGS_MAP.md`.
# Domains & Auth (Single Source of Truth)

This document is the canonical reference for GoldShore domains, preview URLs, Cloudflare Access policy coverage, and GitHub App callback endpoints.

## Production domains

- `goldshore.ai`
- `api.goldshore.ai`
- `gw.goldshore.ai`
- `ops.goldshore.ai`

## Preview domains

- `*-preview.goldshore.ai`
- `{branch}.goldshore-pages.dev`

## Cloudflare Access policies

Cloudflare Access is enforced on internal tooling and protected previews. The table below captures the Access policy names and the domains they protect.

| Access application | Policy name | Domains protected | Notes |
| --- | --- | --- | --- |
| Public web | `goldshore.ai`, `www.goldshore.ai` | No | Public marketing site. |
| Web previews | `preview.goldshore.ai`, `*-preview.goldshore.ai`, `{branch}.goldshore-pages.dev` | Yes (GoldShore-Web-Preview) | Preview builds for the marketing site should remain Access gated. |
| Admin cockpit | `admin.goldshore.ai`, `admin-preview.goldshore.ai`, `*-preview.goldshore.ai`, `{branch}.goldshore-pages.dev` | Yes (GoldShore-Admin-ZT) | Internal admin dashboard, email allowlist + IdP/OTP. |
| Control worker | `ops.goldshore.ai` | Yes | Internal ops workflows and automation. |
| API worker | `api.goldshore.ai` | Optional | Enable for private endpoints only. |
| Gateway worker | `gw.goldshore.ai` | Optional | Depends on routing/auth design. |
| Mail handler | `mail.goldshore.ai` | No | Cloudflare mail routing cannot authenticate. |

## GitHub App callback URLs

- Production: `https://ops.goldshore.ai/auth/github/callback`
- Preview (ops worker): `https://ops-preview.goldshore.ai/auth/github/callback`
- Preview (admin cockpit): `https://admin-preview.goldshore.ai/auth/github/callback`
- Preview (web Pages branches): `https://{branch}.goldshore-pages.dev/auth/github/callback`

### Access + edge proxy alignment

When adding preview callback URLs in GitHub App settings, ensure the same hostnames are:

- Included in the Cloudflare Access application allowlist when Access is enforced for previews.
- Routed through any edge proxy rules so the callback path (`/auth/github/callback`) resolves to the expected worker/service.
