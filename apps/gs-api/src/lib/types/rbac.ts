/**
 * Role-Based Access Control (RBAC) Types
 * Defines schema types for admin roles, permissions, and audit logging
 */

/** Permission ID (enum-like strings for type safety) */
export type PermissionId =
  | 'perm_dashboard_view'
  | 'perm_dashboard_export'
  | 'perm_workers_view'
  | 'perm_workers_update'
  | 'perm_workers_deploy'
  | 'perm_workers_rollback'
  | 'perm_email_view'
  | 'perm_email_create'
  | 'perm_email_update'
  | 'perm_email_send'
  | 'perm_email_delete'
  | 'perm_users_view'
  | 'perm_users_create'
  | 'perm_users_update'
  | 'perm_users_suspend'
  | 'perm_users_restore'
  | 'perm_users_delete'
  | 'perm_secrets_view'
  | 'perm_secrets_create'
  | 'perm_secrets_update'
  | 'perm_secrets_rotate'
  | 'perm_secrets_delete'
  | 'perm_audit_view'
  | 'perm_audit_export'
  | 'perm_audit_search'
  | 'perm_roles_view'
  | 'perm_roles_create'
  | 'perm_roles_update'
  | 'perm_roles_delete';

/** Permission category */
export type PermissionCategory = 'dashboard' | 'workers' | 'email' | 'users' | 'secrets' | 'audit';

/** Permission scope */
export type PermissionScope = 'read' | 'create' | 'update' | 'delete' | 'execute' | 'manage';

/** Admin role record from database */
export interface AdminRole {
  id: string;
  name: string;
  description?: string;
  permissions: string; // JSON array string of permission IDs
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/** Admin role with parsed permissions */
export interface AdminRoleWithPermissions extends AdminRole {
  permissionIds: PermissionId[];
}

/** Permission record from database */
export interface AdminPermission {
  id: PermissionId;
  name: string; // e.g., 'dashboard:view', 'workers:deploy'
  category: PermissionCategory;
  description?: string;
  scope: PermissionScope;
  created_at: string;
}

/** Admin user record from database */
export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  role_id: string;
  status: 'active' | 'suspended' | 'revoked';
  last_login?: string;
  last_ip?: string;
  invited_at?: string;
  invited_by?: string;
  created_at: string;
  updated_at: string;
}

/** Admin user with role details */
export interface AdminUserWithRole extends AdminUser {
  role?: AdminRole;
  role_name?: string;
}

/** Audit log action type */
export type AuditAction =
  | 'created_role'
  | 'updated_role'
  | 'deleted_role'
  | 'created_permission'
  | 'deleted_permission'
  | 'assigned_role'
  | 'revoked_role'
  | 'suspended_user'
  | 'restored_user'
  | 'deleted_user'
  | 'updated_user';

/** Audit log target type */
export type AuditTargetType = 'role' | 'user' | 'permission';

/** Audit log record from database */
export interface AdminAuditLog {
  id: string;
  actor_email: string;
  action: AuditAction;
  target_type: AuditTargetType;
  target_id: string;
  target_name?: string;
  changes?: string; // JSON object with before/after state
  reason?: string;
  ip_address?: string;
  user_agent?: string;
  status: 'success' | 'failure';
  error_message?: string;
  timestamp: string;
}

/** Audit log with parsed changes */
export interface AdminAuditLogWithChanges extends AdminAuditLog {
  changesBefore?: Record<string, any>;
  changesAfter?: Record<string, any>;
}

/** Audit log filter options */
export interface AuditLogFilter {
  actor_email?: string;
  action?: AuditAction;
  target_type?: AuditTargetType;
  target_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

/** Audit log export format */
export type AuditExportFormat = 'csv' | 'json';

/**
 * Request/Response types for API endpoints
 */

// Role creation request
export interface CreateRoleRequest {
  name: string;
  description?: string;
  permission_ids: PermissionId[];
}

// Role creation response
export interface CreateRoleResponse {
  id: string;
  name: string;
  description?: string;
  permissions: PermissionId[];
  created_at: string;
}

// Update role request
export interface UpdateRoleRequest {
  description?: string;
  permission_ids?: PermissionId[];
}

// User assignment request
export interface AssignUserRoleRequest {
  email: string;
  name?: string;
  role_id: string;
  reason?: string;
}

// User status update request
export interface UpdateUserStatusRequest {
  status: 'active' | 'suspended' | 'revoked';
  reason?: string;
}

// Suspend user request
export interface SuspendUserRequest {
  reason?: string;
}

// Restore user request
export interface RestoreUserRequest {
  reason?: string;
}

// Permission response
export interface PermissionResponse {
  id: PermissionId;
  name: string;
  category: PermissionCategory;
  description?: string;
  scope: PermissionScope;
}

// Role list response
export interface RoleListResponse {
  roles: AdminRole[];
  total: number;
  limit: number;
  offset: number;
}

// User list response
export interface UserListResponse {
  users: AdminUserWithRole[];
  total: number;
  limit: number;
  offset: number;
}

// Audit log list response
export interface AuditLogListResponse {
  logs: AdminAuditLog[];
  total: number;
  limit: number;
  offset: number;
}

// Error response
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, any>;
}
