# Admin Roles & Permissions

## Role Hierarchy

GoldShore implements five admin roles with granular permissions:

```
┌─────────────────────────────────────┐
│ Admin (Full Platform Access)        │
├─────────────────────────────────────┤
│ ├─ Operator (Operations & Config)   │
│ ├─ Developer (API & Deployment)     │
│ ├─ Analyst (Data & Reporting)       │
│ └─ Auditor (Read-Only Logs)         │
└─────────────────────────────────────┘
```

## Role Definitions

### Admin
**Full platform access** - Can perform any action, manage all resources and users.

**Permissions:**
- `system:read` - Read all system configuration
- `system:write` - Modify all system configuration
- `audit:read` - Read audit logs
- `forms:read` - Read form submissions
- `forms:write` - Modify form configurations
- `cloudflare_inventory:read` - View all Cloudflare resources
- `secret_metadata:read` - View secret metadata (not decrypted values)
- `users:read` - View user list and permissions
- `api_configuration:read` - View API configuration

**Typical Users:**
- Platform founders
- CTO/VP Engineering
- Head of Operations

**Dashboard Access:**
- All admin pages (100% of dashboard)

### Operator
**Operational monitoring and configuration** - Can monitor system health, manage operational settings, but cannot modify core system configuration or secrets.

**Permissions:**
- `system:read` - Read system configuration
- `audit:read` - Read audit logs (excluded: secret access logs)
- `forms:read` - Read form submissions
- `cloudflare_inventory:read` - View Cloudflare resources (non-secret)
- `api_configuration:read` - View API configuration

**Typical Users:**
- Operations team members
- DevOps engineers (read-only)
- Support leads

**Dashboard Access:**
- Governance > Overview, Repo Health
- Operations > All sections (read-only)
- Workers > Status, Routes, Bindings (read-only)
- System > DNS, Storage, Pages (read-only)

**Cannot Access:**
- System > Secrets
- User management
- Settings and configuration

### Developer
**API configuration and deployment** - Can deploy workers, manage API configuration, and view infrastructure.

**Permissions:**
- `system:read` - Read system configuration
- `cloudflare_inventory:read` - View Cloudflare resources
- `api_configuration:read` - View API configuration

**Typical Users:**
- Backend engineers
- Full-stack engineers
- Deployment automation

**Dashboard Access:**
- Workers > All sections (read-only)
- System > DNS (read-only)
- Operations > API Workflows
- Platform > Control Plane

**Cannot Access:**
- Audit logs
- Secret metadata
- Forms
- User management

### Analyst
**Data and reporting access** - Can view analytics, reports, and operational metrics but cannot access system configuration or secrets.

**Permissions:**
- `audit:read` - Read audit logs (public events only)
- `api_configuration:read` - View API configuration

**Typical Users:**
- Data analysts
- Business intelligence team
- Reporting & insights

**Dashboard Access:**
- Governance > Overview (dashboards only)
- Operations > Monetization, Search Console
- Integrations > All (view-only)

**Cannot Access:**
- Worker configuration
- Secrets
- User management
- System settings

### Auditor
**Read-only access to logs** - Can only view audit logs and compliance data. No access to system configuration or operational controls.

**Permissions:**
- `audit:read` - Read audit logs

**Typical Users:**
- Compliance officers
- Security auditors
- External auditors

**Dashboard Access:**
- Governance > Repo Health (read-only)

**Cannot Access:**
- Any configuration
- Worker details
- Secrets
- User lists
- Forms
- Integrations

## Permission Mapping

### Resource Permissions

| Resource | Permission | Scope |
|----------|-----------|-------|
| System Configuration | `system:read` | View config |
| System Configuration | `system:write` | Modify config |
| Audit Logs | `audit:read` | View all logs |
| Forms | `forms:read` | View forms & submissions |
| Forms | `forms:write` | Create/modify forms |
| Cloudflare Inventory | `cloudflare_inventory:read` | View workers, routes, bindings |
| Secrets | `secret_metadata:read` | View secret names/metadata only |
| Users | `users:read` | View user list & roles |
| API Configuration | `api_configuration:read` | View API endpoints & settings |

## Assigning Roles

### Via Google Workspace Groups

Users are assigned roles automatically based on Google Workspace group membership:

```
User Email → Google Workspace Groups → Role Mapping → Admin Session
```

Add user to the appropriate Google Workspace group:
- `goldshore-admins@goldshore.com` → admin role
- `goldshore-operators@goldshore.com` → operator role
- `goldshore-developers@goldshore.com` → developer role
- `goldshore-analysts@goldshore.com` → analyst role
- `goldshore-auditors@goldshore.com` → auditor role

Changes sync automatically via daily cron job (2 AM UTC) or manually via `POST /api/admin/sync-google-users`.

### Via Admin API

Direct role assignment (admin only):

```bash
curl -X POST https://admin.goldshore.ai/api/admin/users/:userId/roles \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "developer"}'
```

