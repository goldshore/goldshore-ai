# Google Workspace RBAC integration

## Status and boundaries

GoldShore can synchronize selected Google Workspace groups into the canonical
`gs-api` authorization store. The implementation is deliberately disabled in
both deployed environments until an operator verifies the Google Cloud project,
delegated administrator, group addresses, and service-account secret.

This integration does not replace Cloudflare Access login. Access authenticates
the browser and supplies the signed identity assertion; Workspace sync controls
which authenticated identities receive an internal application role. It also
does not create a satellite worker: the API routes and daily scheduled handler
run inside `apps/gs-api`.

No Google Cloud project ownership, domain-wide delegation, group membership, or
production secret is proven by this repository. Those items require live console
verification before enabling the sync.

## Runtime flow

1. The `gs-api` scheduled handler runs at `0 2 * * *` alongside token rotation.
2. When `GOOGLE_WORKSPACE_SYNC_ENABLED` is not exactly `true`, the Workspace job
   returns without contacting Google or mutating D1.
3. When enabled, `gs-api` signs a one-hour RS256 service-account assertion and
   impersonates the configured delegated Workspace administrator.
4. The Worker exchanges that assertion for an OAuth access token with only:
   - `admin.directory.user.readonly`
   - `admin.directory.group.member.readonly`
5. The Directory API lists Workspace users and the direct/derived members of
   each explicitly configured group.
6. Group labels are normalized to the repository's enforced Access roles and
   written through prepared D1 statements.
7. The sync records an append-only audit event and a detailed sync-run record.

Provider responses are gathered before authorization rows are changed. A
Directory or token error therefore leaves the current grants intact.

## Canonical roles

The Access authorization schema supports these application roles:

| Configured label | Stored role | Purpose |
| --- | --- | --- |
| `admin` | `admin` | Administrative operations |
| `editor` | `editor` | Content and operational editing |
| `viewer` | `viewer` | Read-only access |
| `operator` | `editor` | Compatibility alias for the original Claude plan |
| `developer` | `editor` | Compatibility alias for the original Claude plan |
| `auditor` | `viewer` | Compatibility alias for the original Claude plan |
| `analyst` | `viewer` | Compatibility alias for the original Claude plan |

Automatic assignment of `owner` is rejected. If a user belongs to several
configured groups, the highest role wins: `admin`, then `editor`, then `viewer`.
Suspended or archived Workspace users receive no grant.

## Cloudflare configuration

The following non-secret variables are present in both Wrangler environments
with synchronization disabled:

| Variable | Example | Notes |
| --- | --- | --- |
| `GOOGLE_WORKSPACE_SYNC_ENABLED` | `false` | Must be exactly `true` to run |
| `GOOGLE_WORKSPACE_DELEGATED_ADMIN` | `admin@example.com` | Workspace admin impersonated by the service account |
| `GOOGLE_WORKSPACE_CUSTOMER_ID` | `my_customer` | Immutable customer ID is preferred after verification |
| `GOOGLE_WORKSPACE_GROUP_ROLE_MAP` | `{"admins@example.com":"admin"}` | JSON object; no default groups are trusted |
| `GOOGLE_WORKSPACE_ACCESS_APPLICATIONS` | `admin-production,api-production` | Fixed allowlist of canonical Access applications |

The service-account JSON is a Worker secret named
`GOOGLE_ADMIN_SERVICE_ACCOUNT`. Never place it in `wrangler.toml`, a local env
file, an issue, or a PR comment.

```powershell
Get-Content -Raw .\verified-workspace-service-account.json |
  pnpm --filter @goldshore/gs-api exec wrangler secret put `
    GOOGLE_ADMIN_SERVICE_ACCOUNT --env prod --name gs-api
