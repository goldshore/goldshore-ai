# Cloudflare configuration authority

## One authority model

Gold Shore uses **dashboard-only production management with repository-reviewed
contracts**:

1. `apps/gs-web/wrangler.toml` and `apps/gs-api/wrangler.toml` are the only
   reviewable contracts for Worker names, binding names, resource identifiers,
   routes, migrations, queues, and triggers.
2. The Cloudflare dashboard is the execution authority and the authority for
   current live state. An approved human applies production changes there.
3. Everything under `infra/Cloudflare/` is expected-state documentation or a
   redacted drift-review snapshot. It is not a deploy manifest and must not be
   used to mutate Cloudflare.

Legacy `*.wrangler.toml` files in this directory are non-deployable historical
references. Automation must never glob or pass them to Wrangler.

## Dashboard-only settings

The following never belong in GitHub secrets, TOML, workflow output, or build
artifacts:

- Worker secret **values** and Cloudflare API/deploy credentials;
- identity-provider client secrets;
- Access application policy changes, session controls, and service-token
  issuance or rotation; and
- Email Routing rules, destinations, verification, and signing configuration.

Public identifiers and names may be reviewed: binding names, route ownership,
Worker names, secret names (not values), and Access application IDs. The
redacted `dashboard-inventory.json` records the last human-supplied Access ID
inventory; `DASHBOARD_EXPORT_REQUIRED` means an operator must obtain the ID in
Zero Trust and update the snapshot without including policy or secret data.

## Change and drift-review procedure

1. Propose contract changes to one of the two app-local manifests and review the
   generated read-only workflow artifact.
2. Obtain approval from a required reviewer on the GitHub `production`
   environment. Every production mutation, including migrations, must have this
   approval even though the actual operation occurs outside Actions.
3. An authorized human enters values or applies the reviewed change in the
   Cloudflare dashboard. Do not use Wrangler or the Cloudflare API to mutate
   bindings, routes, secrets, migrations, triggers, DNS, Access, or email.
4. Export only redacted metadata (Worker name, binding names, route ownership,
   Access application IDs, and secret names), update
   `dashboard-inventory.json` when applicable, and compare it with the Actions
   inventory artifact.

The inventory workflows intentionally receive no Cloudflare credentials and
make no Cloudflare API calls. They cannot expose values or mutate production.
