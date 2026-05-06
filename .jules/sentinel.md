# Sentinel Journal

## 2024-05-24 - Initial Journal Creation
**Vulnerability:** N/A
**Learning:** Initialized the Sentinel journal to track critical security learnings.
**Prevention:** N/A
## 2025-12-16 - Unprotected Internal API Exposure
**Vulnerability:** The `gs-api` worker (`api.goldshore.ai`) was configured with a Cloudflare Access "bypass" policy but lacked application-level authentication. This exposed the internal API publicly.
**Learning:** Infrastructure-as-Code (`desired-state.yaml`) assumed "bypass" meant "handle auth elsewhere" (e.g., via Gateway), but the API worker didn't implement it. Reliance on network-layer security alone (which was disabled) caused a gap.
**Prevention:** Always implement "Defense in Depth". Internal APIs should verify authentication tokens (e.g., Service Tokens or JWTs) even if they are expected to be behind a gateway. Never assume upstream protection is sufficient.

## 2025-12-17 - Client-side XSS in DocsSearch
**Vulnerability:** `DocsSearch.astro` used `innerHTML` to render search results, which could allow XSS if the search API returned malicious titles or URLs.
**Learning:** Even in server-rendered frameworks like Astro, client-side scripts inside components are vulnerable to traditional DOM XSS patterns when handling API responses.
**Prevention:** Use `textContent` or `document.createElement` when rendering dynamic data in client scripts, avoiding `innerHTML` unless absolutely necessary and sanitized.

## 2025-12-18 - Missing Audience Validation in Auth
**Vulnerability:** The shared `verifyAccess` utility checked the Token Issuer but ignored the Audience claim. This allowed a valid Cloudflare Access token from *any* application in the GoldShore organization to authenticate against *any other* internal service using this library.
**Learning:** Checking the Issuer alone is insufficient in a multi-app environment sharing an Identity Provider tenant.
**Prevention:** Always validate the `aud` (Audience) claim to ensure the token was issued specifically for the target service. Updated `@goldshore/auth` to enforce this when `CLOUDFLARE_ACCESS_AUDIENCE` is present in the environment.

## 2025-12-19 - Server-side XSS in DocsSidebar
**Vulnerability:** `DocsSidebar.astro` used `set:html` with a manually constructed HTML string for links, which would allow XSS if a documentation page title contained malicious scripts.
**Learning:** Even internal content (like content collections) should be treated as untrusted to enforce "Defense in Depth". Avoiding manual HTML string construction prevents this class of bugs entirely.
**Prevention:** Use Astro's native expression syntax `{variable}` instead of `set:html` or `Fragment` whenever possible. It automatically handles escaping.

## 2026-01-09 - Missing Security Headers in Admin App
**Vulnerability:** The `apps/gs-admin` application (dashboard) lacked standard HTTP security headers (`X-Frame-Options`, `HSTS`, `X-Content-Type-Options`), making it potentially vulnerable to clickjacking and MIME sniffing.
**Learning:** When creating new Astro apps in a monorepo, middleware (and thus security headers) is not automatically inherited from other apps.
**Prevention:** Enforce a standard `middleware.ts` template for all new Astro applications or move security headers to the infrastructure layer (Cloudflare `_headers` or Gateway rules) if consistent application-level enforcement is prone to oversight.

## 2026-02-13 - Unprotected Sensitive Operations Worker
**Vulnerability:** `apps/gs-control` exposed sensitive operational endpoints (`/dns/apply`, `/workers/reconcile`) without any authentication middleware, relying solely on (potentially missing or misconfigured) network-level protection.
**Learning:** Internal automation or "worker" apps are often overlooked during security reviews because they aren't "user-facing", but they hold the "keys to the kingdom" (DNS, deployment credentials).
**Prevention:** Treat every worker as a public API. Mandate default-deny authentication middleware for all new workers at the template level.

