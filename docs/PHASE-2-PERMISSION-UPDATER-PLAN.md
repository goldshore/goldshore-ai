# Phase 2: Permission Updater Implementation Plan

**Component**: Role-Based Access Control (RBAC) Management  
**Priority**: High (foundational for admin security)  
**Estimated Effort**: 40 hours (1 week sprint)  
**Status**: Design phase

---

## Overview

The Permission Updater is a comprehensive RBAC system for managing admin dashboard access. It enables administrators to:
- Create roles with specific permissions
- Assign roles to team members
- Audit access changes (who changed what, when)
- Revoke access instantly
- Implement principle of least privilege

---

## 1. Database Schema (D1)

### Table: `admin_roles`
Purpose: Store role definitions
```sql
CREATE TABLE admin_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSON NOT NULL,  -- array of permission strings
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**Default Roles**:
- `superadmin` — Full access to all features
- `admin` — Most features except secrets/keys
- `operator` — View + limited create/update
- `viewer` — Read-only access
- `auditor` — Audit logs only

---

### Table: `admin_users`
Purpose: Store admin user access assignments
```sql
CREATE TABLE admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role_id TEXT NOT NULL,
  status ENUM('active', 'suspended', 'revoked') DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (role_id) REFERENCES admin_roles(id)
);
```

---

### Table: `admin_permissions`
Purpose: Centralized permission registry
```sql
CREATE TABLE admin_permissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,  -- 'dashboard', 'workers', 'email', 'users', 'secrets', 'audit'
  description TEXT,
  scope TEXT  -- 'read', 'create', 'update', 'delete', 'execute'
);
```

**Permission Examples**:
- `dashboard:view` — View main dashboard
- `workers:read` — View worker configuration
- `workers:deploy` — Deploy workers
- `secrets:read` — View secrets (encrypted in audit log)
- `secrets:create` — Create new secrets
- `secrets:delete` — Delete secrets
- `users:manage` — Manage admin users
- `audit:view` — View audit logs
- `audit:export` — Export audit data

---

### Table: `admin_audit_log`
Purpose: Track all access changes
```sql
CREATE TABLE admin_audit_log (
  id TEXT PRIMARY KEY,
  actor_email TEXT NOT NULL,  -- who made the change
  action TEXT NOT NULL,  -- 'created_role', 'assigned_role', 'revoked_access', 'updated_permissions'
  target_type TEXT NOT NULL,  -- 'role', 'user', 'permission'
  target_id TEXT NOT NULL,
  changes JSON,  -- before/after state
  reason TEXT,  -- why the change was made
  ip_address TEXT,
  timestamp TEXT NOT NULL,
  status TEXT  -- 'success', 'failure'
);
```

---

## 2. API Endpoints (gs-api)

### Roles Management

#### `GET /api/admin/roles`
- **Permission**: `admin:view`
- **Response**: List all roles with permission summary
- **Pagination**: Yes (limit, offset)

#### `GET /api/admin/roles/:roleId`
- **Permission**: `admin:view`
- **Response**: Full role details + assigned users

#### `POST /api/admin/roles`
- **Permission**: `admin:roles:create` (superadmin only)
- **Body**: `{ name, description, permissions: [] }`
- **Response**: Created role with ID

#### `PATCH /api/admin/roles/:roleId`
- **Permission**: `admin:roles:update` (superadmin only)
- **Body**: `{ permissions: [], description }`
- **Audit**: Logs before/after state

#### `DELETE /api/admin/roles/:roleId`
- **Permission**: `admin:roles:delete` (superadmin only)
- **Constraint**: Cannot delete default roles; reassign users first

---

### User Access Management

#### `GET /api/admin/users`
- **Permission**: `users:view`
- **Response**: List admin users with roles + status
- **Pagination**: Yes

#### `POST /api/admin/users`
- **Permission**: `users:create` (admin+)
- **Body**: `{ email, name, role_id }`
- **Action**: Send invitation email
- **Audit**: Logs user creation

#### `PATCH /api/admin/users/:userId`
- **Permission**: `users:update` (admin+)
- **Body**: `{ role_id, status, name }`
- **Audit**: Logs role change + reason

#### `DELETE /api/admin/users/:userId`
- **Permission**: `users:delete` (superadmin only)
- **Action**: Revoke all access immediately
- **Audit**: Logs revocation with timestamp

#### `POST /api/admin/users/:userId/suspend`
- **Permission**: `users:suspend`
- **Body**: `{ reason }`
- **Action**: Suspend without deleting (reversible)

#### `POST /api/admin/users/:userId/restore`
- **Permission**: `users:restore`
- **Body**: `{ reason }`
- **Action**: Restore suspended user

---

### Permissions

#### `GET /api/admin/permissions`
- **Permission**: `audit:view`
- **Response**: All available permissions grouped by category

#### `GET /api/admin/permissions/:permissionId`
- **Permission**: `audit:view`
- **Response**: Permission details + which roles use it

---

### Audit Logs

#### `GET /api/admin/audit/access-changes`
- **Permission**: `audit:view`
- **Query**: `{ actor, action, targetType, startDate, endDate }`
- **Response**: Paginated audit log
- **Redact**: Sensitive values in `changes` field

#### `GET /api/admin/audit/access-changes/:id`
- **Permission**: `audit:view`
- **Response**: Full audit record with before/after snapshot

#### `POST /api/admin/audit/export`
- **Permission**: `audit:export` (admin+)
- **Query**: `{ format: 'csv|json', startDate, endDate }`
- **Action**: Generate signed R2 download URL
- **Response**: `{ downloadUrl, expiresIn }`

---

## 3. Frontend Components (gs-web)

### Pages

#### `/admin/access-control`
Main permission management hub
- Role listing + creation
- User access assignments
- Quick actions (suspend, revoke)
- Audit log viewer

#### `/admin/access-control/roles`
Role management detail view
- List all roles
- Create new role
- Edit role permissions (drag-and-drop)
- See who has each role

#### `/admin/access-control/users`
User management detail view
- Add new admin users
- Assign/change roles
- Suspend/restore/revoke access
- View last login + activity

#### `/admin/audit/access-changes`
Audit log viewer
- Filter by actor, action, date range
- Search by email/target
- View change details (before/after)
- Export audit data

---

### UI Components

#### `RoleCard`
Displays single role
- Role name + description
- Permissions summary (e.g., "8 permissions")
- User count
- Actions: Edit, Delete, Assign

#### `PermissionSelector`
Multi-select for role permissions
- Grouped by category
- Search filter
- Drag-to-reorder
- "Common presets" (viewer, operator, admin)

#### `UserAccessTable`
Paginated user list
- Email, Name, Role, Status, Last Login
- Inline actions: Change Role, Suspend, Revoke
- Bulk actions: Assign role to multiple users

#### `AuditLog`
Activity timeline
- Actor avatar/email
- Action description
- Target + what changed
- Timestamp + IP
- Expand for before/after JSON

---

## 4. Authentication & Authorization

### Request Flow
1. User requests `/api/admin/users` (protected)
2. Middleware validates CF Access JWT
3. Extract `email` from JWT
4. Query `admin_users` table for `email`
5. Load user's `role_id`
6. Load role's `permissions` array
7. Check if permission required for endpoint is in array
8. If denied: return 403 Forbidden
9. If allowed: proceed to handler

### Permission Check Middleware
```typescript
async function requirePermission(permission: string) {
  return async (c: Context) => {
    const email = c.req.header('CF-Access-Authenticated-User-Email');
    if (!email) return c.json({ error: 'Unauthorized' }, 401);
    
    const user = await db.query(
      'SELECT * FROM admin_users WHERE email = ?',
      [email]
    );
    if (!user) return c.json({ error: 'Access denied' }, 403);
    
    const role = await db.query(
      'SELECT * FROM admin_roles WHERE id = ?',
      [user.role_id]
    );
    if (!role.permissions.includes(permission)) {
      return c.json({ error: 'Permission denied' }, 403);
    }
  };
}
```

---

## 5. Implementation Phases

### Phase 2a: Database + Core APIs (Days 1–2)
- [ ] Create D1 tables (roles, users, permissions, audit_log)
- [ ] Insert default roles + permissions
- [ ] Implement permission middleware
- [ ] Build role CRUD endpoints
- [ ] Build user access endpoints
- [ ] Build audit log endpoints
- [ ] Write unit tests (8 tests)

### Phase 2b: Frontend UI (Days 3–4)
- [ ] Create page scaffolds (`/admin/access-control`, `/admin/audit/*`)
- [ ] Build RoleCard + PermissionSelector components
- [ ] Build UserAccessTable component
- [ ] Implement role creation flow
- [ ] Implement user assignment flow
- [ ] Implement audit log viewer
- [ ] Write component tests (6 tests)

### Phase 2c: Integration + Polish (Day 5)
- [ ] Connect frontend to backend APIs
- [ ] Add loading/error states
- [ ] Add confirmation modals for destructive actions
- [ ] Implement real-time updates (fetch on interval)
- [ ] Add email notifications for access changes
- [ ] End-to-end testing
- [ ] Performance optimization

---

## 6. Testing Strategy

### Unit Tests (gs-api)
- Permission middleware (allow/deny scenarios)
- Role CRUD validation
- User status transitions (active → suspended → active)
- Audit log filtering
- Export format generation

### Component Tests (gs-web)
- RoleCard render + actions
- PermissionSelector multi-select
- UserAccessTable pagination
- AuditLog timeline rendering
- Form validation (email, role assignment)

### Integration Tests
- Create role → Assign to user → Verify access
- Suspend user → Verify 403 on protected endpoints
- Delete user → Verify revocation is immediate
- Audit log → Export CSV → Verify data integrity

---

## 7. Security Considerations

### Secrets Protection
- Never log permission values if they contain secrets
- Redact API keys/tokens in audit trail
- Use `[REDACTED]` placeholder for sensitive fields

### Audit Trail Immutability
- Audit log records are append-only (never deleted)
- Store IP address + timestamp
- Store before/after state for change verification

### Revocation Immediacy
- Revoked access takes effect within 5 seconds
- Cache user roles with 5-minute TTL max
- On role change, invalidate user's session

### Least Privilege Default
- New admin users get `viewer` role (read-only)
- Each operation requires explicit permission
- No implicit role inheritance

---

## 8. Success Criteria

✅ Implemented when:
1. All 5 role CRUD endpoints working + tested
2. All 6 user access endpoints working + tested
3. Audit log captured for all access changes
4. Frontend pages render and connect to backend
5. Permission middleware enforces access control
6. Email notifications sent on access changes
7. Audit export working (CSV + JSON)
8. All 145 existing tests still passing
9. 14+ new tests for Permission Updater added
10. Manual testing: Create role → Assign user → Verify access → Revoke

---

## 9. Dependencies

### No Breaking Changes To:
- gs-api routing (already fixed in Phase 1)
- Admin dashboard UI (Phase 1 components still work)
- D1 schema (Phase 1 tables untouched)
- Authentication (CF Access flow unchanged)

### New Dependencies:
- `uuid` (for IDs) — already in package.json
- `zod` (validation) — already in package.json
- No new npm packages required

---

## 10. Success Metrics (Post-Launch)

- 100% of admin actions logged
- 0 unauthorized access incidents
- < 5 second revocation latency
- < 2% false-positive permission denials
- Audit log query time < 500ms
- Export CSV generation < 3 seconds

---

## File Structure

```
apps/gs-api/
├── src/
│   ├── lib/
│   │   ├── rbac.ts (Permission + Role utilities)
│   │   └── audit.ts (Audit logging)
│   └── routes/
│       └── admin/
│           ├── access-control.ts (Role CRUD)
│           ├── users.ts (User access CRUD)
│           └── audit.ts (Audit log + export)

apps/gs-web/
├── src/
│   ├── pages/
│   │   ├── admin/access-control.astro
│   │   └── admin/audit/
│   │       ├── access-changes.astro
│   │       └── [id].astro
│   ├── components/admin/
│   │   ├── RoleCard.tsx
│   │   ├── PermissionSelector.tsx
│   │   ├── UserAccessTable.tsx
│   │   └── AuditLog.tsx
│   └── lib/
│       ├── api/access-control.ts
│       └── api/audit.ts
```

---

## Next Steps

1. ✅ Review this plan with stakeholders
2. ⏳ Create D1 tables (SQL migration)
3. ⏳ Implement backend routes + middleware
4. ⏳ Build frontend components
5. ⏳ Connect frontend to backend
6. ⏳ Test end-to-end flows
7. ⏳ Deploy and monitor

**Timeline**: Week of August 18–24, 2026  
**Owner**: Claude Code  
**Status**: Ready for implementation