## Permission Checks in Code

### Layout-Level Permission Checks

```astro
---
import AdminLayout from '../layouts/AdminLayout.astro';

// Require specific permission to access page
---

<AdminLayout 
  title="Admin Page"
  requiredPermission="system:write"
>
  <!-- Page content -->
</AdminLayout>
```

### Component-Level Permission Checks

```astro
---
import { hasAdminPermission } from '@goldshore/auth';

const session = Astro.locals.adminSession;
const canManageSecrets = hasAdminPermission(
  session.permissions,
  'secret_metadata:read'
);
---

{canManageSecrets && <SecretsPanel />}
```

### API-Level Permission Checks

```ts
// In gs-api handler

import { authorizeAdminRequest, getAdminRouteRule } from '@goldshore/auth';

export async function handle(request: Request, env: Env) {
  const rule = getAdminRouteRule(pathname, method);
  if (!rule) return new Response('Not Found', { status: 404 });
  
  const auth = await authorizeAdminRequest(request, env, rule);
  
  if (!auth.ok) {
    return new Response(auth.error, { status: auth.status });
  }
  
  // auth.session has verified roles and permissions
  // Proceed with handler logic
}
```

## Multi-Role Users

A single user can have multiple roles. Permissions are combined:

```ts
// User is both 'developer' and 'analyst'
const permissions = [
  // From developer role
  'system:read',
  'cloudflare_inventory:read',
  'api_configuration:read',
  // From analyst role
  'audit:read',
  'api_configuration:read', // duplicate removed
];
```

Dashboard UI shows all accessible sections across all roles.

## Permission Grant Examples

### Scenario 1: New Backend Engineer

1. Add to Google Workspace
2. Add to `goldshore-developers@goldshore.com` group
3. Wait for daily sync or trigger manual sync
4. User can access: Workers, System DNS, API Workflows, Control Plane

### Scenario 2: Operations Team

1. Create group: `goldshore-ops-team@goldshore.com`
2. Add to `goldshore-operators@goldshore.com`
3. Sync users
4. Team can monitor: System Status, Workflows, Routes, Forms, Logs

### Scenario 3: External Auditor

1. Create external user in Google Workspace
2. Add to `goldshore-auditors@goldshore.com`
3. Sync users
4. Can view audit logs only

## Revoking Access

### Remove from Google Group

1. Open Google Workspace Admin Console
2. Navigate to Groups
3. Click the role group (e.g., `goldshore-operators@goldshore.com`)
4. Click user to remove
5. Confirm removal

Changes take effect after next sync (max 24 hours) or after manual trigger.

### Immediate Revocation (Emergency)

```bash
# Disable admin user immediately (before sync)
curl -X POST https://admin.goldshore.ai/api/admin/users/:userId/disable \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Audit Trail

All role changes are logged:

```sql
SELECT * FROM audit_logs
WHERE resource_type = 'admin_role'
ORDER BY timestamp DESC;
```

Example log entry:
```json
{
  "timestamp": "2026-08-12T14:30:00Z",
  "user_id": "admin-001",
  "action": "ROLE_ASSIGNED",
  "resource_type": "admin_role",
  "resource_id": "user-123",
  "changes": {
    "role_added": "developer",
    "groups": ["goldshore-developers@goldshore.com"]
  }
}
```

## Troubleshooting

### User Can't Access Expected Page

1. Check user's roles: `SELECT * FROM admin_users WHERE email = ?`
2. Check page's required permission in AdminLayout
3. Check permission in ROLE_DEFINITIONS matches page requirement
4. Verify user is in correct Google Workspace group
5. Trigger manual sync if group was just updated

### Permission Mismatch Error

```
Error: Missing required permission: system:write
```

Solution:
1. Verify user's current roles
2. Check ROLE_DEFINITIONS has permission for that role
3. Add user to group with sufficient role
4. Manual sync if recent change

### Group Not Syncing

1. Verify service account has Directory API Reader role
2. Check cron job logs: `wrangler tail`
3. Manually trigger sync: `POST /api/admin/sync-google-users`
4. Check AUDIT_DB for sync errors

## Best Practices

1. **Use Role Groups** - Assign roles via Google Workspace groups, not individual assignments
2. **Follow Least Privilege** - Grant minimum role needed for job function
3. **Rotate Roles** - Review and update role assignments quarterly
4. **Audit Changes** - Monitor audit logs for unauthorized role changes
5. **Document Justification** - Keep notes on why each user has their role
6. **Separate Concerns** - Don't combine admin duties with operator duties on same account
7. **Use Service Accounts** - For automation, use service accounts not user credentials

## References

- [Admin Dashboard Documentation](./ADMIN_DASHBOARD.md)
- [Google RBAC Setup](./GOOGLE_RBAC.md)
- [Authentication & Authorization](../apps/gs-web/src/utils/admin-access.ts)
