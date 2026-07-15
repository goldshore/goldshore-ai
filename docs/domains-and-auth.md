# Domains and Auth (Cloudflare Access)

## Scope

This document captures the Cloudflare Access applications and policies that protect GoldShore Pages deployments, including preview domains for web and admin.

## Access applications and policies

| Access application      | Policy name           | Domain coverage                                                                                                                                             | Notes                                                                                                                                                                                     |
| ----------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GoldShore Admin         | GoldShore-Admin-ZT    | `admin.goldshore.ai`, `admin.goldshore.org`, `admin-preview.goldshore.ai`, `*-preview.goldshore.ai` (admin preview branches), `{branch}.goldshore-pages.dev` (admin preview pages) | Admin cockpit is protected by Access with an email allowlist + identity provider requirement. Preview domains should be attached to the same application to match production enforcement. |
| GoldShore Trading       | GoldShore-Trading-ZT  | `trading.goldshore.ai`, `dashboard.goldshore.ai`, `dash.goldshore.ai`                                                                                       | Trading/dashboard surfaces are protected by Access. Broker OAuth callback paths are explicitly bypassed so providers can complete redirects without an Access session.                    |
| GoldShore MCP           | GoldShore-MCP-ZT      | `mcp.goldshore.ai`                                                                                                                                                                  | Private MCP surface. Allow only approved human identities and a dedicated service identity path for approved agents.                                                                      |
| GoldShore Web (Preview) | GoldShore-Web-Preview | `preview.goldshore.ai`, `*-preview.goldshore.ai` (web preview branches), `{branch}.goldshore-pages.dev` (web preview pages)                                 | Web production (`goldshore.ai`, `www.goldshore.ai`) is public, but preview domains must be gated behind Access.                                                                           |

## Identity providers and session policy alignment

Preview applications should mirror production configuration wherever Access is enforced:

- **Identity providers:** Use the canonical IdP matrix below for every protected application; do not restate per-app IdP decisions in downstream runbooks.
- **Session policy:** Keep session duration, re-authentication, and device posture requirements aligned with production to avoid preview-only auth drift.

## Source-of-truth references

- Cloudflare desired state for Access policy naming and domain ownership lives in `infra/Cloudflare/desired-state.yaml`.
- Pages custom domains for admin and web are documented in `infra/Cloudflare/BINDINGS_MAP.md`.
- Runtime smoke-check URLs for Pages deployments are configured in `infra/Cloudflare/config.yaml` via `public_url`.

# Domains & Auth (Single Source of Truth)

This document is the canonical reference for GoldShore domains, preview URLs, Cloudflare Access policy coverage, and GitHub App callback endpoints.

## Production domains

- `goldshore.ai` (canonical public web hostname)
- `www.goldshore.ai` (redirect → goldshore.ai)
- `goldshore.org` (redirect → goldshore.ai until org-specific content is ready)
- `www.goldshore.org` (redirect → goldshore.ai)
- `api.goldshore.ai`
- `gw.goldshore.ai` (canonical gateway hostname; not `gateway.goldshore.ai`)
- `ops.goldshore.ai`
- `admin.goldshore.ai`
- `admin.goldshore.org` (protected admin alias; gs-admin Pages)
- `trading.goldshore.ai`
- `dashboard.goldshore.ai` (protected trading dashboard alias)
- `dash.goldshore.ai` (short protected trading dashboard alias)
- `mail.goldshore.ai`

## Preview domains

- `*-preview.goldshore.ai`
- `{branch}.goldshore-pages.dev`

## `goldshore.ai` domain layout

The table below is the canonical public layout for customer-facing web routes on the
`goldshore.ai` domain family.

