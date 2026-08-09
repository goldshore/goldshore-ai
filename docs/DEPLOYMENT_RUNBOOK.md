# Gold Shore deployment and Cloudflare change runbook

## Configuration authority

Gold Shore uses a single model: **repository-reviewed contracts, dashboard-only
production mutation**.

| Concern                                                        | Authority                   | Repository role                       |
| -------------------------------------------------------------- | --------------------------- | ------------------------------------- |
| `gs-web` bindings, routes, resources, migrations, and triggers | `apps/gs-web/wrangler.toml` | Reviewable expected-state contract    |
| `gs-api` bindings, routes, resources, migrations, and triggers | `apps/gs-api/wrangler.toml` | Reviewable expected-state contract    |
| Live configuration and all production changes                  | Cloudflare dashboard        | Execution and live-state authority    |
| Other `infra/Cloudflare/*` files                               | None                        | Documentation/redacted snapshots only |

Wrangler manifests are contracts, not permission to apply them automatically.
GitHub Actions must remain read-only and must not receive Cloudflare credentials.

## Mandatory human approval

Every production mutation requires approval from a required reviewer in the
GitHub `production` environment **before** a human performs it in Cloudflare.
This includes Worker releases, binding or route changes, D1 migrations, queue or
cron changes, DNS changes, secret changes, Access changes, and email changes.
Configure the environment with required reviewers and disallow self-review.
Record the approved Actions run, approver, operator, timestamp, and change/PR in
the handoff. The approval is an audit gate; the workflow does not perform the
mutation.

## Settings that are always dashboard-only

- Worker secret values, API keys, signing keys, OAuth secrets, and Cloudflare
  credentials. Enter values in **Workers & Pages → Worker → Settings → Variables
  and Secrets**. Do not store them in GitHub, TOML, logs, or artifacts.
- IdP/OAuth client secrets. Enter them in **Zero Trust → Settings →
  Authentication**.
- Access applications and policy membership, ordering, session settings,
  service tokens, and identity-provider assignment.
- Email Routing rules, verified destinations, catch-all behavior, and signing
  configuration.
- DNS records and Worker/custom-domain ownership.

Names and public IDs may be documented; values and policy contents may not.

## Production procedure

1. **Review the contract.** Change only the appropriate app-local
   `wrangler.toml`. Confirm the Worker name, environment, binding names, resource
   identifiers, route ownership, migrations, and triggers. Do not edit an infra
   mirror as a deploy input.
2. **Run checks.** Run the focused build and repository validation affected by
   the change. The renamed inventory workflows generate
   `cloudflare-inventory.json`; they do not deploy or reconcile anything.
3. **Review drift.** Compare that artifact with a redacted dashboard export.
   The comparison may contain Worker metadata, route ownership, binding names,
   Access application IDs, and secret names only.
4. **Obtain approval.** Trigger the production approval record and wait for a
   required reviewer. Stop if approval is absent or the reviewed contract has
   changed.
5. **Apply in dashboard.** An authorized human performs the exact approved
   operation in Cloudflare. Use the dashboard's migration tooling for D1 and
   dashboard configuration screens for all other changes. Do not substitute a
   Wrangler or Cloudflare API mutation.
6. **Verify.** Inspect the dashboard deployment/version and binding list, then
   check the affected public health endpoint and routes. Never print secret
   values while verifying.
7. **Record handoff.** Record branch, commit SHA, approved run, reviewer,
   operator, checks, deployment/version URL, redacted drift result, and any
   remaining manual action.

## Read-only inventory workflows

The historical deploy, DNS setup/reconciliation, token management, and Access
setup/reconciliation workflow filenames are retained to avoid broken links.
Their jobs now only check out the repository, generate a redacted expected-state
inventory, display it, and upload it for review. They have `contents: read`, no
Cloudflare token, no GitHub secret values, and no mutation inputs.

The generator reads both canonical manifests and
`infra/Cloudflare/dashboard-inventory.json`. An Access application whose ID is
`DASHBOARD_EXPORT_REQUIRED` has not yet received a safe human dashboard export;
the placeholder must never be guessed or replaced with a secret/AUD value.

## Rollback and emergency changes

Rollback is also a production mutation. Obtain the same `production`
environment approval, then have a human select the last known-good Worker
version or restore the reviewed setting in the dashboard. For an active security
incident, follow the incident process and dashboard break-glass controls; do not
add a temporary mutating workflow or commit a credential. Document the exception
and reconcile the two canonical manifests after containment.