```

The production deploy workflow uploads this secret only when the corresponding
GitHub Actions secret exists. It does not make the secret mandatory while sync
is disabled.

## Google Workspace setup

1. Verify the exact Google Cloud project and numeric service-account client ID.
2. Enable the Admin SDK Directory API.
3. Enable domain-wide delegation for the service account.
4. In Workspace Admin, authorize the numeric client ID for exactly these scopes:

   ```text
   https://www.googleapis.com/auth/admin.directory.user.readonly,
   https://www.googleapis.com/auth/admin.directory.group.member.readonly
   ```

5. Choose an active delegated administrator who can read users and groups.
6. Verify every group address and decide its canonical role.
7. Store the service-account JSON as the Worker secret.
8. Apply the D1 migration and deploy with synchronization still disabled.
9. Set the verified variables, run a manual sync, inspect conflicts and audit
   output, and only then enable the scheduled job.

Domain-wide delegation can take time to propagate. An `unauthorized_client` or
`access_denied` token response must be fixed in Google Workspace; it is not a
reason to broaden scopes or bypass the sync gate.

## API endpoints

All endpoints are protected by the repository's Cloudflare Access verification
and durable application allow-map.

| Endpoint | Required permission | Behavior |
| --- | --- | --- |
| `GET /admin/workspace/status` | `audit:read` | Shows enabled/configured state, latest run, and counts |
| `GET /admin/workspace/users?limit=100` | `users:read` | Lists synchronized users, role, groups, and active state |
| `POST /admin/workspace/sync` | `users:update` | Runs a manual synchronization |

The manual endpoint returns:

- `503` when disabled or incompletely configured;
- `409` when another non-stale sync is running;
- `502` when Google token or Directory calls fail;
- `200` with counts when D1 changes commit successfully.

Preview continues to reject mutating HTTP methods while
`STATE_MUTATIONS_ENABLED=false`, independently of the Workspace flag.

## D1 ownership and deprovisioning

Migration `0007_google_workspace_rbac.sql` adds:

- `google_workspace_sync_runs` for success/failure and count history;
- `google_workspace_users` for provider identity, selected role, groups, and
  deprovisioning state;
- `google_workspace_access_grants` as the ownership ledger for rows created by
  this integration.

The sync also updates the pre-existing canonical tables:

- `users` and `identities` for the Google Workspace identity;
- `access_users` and `access_application_roles` for the actual API allow-map;
- `audit_events` for the immutable operator trail.

Manual grants are preserved. If an application-role row existed before the
Workspace ledger claimed it, the sync reports a conflict and does not overwrite
that row. When a user leaves all configured groups, is suspended, or is archived,
only grants recorded in the Workspace ownership ledger are removed. An
`access_users` record is disabled only when the sync created it and no other
application roles remain.

## Deployment order

The canonical `deploy-gs-api.yml` workflow performs these steps:

1. frozen dependency install and dry-run build;
2. apply the idempotent Workspace migration to `gs_platform_db` on `main`;
3. upload configured Worker secrets;
4. deploy the single `gs-api` Worker;
5. run the production health check.

There is no additional deploy workflow or Worker. The migration is safe to run
again because all created objects use `IF NOT EXISTS`.

## Verification checklist

- [ ] Confirm the Cloud project ID, project number, and service-account client ID.
- [ ] Confirm Directory API enablement and delegated scopes in Workspace Admin.
- [ ] Confirm the delegated administrator is active and least-privileged.
- [ ] Confirm every configured group address and intended role.
- [ ] Confirm production and preview application names match the Access rows.
- [ ] Apply `0007_google_workspace_rbac.sql` before enabling sync.
- [ ] Run `POST /admin/workspace/sync` and inspect its counts.
- [ ] Review `google_workspace_sync_runs` and `audit_events`.
- [ ] Test removal with a non-critical user and confirm manual grants survive.
- [ ] Enable the schedule only after the manual test is clean.

## References

- Google: server-to-server OAuth and domain-wide delegation
- Google Admin SDK: `users.list`
- Google Admin SDK: `members.list`
- Cloudflare D1: prepared statements and transactional `batch()`
- Cloudflare Workers: Cron Triggers
