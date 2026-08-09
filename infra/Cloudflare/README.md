# Cloudflare configuration authority

GoldShore uses two deployable applications only: `gs-web` and `gs-api`.

- `apps/gs-web/wrangler.toml` is the visible contract for the Astro SSR
  Worker-with-Assets serving `goldshore.ai`, `goldshore.org`, and both admin
  hostnames.
- `apps/gs-api/wrangler.toml` is the visible contract for API middleware,
  email events, queues, Workflows, D1, R2, KV, AI, and the mirrored API hosts.
- Cloudflare Workers Builds is the sole code deployment authority and must use
  the `gs-control` build token configured in the Cloudflare dashboard.
- GitHub Actions may build, test, export redacted expected state, and perform a
  separately scoped read-only audit. It must not mutate Cloudflare.

## Dashboard/WYSIWYG boundary

Apply routes, custom domains, Access policies, IdPs, email routing, build
connections, secret values, and resource lifecycle changes in the Cloudflare
dashboard using a named human account. Record the issue/PR, before/after state,
Cloudflare audit-log event ID, validation results, and rollback in the operator
ticket.

Wrangler configuration is intentionally visible because Workers Builds uses it
as the runtime binding contract. Cloudflare does not provide a general
`keep_bindings` control: omitting a binding can remove it during a build. Secret
values and Access/IdP policies remain dashboard-only. Do not create hidden
alternate Wrangler manifests or deploy from `infra/Cloudflare`.

`dashboard-inventory.json` contains names and public IDs only. Replace each
`DASHBOARD_EXPORT_REQUIRED` value from the dashboard after an approved review;
never include policies, tokens, client secrets, or secret values.

## Change procedure

1. Update one of the two app manifests and `BINDINGS_MAP.md` in a PR.
2. Pass Infrastructure Guard, application tests, dry-run builds, and external
   Cloudflare Workers Builds checks.
3. Obtain the required production-environment approval.
4. Apply dashboard-only changes through Cloudflare WYSIWYG controls.
5. Trigger/retry the relevant Workers Build and verify the release SHA on every
   mirror hostname.
6. Run the read-only Cloudflare audit and attach its artifact to the ticket.

Legacy workers, Pages projects, bindings, and routes are quarantined for 30
days before deletion. During quarantine remove traffic and producers, label the
resource with its owner and retirement date, and retain a rollback record.