| Host | Route | Purpose | Access |
| --- | --- | --- | --- |
| `goldshore.ai` | `/` | Primary marketing homepage | Public |
| `goldshore.ai` | `/apps/risk-radar` | Risk Radar product/detail page with the reusable animated system component | Public |
| `goldshore.ai` | `/developer`, `/developer/docs/*`, `/developer/api/*` | Developer hub, docs, and API reference | Public |
| `www.goldshore.ai` | `/*` | Redirects → goldshore.ai (308, method-preserving, via gs-www-redirect) | Public |
| `goldshore.org`, `www.goldshore.org` | `/*` | Redirects → goldshore.ai (308, via goldshore-org Worker) until org content is ready | Public |
| `preview.goldshore.ai` and `*-preview.goldshore.ai` | `/*` | Preview deployments for web validation | Cloudflare Access (GoldShore-Web-Preview) |
| `admin.goldshore.org` | `/*` | Protected admin alias hosted by `gs-admin` Pages | Cloudflare Access (GoldShore-Admin-ZT) |
| `trading.goldshore.ai`, `dashboard.goldshore.ai`, `dash.goldshore.ai` | `/*` | Protected trading dashboard and dashboard aliases | Cloudflare Access (GoldShore-Trading-ZT) |

## Canonical redirect policy

**Canonical hostname: `goldshore.ai`.** All other public hostnames redirect to it.

- `www.goldshore.ai/*` → `https://goldshore.ai/$1` (308, method-preserving) — handled by `gs-www-redirect` Worker
- `goldshore.org/*` → `https://goldshore.ai/$1` (308) — handled by `goldshore-org` Worker (placeholder until org content is ready)
- `www.goldshore.org/*` → `https://goldshore.ai/$1` (308) — handled by `goldshore-org` Worker

When org-specific content is ready, replace the `goldshore-org` Worker with its own Pages/app and remove these redirects.

This ordering prevents temporary inactive-domain states while SSL and DNS records converge.

## Cloudflare Access policies

Cloudflare Access is enforced on internal tooling and protected previews. The table below captures the Access policy names and the domains they protect.

| Access application | Policy name                                                                                                  | Domains protected           | Notes                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| Public web         | `goldshore.ai`, `www.goldshore.ai`                                                                           | No                          | Public marketing site.                                                                                |
| Risk Radar page    | `goldshore.ai/apps/risk-radar`, `www.goldshore.ai/apps/risk-radar`                                          | No                          | Public Risk Radar experience and demo surface on the web domain family.                              |
| Web previews       | `preview.goldshore.ai`, `*-preview.goldshore.ai`, `{branch}.goldshore-pages.dev`                             | Yes (GoldShore-Web-Preview) | Preview builds for the marketing site should remain Access gated.                                     |
| Admin cockpit      | `admin.goldshore.ai`, `admin.goldshore.org`, `admin-preview.goldshore.ai`, `*-preview.goldshore.ai`, `{branch}.goldshore-pages.dev` | Yes (GoldShore-Admin-ZT)    | Internal admin dashboard, email allowlist + IdP/OTP. The `.org` admin hostname is canonical only as a protected admin alias and must stay on the same Access application as `admin.goldshore.ai`. |
| Trading dashboard  | `trading.goldshore.ai`, `dashboard.goldshore.ai`, `dash.goldshore.ai`                                           | Yes (GoldShore-Trading-ZT)  | Protected trading dashboard aliases. Keep `/oauth/schwab/callback` and `/oauth/robinhood/callback` public/bypassed for broker OAuth redirects. |
| Control worker     | `ops.goldshore.ai`                                                                                           | Yes                         | Internal ops workflows and automation.                                                                |
| API worker         | `api.goldshore.ai`                                                                                           | Optional                    | Keep `/`, `/health`, and `/version` public. Protect `/admin/*`, `/internal/*`, `/system/*`, `/user*`, `/users/*`, `/templates/*`, `/media/*`, `/pages/*`, and `/ai/*`. |
| Gateway worker     | `gw.goldshore.ai`                                                                                            | Optional                    | Canonical hostname is `gw.goldshore.ai` (not `gateway.goldshore.ai`); depends on routing/auth design. |
| Mail handler       | `mail.goldshore.ai`                                                                                          | No                          | Cloudflare mail routing cannot authenticate.                                                          |


## Canonical Cloudflare Access IdP matrix

This table is the single source of truth for Cloudflare Access identity-provider requirements on protected GoldShore applications. Configure these IdPs as alternative login methods for the Access application (or as separate OR policies), not as multiple **Require** selectors; Cloudflare evaluates multiple Require selectors conjunctively.