## 2026-02-14 - Unprotected Goldshore Agent
**Vulnerability:** The newly created `apps/goldshore-agent` service was deployed without any authentication or security headers, exposing it to public access.
**Learning:** Even with established patterns (like in `api-worker`), new services are susceptible to "copy-paste incomplete" errors or being started from scratch without security defaults.
**Prevention:** Enforce a strict "Security First" template for all new services that includes authentication and security headers by default.
## 2026-02-15 - Exposed Client Secret via PUBLIC_ Env Var
**Vulnerability:** The `apps/gs-admin` application exposed `AUTH_CLIENT_SECRET` via `import.meta.env.PUBLIC_AUTH_CLIENT_SECRET`. Prefacing an environment variable with `PUBLIC_` in Astro/Vite statically replaces it in the client bundle, leaking critical credentials to anyone who inspects the code.
**Learning:** Developers may use `PUBLIC_` out of habit to make variables "work" without realizing it bypasses server-only security boundaries, even in SSR apps.
**Prevention:** Strictly enforce `AUTH_*` or `SECRET_*` naming conventions without `PUBLIC_` prefix for credentials. Added fallback logic with critical warnings to migrate safely.
## 2026-04-20 - Unprotected Agent Service
**Vulnerability:** `apps/goldshore-agent` lacked standard security headers and CORS configuration, exposing it to public access.
**Learning:** New services created in the monorepo (like `goldshore-agent`) do not automatically inherit security middleware. Explicit configuration is required.
**Prevention:** Establish a strict "Secure by Default" template for new Hono/Worker apps that includes `secureHeaders` and `cors` middleware from the start.
## 2026-02-14 - Securing Agent Service by Default
**Vulnerability:** The `apps/goldshore-agent` service was initialized without any authentication middleware, exposing potential future AI agent capabilities to the public internet.
**Learning:** New services in a monorepo often start "barebones" and skip security boilerplate, creating a window of vulnerability as features are added. Drift between documentation (which said it was secured) and implementation is a common risk.
**Prevention:** Enforce a "Secure by Default" template for all new Hono services that includes `secureHeaders`, `cors`, and `verifyAccess` middleware immediately upon creation.

## 2026-05-21 - Unverified Webhooks in Jules Bot
**Vulnerability:** `apps/jules-bot` accepted GitHub webhooks without verifying the `X-Hub-Signature-256`, allowing potential attackers to spoof events and trigger unauthorized actions.
**Learning:** Standalone Node.js scripts/bots in the monorepo often bypass the standard security middleware available to Hono/Cloudflare apps, requiring manual implementation of crypto verification.
**Prevention:** Enforce a standard webhook verification utility or template for all Node.js-based bot integrations to ensure signature validation is never skipped.
## 2026-05-28 - Missing CSP in Web App
**Vulnerability:** The `apps/gs-web` application lacked a Content Security Policy (CSP), allowing potentially unrestricted script execution and resource loading.
**Learning:** Static sites (Astro SSG) deployed to Cloudflare Pages require explicit `_headers` configuration or `<meta>` tags for security headers, as they don't run a server that can easily inject middleware headers for all responses (unlike SSR apps).
**Prevention:** For Cloudflare Pages deployments, always include a `public/_headers` file with strict CSP and security headers as part of the initial setup.
## 2026-05-25 - Unverified GitHub Webhooks
**Vulnerability:** `apps/jules-bot` accepted webhook payloads without verifying the `X-Hub-Signature-256` header, allowing attackers to forge events.
**Learning:** Services handling webhooks must verify signatures before parsing the body. Raw body access is required for correct HMAC verification.
**Prevention:** Enforce signature verification middleware on all webhook endpoints.

## 2026-05-21 - Unprotected Webhook Handler
**Vulnerability:** `apps/jules-bot` accepted GitHub webhooks without verifying the `x-hub-signature-256` header, allowing attackers to spoof events and trigger bot actions.
**Learning:** Standalone scripts or "bots" often lack the middleware infrastructure of larger frameworks (like Hono/Express) where signature verification might be a standard plug-in.
**Prevention:** Always implement HMAC signature verification for any public endpoint receiving webhooks, checking against a shared secret before parsing the payload.

## 2026-06-15 - Double Escaping Risk in Email Auto-Responder
**Vulnerability:** The contact form API (`apps/gs-web/src/pages/api/contact.ts`) was vulnerable to HTML injection in auto-responder emails. An initial fix attempted to sanitize input at the API layer *and* the email template layer.
**Learning:** Sanitizing inputs at the ingress (API) level for text fields that are later escaped again at the egress (Email) level leads to "double escaping" (e.g., `O'Neal` becomes `O&#039;Neal` in the database and `O&amp;#039;Neal` in the email).
**Prevention:** Rely on **Contextual Output Encoding**. Store data raw in the database to preserve integrity, and escape it only when rendering it into a specific format (HTML, JSON, etc.). This avoids data corruption and ensures correct rendering across different contexts.

## 2026-02-13 - SVG XSS Mitigation
**Vulnerability:** The `apps/gs-api` media upload endpoint used a fragile regex-based sanitizer for SVG files, which could be bypassed to execute XSS (e.g., via unquoted attributes or HTML entities).
**Learning:** Regex is insufficient for sanitizing complex structured data like HTML/XML. Attackers can often find edge cases in parsing logic to bypass filters.
**Prevention:** Implemented strict `Content-Security-Policy` headers (`script-src 'none'`, `sandbox`) on the media delivery endpoint. This ensures that even if a malicious SVG is uploaded, the browser will refuse to execute any embedded scripts.
