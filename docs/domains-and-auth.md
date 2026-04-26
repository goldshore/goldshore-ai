# Domains and Auth (Cloudflare Access)

## Scope

This document captures the Cloudflare Access applications and policies that protect GoldShore Pages deployments, including preview domains for web and admin.

## Access applications and policies

| Access application      | Policy name           | Domain coverage                                                                                                                                             | Notes                                                                                                                                                                                     |
| ----------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GoldShore Admin         | GoldShore-Admin-ZT    | `admin.goldshore.ai`, `admin-preview.goldshore.ai`, `*-preview.goldshore.ai` (admin preview branches), `{branch}.goldshore-pages.dev` (admin preview pages) | Admin cockpit is protected by Access with an email allowlist + identity provider requirement. Preview domains should be attached to the same application to match production enforcement. |
| GoldShore Web (Preview) | GoldShore-Web-Preview | `preview.goldshore.ai`, `*-preview.goldshore.ai` (web preview branches), `{branch}.goldshore-pages.dev` (web preview pages)                                 | Web production (`goldshore.ai`, `www.goldshore.ai`) is public, but preview domains must be gated behind Access.                                                                           |

## Identity providers and session policy alignment

Preview applications should mirror production configuration wherever Access is enforced:

- **Identity providers:** Use the same IdPs as production (currently the admin Access policy requires GitHub as the identity provider).
- **Session policy:** Keep session duration, re-authentication, and device posture requirements aligned with production to avoid preview-only auth drift.

## Source-of-truth references

- Cloudflare desired state for Access policy naming and domain ownership lives in `infra/Cloudflare/desired-state.yaml`.
- Pages custom domains for admin and web are documented in `infra/Cloudflare/BINDINGS_MAP.md`.
- Runtime smoke-check URLs for Pages deployments are configured in `infra/Cloudflare/config.yaml` via `public_url`.

# Domains & Auth (Single Source of Truth)

This document is the canonical reference for GoldShore domains, preview URLs, Cloudflare Access policy coverage, and GitHub App callback endpoints.

## Production domains

- `goldshore.ai`
- `api.goldshore.ai`
- `gw.goldshore.ai` (canonical gateway hostname; not `gateway.goldshore.ai`)
- `ops.goldshore.ai`

## Preview domains

- `*-preview.goldshore.ai`
- `{branch}.goldshore-pages.dev`

## Cloudflare Access policies

Cloudflare Access is enforced on internal tooling and protected previews. The table below captures the Access policy names and the domains they protect.

| Access application | Policy name                                                                                                  | Domains protected           | Notes                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| Public web         | `goldshore.ai`, `www.goldshore.ai`                                                                           | No                          | Public marketing site.                                                                                |
| Web previews       | `preview.goldshore.ai`, `*-preview.goldshore.ai`, `{branch}.goldshore-pages.dev`                             | Yes (GoldShore-Web-Preview) | Preview builds for the marketing site should remain Access gated.                                     |
| Admin cockpit      | `admin.goldshore.ai`, `admin-preview.goldshore.ai`, `*-preview.goldshore.ai`, `{branch}.goldshore-pages.dev` | Yes (GoldShore-Admin-ZT)    | Internal admin dashboard, email allowlist + IdP/OTP.                                                  |
| Control worker     | `ops.goldshore.ai`                                                                                           | Yes                         | Internal ops workflows and automation.                                                                |
| API worker         | `api.goldshore.ai`                                                                                           | Optional                    | Enable for private endpoints only.                                                                    |
| Gateway worker     | `gw.goldshore.ai`                                                                                            | Optional                    | Canonical hostname is `gw.goldshore.ai` (not `gateway.goldshore.ai`); depends on routing/auth design. |
| Mail handler       | `mail.goldshore.ai`                                                                                          | No                          | Cloudflare mail routing cannot authenticate.                                                          |

## Cloudflare Access service-token handling

Non-interactive checks against Access-protected admin and preview hosts must use a Cloudflare Access service token instead of assuming anonymous reachability.

- GitHub Actions and local automation should provide `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`.
- `.github/workflows/maintenance-gs-sync.yml` passes those secrets into `scripts/jules-sync.sh` for authenticated sync checks.
- `infra/Cloudflare/tests.ts` automatically attaches the service-token headers for `admin.goldshore.ai` and `*.pages.dev` smoke checks when those environment variables are present.
- Keep the Pages runtime URLs aligned with the `.ai` migration by setting explicit `public_url` values for `gs-web` and `gs-admin` in `infra/Cloudflare/config.yaml`.

### Mail handler configuration

The `gs-mail` worker supports:

- **Sender blocking**: via `MAIL_BLOCKED_SENDERS` (comma-separated list).
- **Recipient allowlisting**: via `MAIL_ALLOWED_RECIPIENTS` (comma-separated list). If this variable is set, only emails addressed to these recipients will be processed and forwarded; all others will be rejected.
- **Forwarding**: to a single target defined in `MAIL_FORWARD_TO`.

Note: If `/health` and `/version` endpoints are used for automated monitoring, they must be explicitly exempted from Cloudflare Managed Challenges or WAF rules to avoid 403 errors during non-interactive probing.

## GitHub App callback URLs

- Production: `https://ops.goldshore.ai/auth/github/callback`
- Preview (ops worker): `https://ops-preview.goldshore.ai/auth/github/callback`
- Preview (admin cockpit): `https://admin-preview.goldshore.ai/auth/github/callback`
- Preview (web Pages branches): `https://{branch}.goldshore-pages.dev/auth/github/callback`

### Access + edge proxy alignment

When adding preview callback URLs in GitHub App settings, ensure the same hostnames are:

- Included in the Cloudflare Access application allowlist when Access is enforced for previews.
- Routed through any edge proxy rules so the callback path (`/auth/github/callback`) resolves to the expected worker/service.

### Cloudflare Access OIDC callback (GitHub IdP)

- `https://goldshore.cloudflareaccess.com/cdn-cgi/access/sso/oidc/1eae8b45326b57d6fd150609e9d155d724013960fd0b994de2d56f07d3f0ce5f`

Use this exact callback URL in the GitHub OAuth app configuration used by Cloudflare Access. If this endpoint changes, update both the GitHub OAuth app and Cloudflare Access IdP configuration together to avoid login failures.