| Protected app | Access application / policy | Allowed IdPs / login methods | Personal Gmail path | Notes |
| --- | --- | --- | --- | --- |
| `admin.goldshore.ai` | `GoldShore-Admin-ZT` | Google Workspace; GitHub GoldShore Deploy; generic GitHub; email OTP | `marstonr6@gmail.com` must be allowed through email OTP or through a GitHub identity with verified email `marstonr6@gmail.com`. | Production admin cockpit. |
| `trading.goldshore.ai`, `dashboard.goldshore.ai`, `dash.goldshore.ai` | `GoldShore-Trading-ZT` | Google Workspace; GitHub GoldShore Deploy; generic GitHub; email OTP | `marstonr6@gmail.com` must be allowed through email OTP or through a GitHub identity with verified email `marstonr6@gmail.com`. | Trading dashboard and aliases; broker OAuth callbacks must be bypass policies, not protected paths. |
| `admin-preview.goldshore.ai` | `GoldShore-Admin-ZT` | Google Workspace; GitHub GoldShore Deploy; generic GitHub; email OTP | Same as production admin. | Admin preview must mirror production admin IdP requirements. |
| `ops.goldshore.ai` | `Goldshore Ops` | Google Workspace; GitHub GoldShore Deploy; generic GitHub; email OTP | `marstonr6@gmail.com` must be allowed through email OTP or through a GitHub identity with verified email `marstonr6@gmail.com`. | Internal control plane. |
| `gw.goldshore.ai` | `Goldshore Gateway` | GitHub GoldShore Deploy; generic GitHub; email OTP | `marstonr6@gmail.com` must be allowed through email OTP or through a GitHub identity with verified email `marstonr6@gmail.com`. | Gateway Access app; keep public probe bypasses separate from IdP requirements. |
| `api.goldshore.ai` | `Goldshore API` | GitHub GoldShore Deploy; generic GitHub; email OTP | `marstonr6@gmail.com` must be allowed through email OTP or through a GitHub identity with verified email `marstonr6@gmail.com`. | Use the API Access application/AUD (`d303765cb1746f11a0fe37affad2d191deb18771a1d98beb29cb9c52b6cd731b`) expected by `gs-api`; keep public probe bypasses separate from IdP requirements. |
| `agent.goldshore.ai` | `Goldshore Gateway` | GitHub GoldShore Deploy; generic GitHub; email OTP | `marstonr6@gmail.com` must be allowed through email OTP or through a GitHub identity with verified email `marstonr6@gmail.com`. | Shares the gateway Access application/AUD with gateway and agent routes; API traffic keeps the API Access AUD. |

When changing Cloudflare Zero Trust, verify each Access application's allowed login methods or OR policies against this matrix. Do not place alternative IdPs in the same policy's **Require** list. If personal Gmail access is needed without Google Workspace membership, do not rely on Workspace domain membership; keep either the email OTP path for `marstonr6@gmail.com` or the verified-email GitHub path enabled.

## Cloudflare Access service-token handling

Non-interactive checks against Access-protected admin and preview hosts must use a Cloudflare Access service token instead of assuming anonymous reachability.

- GitHub Actions and local automation should provide `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`.
- `.github/workflows/maintenance-gs-sync.yml` passes those secrets into `scripts/jules-sync.sh` for authenticated sync checks.
- `infra/Cloudflare/tests.ts` automatically attaches the service-token headers for `admin.goldshore.ai`, `admin.goldshore.org`, `mcp.goldshore.ai`, `trading.goldshore.ai`, `dashboard.goldshore.ai`, `dash.goldshore.ai`, `admin-preview.goldshore.ai`, `*-preview.goldshore.ai`, and `*.goldshore-pages.dev` smoke checks when those environment variables are present.
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

- `https://goldshore.cloudflareaccess.com/cdn-cgi/access/callback`

Use this exact callback URL in the GitHub OAuth app configuration used by Cloudflare Access. The GitHub OAuth app homepage should be `https://goldshore.cloudflareaccess.com`; Cloudflare Access stores the GitHub OAuth client ID and client secret in the Zero Trust identity provider configuration. If this endpoint changes, update both the GitHub OAuth app and Cloudflare Access IdP configuration together to avoid login failures.
