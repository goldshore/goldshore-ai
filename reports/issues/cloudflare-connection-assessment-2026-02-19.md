# Cloudflare connection assessment for `goldshore.ai` (2026-02-19)

## What I checked

### 1) DNS resolution
- `goldshore.ai`, `www.goldshore.ai`, `api.goldshore.ai`, `gw.goldshore.ai`, `ops.goldshore.ai`, and `admin.goldshore.ai` all resolve to Cloudflare edge IPs (`104.21.26.100` and `172.67.135.217`).
- This indicates DNS is active and proxied through Cloudflare.

### 2) HTTP/HTTPS reachability
- Requests to all tested hostnames return `403 Forbidden` with Cloudflare challenge headers:
  - `cf-mitigated: challenge`
- This means the domains are reachable at Cloudflare edge, but traffic is being challenged/blocked by Cloudflare security policy (WAF/Bot protection/custom rule), not by DNS failure.

### 3) Cloudflare edge trace
- `GET https://goldshore.ai/cdn-cgi/trace` returns a valid Cloudflare trace payload.
- This confirms edge connectivity is healthy.

## Repo state vs observed behavior

The repository documentation states the public web domain should be open:
- `goldshore.ai` and `www.goldshore.ai` are expected to be public (no Access gate). See `docs/domains-and-auth.md`.

Observed behavior conflicts with that expectation:
- Public web and service subdomains currently challenge generic HTTP clients at the edge.

## Most likely root cause

A Cloudflare dashboard-level policy is actively challenging requests for `goldshore.ai` zone, likely one of:
- WAF custom rule with challenge action.
- Bot Fight Mode / Super Bot Fight Mode aggressively challenging non-browser traffic.
- Managed challenge rule applied broadly to all hosts.
- Access policy incorrectly attached to unintended hostnames (less likely because header indicates challenge, not Access login flow).

## Fast repair plan (no code deploy required)

1. In Cloudflare Dashboard → **Security > Events**, filter by host `goldshore.ai` and look up challenge events.
2. Identify the matching rule/rule ID causing `Managed Challenge` / `JS Challenge` / `Block`.
3. For public web hosts (`goldshore.ai`, `www.goldshore.ai`):
   - Remove challenge action, or
   - Add explicit allow/bypass rule for standard GET/HEAD traffic.
4. Keep Access/WAF protection only on intended internal hosts (`admin`, `ops`, and preview domains), aligned with `docs/domains-and-auth.md`.
5. Re-test with:
   - `curl -I https://goldshore.ai`
   - `curl -I https://www.goldshore.ai`
   expecting `200` or `301/302`, and no `cf-mitigated: challenge` header.

## Desired policy alignment from repo docs

- Public: `goldshore.ai`, `www.goldshore.ai`
- Access-protected: admin and preview domains
- Optional protection depending on endpoint design: `api.goldshore.ai`, `gw.goldshore.ai`
- Internal ops: `ops.goldshore.ai`

Reference docs:
- `docs/domains-and-auth.md`
- `infra/cloudflare/desired-state.yaml`
