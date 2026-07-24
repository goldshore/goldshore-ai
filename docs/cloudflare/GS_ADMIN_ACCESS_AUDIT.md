# Gold Shore Labs Admin / Cloudflare Access audit

Status: **dry-run design only**. No live Cloudflare resources are deleted or remapped by this change.

## Sources reviewed

- Cloudflare Access launcher and account screenshots supplied July 2026.
- `apps/gs-admin/wrangler.toml`.
- Gold Shore repository deployment history and the canonical GS-WEB-PROD contract.

## Current deployment ownership

`gs-admin` is deployed from the `goldshore-ai` monorepo. The legacy `goldshore-admin` repository has disabled its direct deploy workflows and delegates deployment to this monorepo.

The current admin Wrangler contract declares:

- Pages project: `gs-admin`
- Pages custom domain documented as `admin.goldshore.ai`
- D1: `PLATFORM_DB`, `GS_AUDIT_DB`
- R2: `GS_ASSETS`
- KV: `KV`, `KV_SESSIONS`
- Service binding: `API_SERVICE` -> `gs-api` production environment
- Access tenant: `goldshore.cloudflareaccess.com`

A previous remediation intentionally removed a Worker route from `admin.goldshore.ai/*`, because that route would shadow the Pages custom domain. Preserve that rule.

## Access launcher observations

The tenant branding already displays **Gold Shore Labs** and GitHub is active as an identity provider. Application visibility differs between the two supplied identities, which indicates that application policies or group/team claims are filtering launcher cards.

Observed labels include inconsistent casing and legacy naming:

| Observed launcher label | Canonical target label | Proposed service/route |
|---|---|---|
| Dashboard / Goldshore Ops | Gold Shore Labs Admin | `gs-admin`; `admin.goldshore.org/*`, `admin.goldshore.ai/*` |
| Goldshore API | Gold Shore Labs API | `gs-api-prod`; `api.goldshore.org/*`, `api.goldshore.ai/*` |
| Goldshore API - Public | Gold Shore Labs API Public Status | only explicit public health/status paths |
| Goldshore Gateway | Gold Shore Labs Gateway | `gs-gateway-prod`; `gateway.goldshore.org/*` |
| Goldshore Gateway - Public | Gold Shore Labs Gateway Public | retain only if a public route is required |
| GoldShore MCP | Gold Shore Labs MCP | `gs-mcp-agent-prod`; `mcp.goldshore.org/*` |
| GoldShore-Web-Preview | Gold Shore Labs Web Preview | protected Pages preview hostnames |
| Trading / Signals cards | No change in this PR | audit separately before consolidation |

The exact live application domains, audience tags, policy IDs, and launcher URLs must be retrieved through the Cloudflare Access API before changes are applied. Screenshots establish labels and visibility, not the complete policy configuration.

## Required policy order

1. Allow managed Gold Shore devices when device posture is available.
2. Allow authorized GitHub organization/team membership.
3. Allow explicitly approved administrative identities.
4. Deny all remaining requests.

Machine callers use Cloudflare Access service tokens. Browser identity is accepted only after validation of `Cf-Access-Jwt-Assertion`; an unsigned email header is not identity proof.

## Login experience

The new `/login` page:

- Uses the exact **Gold Shore Labs** title.
- Uses the shared Penrose-inspired Gold Shore mark and dark ocean/gold theme.
- Redirects authentication to `goldshore.cloudflareaccess.com`.
- Preserves the originally requested route through the `next` query parameter.
- Exposes no local password form or internal policy details.
- Includes reduced-motion and keyboard-focus support.

Cloudflare's tenant-hosted authentication page should use the same logo, title, support links, and visual palette where dashboard branding options permit.

## Mock storage model

Local mocks use:

- D1 `PLATFORM_DB` for mail records, MCP sessions/tool calls, API request metadata, and audit events.
- R2 `GS_ARTIFACTS` for bodies, attachments, request/response payloads, and MCP artifacts using `mail/`, `mcp/`, and `api/` prefixes.
- KV `GS_CONFIG` only for non-secret configuration.

Secrets remain Worker or Pages secrets:

- `OPENAI_API_KEY`
- `GH_MCP_AGENT_TOKEN`
- `CF_MCP_AGENT_TOKEN`

## Remapping sequence

1. Export live Access applications, domains, audiences, policies, and launcher visibility.
2. Compare the export with `infra/cloudflare/access-apps.desired.json`.
3. Identify duplicate hostname/path coverage.
4. Rename display labels first; do not alter routes in the same change.
5. Verify Pages custom domains and Worker routes against each Wrangler file.
6. Remap one application at a time and verify login, JWT audience, service-token access, and rollback.
7. Keep `goldshore.org` and `goldshore.ai` mirrored while the mirror requirement remains active.
8. Do not archive or merge any repository until deployment ownership, history, open issues, secrets, and Cloudflare resources have been mapped.

## Consolidation gate

Repository consolidation into `goldshore-ai` is blocked until:

- Every active Cloudflare Pages project and Worker has one owning source path.
- Every custom domain and Access application maps to that source path.
- GitHub Actions and Cloudflare build configurations agree.
- Production and preview bindings are documented.
- Legacy resources have an approved retirement plan.
- Secrets are rotated and stored outside Git history and KV.
