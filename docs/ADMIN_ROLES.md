# Admin roles and permissions

GoldShore authorization is shared by `gs-web` and `gs-api` through
`packages/auth/rbac.ts`. Cloudflare Access authenticates the request; the
application then derives roles and permissions from verified Access claims.

## Canonical roles

| Role | Purpose | Important limits |
| --- | --- | --- |
| `owner` | Full platform control | Must be assigned manually; Workspace sync never grants it |
| `admin` | Day-to-day administration | Cannot delete users, manage roles, rotate secret metadata, promote deployments, or execute approvals |
| `editor` | Content and operational editing | Cannot administer users, roles, secrets, or deployments |
| `viewer` | Read-only dashboard access | No mutation permissions |

The complete permission arrays are source-controlled in
`packages/auth/rbac.ts`. API handlers must enforce a specific permission with
`requirePermission(...)`; hiding a navigation item is not authorization.

## Google Workspace mapping

Workspace synchronization accepts only the canonical managed roles
`admin`, `editor`, and `viewer`. Compatibility aliases from the original
dashboard proposal are normalized as follows:

| Group-map value | Stored role |
| --- | --- |
| `admin` | `admin` |
| `editor`, `operator`, or `developer` | `editor` |
| `viewer`, `auditor`, or `analyst` | `viewer` |
| `owner` | rejected |

Group email addresses are operator-defined. The repository does not assume a
`goldshore.com` Workspace or hard-code group names.

Example:

```json
{
  "goldshore-admins@goldshore.ai": "admin",
  "goldshore-editors@goldshore.ai": "editor",
  "goldshore-auditors@goldshore.ai": "viewer"
}
```

See [Google Workspace RBAC](./GOOGLE_RBAC.md) for service-account setup,
fail-closed activation, and deprovisioning behavior.

## Synchronization endpoints

All endpoints are mounted on `gs-api`:

| Method and path | Required permission | Purpose |
| --- | --- | --- |
| `GET /admin/workspace/status` | `audit:read` | Latest run and configuration status |
| `GET /admin/workspace/users` | `users:read` | Managed Workspace-user inventory |
| `POST /admin/workspace/sync` | `users:update` | Trigger a manual sync |

The scheduled sync runs at 02:00 UTC through `gs-api` only when
`GOOGLE_WORKSPACE_SYNC_ENABLED` is exactly `true`.

## Source ownership and revocation

The sync ownership tables distinguish Workspace-managed grants from manual
assignments:

- A sync may update or revoke only a grant recorded as Workspace-managed.
- A conflicting manual role is preserved and reported.
- Removing a user from all mapped groups revokes managed grants and disables
  the managed identity only when no manual grant remains.
- Existing `owner` assignments are never created, changed, or removed by the
  Workspace sync.
- Every run is written to `google_workspace_sync_runs`; role changes also
  create immutable audit events.

This prevents a directory refresh from silently overwriting emergency or
founder access.

## Operator checks

After changing a group membership:

1. Run `POST /admin/workspace/sync` with an authenticated admin session.
2. Read `GET /admin/workspace/status` and confirm the latest run succeeded.
3. Read `GET /admin/workspace/users` and verify the user's managed role.
4. Review `audit_events` for the corresponding grant or revocation.

If synchronization is disabled or incomplete, the endpoint returns a
fail-closed status without contacting Google or mutating D1. Do not enable it
until the migration, delegated service account, group map, and Access
application allowlist have all been verified.
