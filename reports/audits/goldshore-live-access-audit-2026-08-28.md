# GoldShore live access audit — 2026-08-28

Scope: read-only verification of the Gold Shore Labs Cloudflare account,
`marzton/goldshore-ai`, public/protected application routes, and enrolled
devices. No secret values were read and no production resources were changed.

## Evidence baseline

- Repository authority: `origin/main` at `68c10bd7` (2026-08-28).
- GitHub: the connected app is installed for `marzton`, `goldshore`, and
  `GearSwipe`. The authenticated `marzton` account has admin, maintain,
  push, pull, and triage permission on `marzton/goldshore-ai`.
- Cloudflare: Wrangler OAuth and the Cloudflare API both authenticate to Gold
  Shore Labs account `f77de1…50bd2`.
- The Codex in-app Browser attached successfully during the follow-up. The
  Cloudflare and GitHub dashboard tabs are preserved at their respective
  sign-in handoffs; authenticated dashboard membership and private settings
  remain pending operator sign-in. Browser-visible public and Access-boundary
  results are recorded below.

## Browser-visible verification

| Surface | Visible result | Assessment |
| --- | --- | --- |
| GitHub PR #6959 | Public PR view shows draft state, verified commit `fb9534c`, three changed files, and the signed webhook repair description. The Browser session is signed out, so private repository settings remain unverified there. | Public evidence present; operator permissions pending sign-in |
| Cloudflare dashboard | Account link reaches Cloudflare sign-in and offers the saved GoldShore Google profile. Google requires interactive account authentication before the dashboard can be inspected. | Correct handoff; membership pending sign-in |
| Public frontend | `goldshore.ai/` renders “Gold Shore Labs | Applied Intelligence,” identifies `gs-web`/`gs-api` as the two canonical apps, and links login to `admin.goldshore.ai/app/dashboard`. | Pass |
| Templates/content | `goldshore.ai/templates` renders the Astro page-template contract and shared composition primitives. | Pass |
| Public media route | `goldshore.ai/media` renders the GoldShore 404 page. Media bindings exist, but no public `/media` page exists. | Missing if a public media library is intended |
| Admin Access | `admin.goldshore.ai/app/dashboard` reaches the branded “Gold Shore Admin Production” Access login with GitHub, Cloudflare Members, and Google Workspace SAML choices. | Edge/IdP selection verified; authorized login pending |
| Agent/SSH Access | `agent.goldshore.ai` reaches the branded “SSH” Access login and offers SAML, GitHub, and Google. | Edge/IdP selection verified; authorized login pending |
| Laptop tunnel | `ssh-laptop.goldshore.ai` visibly returns Cloudflare Tunnel error 1033 and says Cloudflare cannot resolve the configured tunnel. | Fail |
| JSON endpoints | The in-app Browser blocks direct JSON-document navigation with `ERR_BLOCKED_BY_CLIENT`; API/HTTP results below are therefore the authoritative endpoint evidence. | Browser limitation, not service evidence |

## Verified live

| Area | Current evidence | Result |
| --- | --- | --- |
| Production frontend | `goldshore.ai/` and `goldshore.org/` return 200 through Cloudflare; zone routes target `gs-web`. | Pass |
| Admin edge protection | `admin.goldshore.ai` redirects to Access app audience `c520…db9`; four allow policies reference Admin, Editor, AI Agent/MCP, and GitHub developer groups. | Pass |
| API | `api.goldshore.ai/health` returns 200 JSON; protected admin paths redirect to Access audience `8510…528`. | Pass |
| Intentional public API paths | public pages and health have separate everyone/bypass Access apps; signed webhooks and OAuth callbacks also have path-specific apps. | Pass, subject to application-layer signature/auth checks |
| MCP | `mcp.goldshore.ai/mcp` reaches the Cloudflare MCP portal and rejects anonymous requests with 401. The portal targets MCP server `goldshore-api-mcp`, and its API upstream has a dedicated service token policy. | Edge/auth present; authenticated initialize/tools-list still unverified |
| Identity | Six IdPs exist: Google, two GitHub IdPs, OTP, Cloudflare account members, and Google Workspace SAML. Generic IdP selection is retained (`auto_redirect_to_identity=false`). | Present |
| Access groups | Admin, Editor, GitHub GoldShore developers, organization SSO, and AI Agent/MCP groups exist. | Present |
| Service identity | `GS_AGENT` and `MCP Portal to Goldshore API` tokens exist and expire in 2027. Their secret values were not inspected. | Present |
| Workers | Canonical `gs-web` and `gs-api` services exist. Live bindings include D1, KV, R2, Queues, Durable Objects, Workers AI, AI Search, Images, Stream, Email Sending, Secrets Store, and service bindings. | Present, with drift noted below |
| Data/storage | Required production D1 databases, KV namespaces, R2 buckets, and four queues exist. `gs-api` is the application consumer for the declared queues. | Present |
| Images/media | `gs-web` has Images and Assets bindings; `gs-api` has `GS_ASSETS`, telemetry, mail archive, and risk-radar R2 bindings plus Stream. | Present |
| Mobile | Pixel 10 Pro Fold is enrolled to the expected user and was updated on 2026-08-27. The WARP posture rule and WARP device profile are enabled. | Enrollment present; end-to-end app test still required on device |
| GitHub CI | Current `main` CI, Repo Health, and CodeQL runs pass. PR #6042 was merged. | Pass |
| GitHub secrets metadata | Cloudflare deploy/account/zone and Access client secret names exist. Values were not inspected. | Present |

