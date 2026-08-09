# `mcp.goldshore.ai` external integration boundary

**Status:** external integration; do not move, proxy, bind, or redeploy it from this repository until a human explicitly approves folding it into `apps/gs-api`.

**Last repository review:** 2026-08-09. This inventory distinguishes repository evidence from facts that still require the external owner's confirmation. It must not be used as authority to change live DNS, Access, OAuth, or Worker configuration.

## Current ownership and runtime inventory

| Item | Recorded state | Verification / action required |
| --- | --- | --- |
| Human owner | Gold Shore platform owner; the repo records approved addresses `marstonr6@gmail.com`, `goldshorelabs@gmail.com`, and the `goldshore.ai` email domain, but does **not** identify a named source-code maintainer. | A human must name the accountable maintainer and external source repository before any migration. |
| Source owner | External to `marzton/goldshore-ai`. No MCP implementation or deploy manifest is in the pnpm workspace. | Record the external repository, branch protection, and deployment workflow. |
| Worker / project | Infrastructure inventory calls it `gs-mcp`; desired DNS points to the separately deployed `goldshore-mcp-prod.goldshore.workers.dev`. These names conflict and must not be silently normalized. | Cloudflare owner must identify the route-owning script and whether either name is stale. |
| Route | `mcp.goldshore.ai/*`; desired DNS is a proxied CNAME to `goldshore-mcp-prod.goldshore.workers.dev`. `gs-api` does not claim this hostname. | Verify the active Workers route/custom domain and DNS target in Cloudflare. |
| Edge owner | Cloudflare Access application `GoldShore MCP` (also referred to historically as `GoldShore-MCP-ZT`), self-hosted and fail-closed. The optional MCP Portal app is disabled to prevent colliding applications on the same hostname. | Confirm the live application ID, audience, policy order, and approved service-token identities. |
| Protocol | Private MCP over Streamable HTTP. | Confirm protocol/version and session behavior against the external source. |

## OAuth contract

The repository records these same-origin OAuth paths as required external endpoints:

- authorization: `https://mcp.goldshore.ai/authorize`
- token: `https://mcp.goldshore.ai/token`
- dynamic client registration: `https://mcp.goldshore.ai/register`
- callback: `https://mcp.goldshore.ai/callback`
- authorization-server metadata should be discoverable from `https://mcp.goldshore.ai/.well-known/oauth-authorization-server`; this is a required migration gate, not a currently verified fact.

No client-registration inventory, redirect-URI list, scope catalogue, token format, refresh policy, or revocation endpoint is present in this repository. Those facts are therefore **unknown**, not empty. The external owner must provide a redacted export containing client name/owner, client ID fingerprint (never a secret), redirect URIs, grant types, scopes, last use, expiry, and revocation status. Dynamic registration must remain disabled or approval-gated unless the owner documents abuse controls.

## Credentials, scopes, and token storage

- Cloudflare Access supplies the outer human/service-identity gate; it is not a substitute for MCP OAuth authorization.
- This repository stores no MCP client secret or OAuth token and must not acquire one merely to monitor the host.
- The external owner must confirm that authorization codes are single-use and short-lived, refresh tokens rotate, tokens are audience-bound, scopes are least-privilege, and revocation is immediate.
- OAuth tokens must be encrypted at rest with a managed key unavailable to application logs and source control. Record the storage product, key owner, rotation procedure, retention, backup treatment, and deletion behavior in the external system's runbook; do not copy secret values here.
- Required scope names are currently **unverified**. Before registering another client, create a scope matrix mapping each MCP tool to read/write effect and approval requirement. No wildcard or implicit write scope is acceptable.

## Health check and incident posture

The canonical synthetic check is `GET https://mcp.goldshore.ai/health` through an approved Cloudflare Access service token. It must return a bounded JSON response identifying the service and readiness without exposing configuration, client registrations, tokens, tools, or dependency credentials. Anonymous `401`/`403` is expected for the private surface unless a human explicitly creates a path-scoped health bypass.

At review time, this environment could not reach the host because its outbound CONNECT proxy returned `403`; consequently none of the live endpoint behavior above was asserted. CI must use `CF-Access-Client-Id` and `CF-Access-Client-Secret` from its secret store, use a read-only service identity, and alert on authentication regressions separately from application-health failures.

For compromise or unexplained write activity: disable the Access service identity, revoke the affected OAuth clients/tokens, disable write tools, preserve redacted audit evidence, and contact the named human owner. Do not reroute the hostname to `gs-api` as an incident workaround.

## Human-approved fold-in / decommission criteria

The external Worker may be folded into `gs-api` only after a human approves the architecture change and all of these gates have evidence attached to the PR:

1. Named human owner, external repository/commit, live Worker script, route/custom-domain, Access application/audience, OAuth clients, scopes, storage, and dependencies are inventoried.
2. Every MCP tool is mapped to a curated `gs-api` operation; high-impact actions remain confirmation/approval-gated and auditable.
3. OAuth discovery, authorization, PKCE/state/replay protection, refresh rotation, revocation, encrypted migration, and client compatibility pass against a preview route.
4. SSRF, injection, schema, response-size, idempotency, rate-limit, and emergency-revocation controls have automated tests and security review.
5. Shadow traffic or a non-mutating canary demonstrates parity; dependent clients have migrated and the old Worker has no unexplained traffic for an owner-approved observation period (minimum 30 days).
6. Rollback ownership and DNS/Access/Worker-route change plans are approved. Secrets are transferred through secret stores and old copies are revoked—not copied into Git, tickets, logs, or PR text.
7. Only after post-cutover health and audit verification may the owner remove the old route, Worker/project, OAuth registrations, token data, Access application, service tokens, DNS record, and deployment credentials. Deletion evidence and final retention decisions are recorded.

Until every gate passes, `mcp.goldshore.ai` remains external and `apps/gs-api/wrangler.toml` must not claim its route.
