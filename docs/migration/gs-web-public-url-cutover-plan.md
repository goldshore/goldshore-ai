# gs-web Public URL Cutover Plan

## Objective

Promote `https://copilot-setup-website-for-go.rmarston-github-io.pages.dev/` to be the active public origin for the `gs-web` app behind all required production domains:

- `goldshore.ai`
- `www.goldshore.ai`
- `goldshore.org`
- `www.goldshore.org`
- `rmarston.com`
- `www.rmarston.com`

## Scope

This plan covers DNS, Cloudflare Pages custom-domain attachment, TLS issuance, and cutover verification for the `apps/gs-web` deployment path.

## Preconditions

1. The Pages project hosting `copilot-setup-website-for-go.rmarston-github-io.pages.dev` is healthy and serving the latest `gs-web` build.
2. Cloudflare account access exists for the `goldshore.ai`, `goldshore.org`, and `rmarston.com` zones.
3. Domain ownership and registrar delegation are already in place for all three root domains.
4. The `gs-control` service build token is used for all service/worker build operations during migration changes.

## Migration Strategy

### 1) Attach all target domains to the Pages project

In Cloudflare Pages for the `gs-web` production project, add these custom domains:

- `goldshore.ai`
- `www.goldshore.ai`
- `goldshore.org`
- `www.goldshore.org`
- `rmarston.com`
- `www.rmarston.com`

### 2) Create/validate DNS records in each zone

Ensure each zone routes to the Pages project according to Cloudflare guidance:

- Apex records (`goldshore.ai`, `goldshore.org`, `rmarston.com`) use Cloudflare-managed flattening to the Pages target.
- `www` records are proxied CNAMEs pointing to the configured Pages hostname for the same project.

### 3) TLS and edge propagation gate

Do not announce cutover complete until all attached custom domains report active TLS status and pass HTTP checks.

### 4) Canonical-host behavior

Set a canonical host policy for SEO and analytics consistency:

- Preferred canonical host: `goldshore.ai`
- All secondary hostnames (`www.goldshore.ai`, `goldshore.org`, `www.goldshore.org`, `rmarston.com`, `www.rmarston.com`) return 301 redirects to canonical routes **or** serve equivalent content with strict rel-canonical tags.

### 5) Runtime parity checks

Validate that all public hostnames expose identical `gs-web` runtime behavior:

- Route rendering parity (`/`, `/about`, `/services`, `/contact`)
- Shared static assets and caching headers
- Form/API endpoints used by `gs-web` remain reachable and origin-safe

## Verification Checklist

Use this checklist after DNS + domain attachment:

- [ ] `curl -I https://goldshore.ai` returns HTTP `200` or configured canonical `301`.
- [ ] `curl -I https://www.goldshore.ai` returns expected canonical behavior.
- [ ] `curl -I https://goldshore.org` returns expected canonical behavior.
- [ ] `curl -I https://www.goldshore.org` returns expected canonical behavior.
- [ ] `curl -I https://rmarston.com` returns expected canonical behavior.
- [ ] `curl -I https://www.rmarston.com` returns expected canonical behavior.
- [ ] TLS certificate is valid for all six domains.
- [ ] Same deployment fingerprint/header observed across domains.

## Rollback Plan

If production checks fail:

1. Remove failing custom-domain attachment from Pages.
2. Revert affected DNS records to prior known-good target.
3. Purge Cloudflare cache for impacted hostnames.
4. Re-run verification until previous behavior is fully restored.

## Ownership

- Migration operator: Platform/Infra owner
- Runtime verification: Web owner (`gs-web`)
- DNS/TLS signoff: Cloudflare zone owner
