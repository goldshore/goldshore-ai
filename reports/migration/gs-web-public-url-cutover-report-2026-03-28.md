# gs-web Public URL Migration Report

**Date:** 2026-03-28  
**Target Pages Origin:** `https://copilot-setup-website-for-go.rmarston-github-io.pages.dev/`  
**Migration Goal:** Make the target Pages origin the active public backing deployment for `goldshore.ai`, `goldshore.org`, and `rmarston.com` domain families.

## Domain Coverage Matrix

| Domain | Intended State | Cutover Evidence Required | Status |
|---|---|---|---|
| `goldshore.ai` | Attached to target Pages project | Cloudflare Pages custom-domain active + HTTP check | Planned |
| `www.goldshore.ai` | Attached to target Pages project | Cloudflare Pages custom-domain active + HTTP check | Planned |
| `goldshore.org` | Attached to target Pages project | Cloudflare Pages custom-domain active + HTTP check | Planned |
| `www.goldshore.org` | Attached to target Pages project | Cloudflare Pages custom-domain active + HTTP check | Planned |
| `rmarston.com` | Attached to target Pages project | Cloudflare Pages custom-domain active + HTTP check | Planned |
| `www.rmarston.com` | Attached to target Pages project | Cloudflare Pages custom-domain active + HTTP check | Planned |

## Implementation Checklist

### Cloudflare Pages

- [ ] Confirm production project corresponds to `gs-web` artifact path (`apps/gs-web`).
- [ ] Add all six custom domains to the Pages project hosting the target Pages URL.
- [ ] Wait for SSL/TLS issuance to reach active state for all six domains.

### DNS

- [ ] Validate apex records (`goldshore.ai`, `goldshore.org`, `rmarston.com`) resolve to the Pages target through Cloudflare-managed flattening.
- [ ] Validate proxied `www` CNAME records align with the same Pages project.
- [ ] Confirm no conflicting records route traffic to legacy origins.

### Application Behavior

- [ ] Validate homepage parity across all domains.
- [ ] Validate key navigation routes (`/about`, `/services`, `/contact`).
- [ ] Validate static assets and caching headers match expected gs-web behavior.
- [ ] Validate API-backed forms and status endpoints from each hostname.

### Canonicalization

- [ ] Confirm canonical host policy is implemented (`goldshore.ai` recommended).
- [ ] Confirm non-canonical hosts either:
  - [ ] 301 redirect to canonical routes, or
  - [ ] serve equivalent content with rel-canonical tags.

## Operational Notes

- Use the `gs-control` build token for Cloudflare worker/service build operations associated with migration and post-cutover maintenance.
- Keep preview and internal Access-protected hostnames unchanged during this public-domain cutover.

## Validation Commands

```bash
curl -I https://goldshore.ai
curl -I https://www.goldshore.ai
curl -I https://goldshore.org
curl -I https://www.goldshore.org
curl -I https://rmarston.com
curl -I https://www.rmarston.com
```

## Exit Criteria

Migration is complete when all six domains are attached to the target Pages project, TLS is active, and HTTP behavior matches the defined canonical policy with no legacy-origin leakage.