## Confirmed gaps and drift

1. **Preview is broken.** `preview.goldshore.ai` and
   `api-preview.goldshore.ai` both return 522. Their DNS records target the
   production workers.dev hostnames while the current repository intentionally
   uses Worker Versions rather than standalone preview Workers.
2. **Declared aliases are missing or unrouted.** `gw.goldshore.ai`,
   `ops.goldshore.ai`, `dashboard.goldshore.ai`, `dash.goldshore.ai`, and
   `risk.goldshore.ai` do not currently resolve to working applications.
   `trading.goldshore.ai` resolves but returns 522. These aliases appear in
   historical desired-state declarations but are not routes in the canonical
   `gs-api` manifest, whose production routes are only
   `api.goldshore.ai/*` and `api.goldshore.org/*`.
3. **Laptop/private connectivity is unavailable.** All three Cloudflare
   tunnels have zero connections. `LAPTOP-TREB-temp` and
   `goldshore-lacie-local` are down; `MCP Tunnel` is inactive.
   `ssh-laptop.goldshore.ai` visibly returns Cloudflare Tunnel error 1033
   (the earlier raw HTTP probe surfaced the edge failure as 530). The HP laptop has cloudflared
   installed but no cloudflared service/process, and it is not enrolled as a
   Zero Trust device.
4. **GitHub webhooks are failing.** Push, pull-request, and workflow-run hooks
   are active and point to signed webhook routes on `api.goldshore.ai`, but
   repeated deliveries return `{"error":"Unauthorized"}` with 401. GitHub
   is sending both SHA-1 and SHA-256 signature headers, and the
   `GS_GITHUB_WEBHOOK_SECRET` Worker secret name exists. Source inspection
   found the direct cause: the webhook router was not mounted in the Worker
   entrypoint, and the global interactive-auth middleware did not classify
   signed GitHub POST routes as public. Requests were rejected before the
   router could perform HMAC verification. This branch repairs both entrypoint
   conditions; it does not rotate or inspect the secret.
5. **Workflow declaration does not equal live state.** The manifest declares
   `gs-signals-evaluator` and `editorial-production`; live account inventory
   contains `gs-signals-evaluator` and reference workflow `my-workflow`.
   Live `gs-api` settings also reference dashboard-added workflows
   `content-processing-workflow` and `signals-evaluator`, which do not
   appear in the account workflow list returned by the API.
6. **Binding drift is material.** Live `gs-api` has dashboard-added Browser,
   Stream, VPC, Flagship, and extra Workflow bindings absent from the canonical
   manifest. Live `gs-web` has several dashboard-only Cloudflare/GitHub
   credential bindings absent from the manifest. A future manifest deployment
   can remove these. Each binding needs an owner/consumer decision before the
   next production deployment.
7. **Secondary-zone policy differs.** `api.goldshore.org/health` redirects to
   Access while `api.goldshore.ai/health` is public. `admin.goldshore.org`
   reaches the Worker but returns application 401 rather than the
   `admin.goldshore.ai` Access login flow.
8. **Repository desired-state documentation is stale.** It still names
   `gs-web-prod`, `gs-api-prod`, `gs-signals-prod`, and a separate MCP
   Worker. Live canonical services are `gs-web` and `gs-api`; MCP and agent
   DNS point to Cloudflare's agent gateway.
9. **Production approval is not enforced by GitHub environment rules.** The
   `production` environment exists but reports no protection rules. This
   conflicts with the repository rule that human approval gates production
   mutations.

## Ordered repair requirements

1. Decide which aliases are product requirements versus retired historical
   names. Update the canonical Wrangler routes first; then apply DNS/routes
   through the protected production approval path. Do not recreate satellite
   Workers.
2. Replace broken preview aliases with a documented Worker Versions preview
   URL strategy, or explicitly provision isolated preview services and
   bindings. Do not point preview DNS at production workers.dev origins.
3. Restore a remotely managed laptop tunnel connector, verify its ingress maps
   `ssh-laptop.goldshore.ai` to the intended SSH origin, then test authorized
   and unauthorized SSH. Enroll the HP laptop in WARP only if private-routing
   access is required.
4. Review and deploy the webhook entrypoint repair through the production
   approval gate. Redeliver one event of each type and require a 2xx response.
   Rotate/reconcile the webhook secret through the approved write-only flow
   only if the deployed router returns `Invalid signature`.
5. Produce a manifest-vs-live binding decision table. Add legitimate bindings
   to `apps/gs-api/wrangler.toml` or remove their consumers; remove
   unapproved dashboard-only bindings only through an approved deployment.
6. Reconcile Workflow names and classes, then execute one non-destructive
   workflow instance and verify status/logs.
7. Align `goldshore.org` Access destinations and public probe behavior with
   the primary zone.
8. Add required reviewers or an equivalent human approval rule to the GitHub
   `production` environment before the next production mutation.
9. Complete interactive tests: Cloudflare dashboard membership, GitHub app
   settings, admin login through each approved IdP, MCP OAuth
   initialize/tools-list, service-token request, Pixel WARP access, and HP
   laptop SSH. Record Access/Gateway audit-log evidence for each.

## Safety / rollback

No live change was made during this audit. For every repair, capture the
existing resource ID and JSON metadata before mutation, change one hostname or
integration at a time, validate both authorized and unauthorized behavior, and
restore the captured record or prior Worker Version on failure.
